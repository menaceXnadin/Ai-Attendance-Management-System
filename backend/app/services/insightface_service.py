"""Face engine: InsightFace ``buffalo_l`` detection + recognition and MiniFASNet liveness.

docs/system/face-verification.md §2-§3. The module-level singleton ``insightface_service``
is the **only** door to the models: routes and services call
``await insightface_service.aprocess_frames(frames, with_liveness=...)`` (worker thread,
bounded by ``settings.face_max_concurrency``) and never run model code on the event loop.
Tests replace this whole module with ``tests/support/fake_face.py``.

Only two InsightFace models are loaded: SCRFD-10G detection (with 5 landmarks) and ArcFace
R50 recognition. ``process_frames`` never raises for a bad frame; problems are reported in
the per-frame dict (``error`` = ``invalid_image`` / ``no_face``).
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import contextlib
import functools
import io
import logging
import weakref
from typing import Any, Optional, Sequence

import anyio
import anyio.to_thread
import cv2
import numpy as np
from PIL import Image, ImageOps

from app.core.config import settings
from app.core.face_constants import (
    DETECTION_MIN_CONFIDENCE,
    FACE_COUNT_MIN_DET_SCORE,
    MAX_DECODE_DIMENSION,
    MAX_DECODE_PIXELS,
    MAX_FRAME_BASE64_CHARS,
    QUALITY_CROP_SIZE,
)
from app.services.face_math import (
    best_match_index,
    best_similarity,
    composite_embedding,
    cosine_similarity,
    yaw_from_kps,
)

logger = logging.getLogger(__name__)

MODEL_ID = "insightface/buffalo_l"
MODEL_PACK = "buffalo_l"
PROVIDERS = ["CPUExecutionProvider"]

ERROR_INVALID_IMAGE = "invalid_image"
ERROR_NO_FACE = "no_face"


class FrameError(ValueError):
    """A frame that can't be used; ``code`` is the per-frame ``error`` value."""

    def __init__(self, code: str, detail: str = ""):
        super().__init__(detail or code)
        self.code = code


# --------------------------------------------------------------------------- image helpers


def _strip_data_url(data: str) -> str:
    return data.split(",", 1)[1] if "," in data else data


def decode_frame(data: Any) -> np.ndarray:
    """Base64 (optionally a ``data:`` URL) -> BGR ``uint8`` image, downscaled to
    ``MAX_DECODE_DIMENSION``. Raises :class:`FrameError` (``invalid_image``)."""
    if not isinstance(data, str) or not data:
        raise FrameError(ERROR_INVALID_IMAGE, "frame is not a non-empty string")
    if len(data) > MAX_FRAME_BASE64_CHARS:
        raise FrameError(ERROR_INVALID_IMAGE, "frame is too large")
    payload = "".join(_strip_data_url(data.strip()).split())
    try:
        raw = base64.b64decode(payload + "=" * (-len(payload) % 4), validate=False)
    except (binascii.Error, ValueError) as exc:
        raise FrameError(ERROR_INVALID_IMAGE, f"bad base64: {exc}") from None
    if not raw:
        raise FrameError(ERROR_INVALID_IMAGE, "empty image")
    try:
        with Image.open(io.BytesIO(raw)) as pil:
            w, h = pil.size
            if w <= 0 or h <= 0 or w * h > MAX_DECODE_PIXELS:
                raise FrameError(ERROR_INVALID_IMAGE, f"unsupported image size {w}x{h}")
            if max(w, h) > 2 * MAX_DECODE_DIMENSION:
                # JPEG only: decode at a reduced DCT scale (much faster), still >= the target.
                pil.draft("RGB", (MAX_DECODE_DIMENSION, MAX_DECODE_DIMENSION))
            pil.load()
            pil = ImageOps.exif_transpose(pil)
            rgb = np.asarray(pil.convert("RGB"))
    except FrameError:
        raise
    except Exception as exc:  # PIL raises many types for corrupt / unknown data
        raise FrameError(ERROR_INVALID_IMAGE, f"undecodable image: {exc}") from None
    return downscale(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))


def downscale(image: np.ndarray, max_side: int = MAX_DECODE_DIMENSION) -> np.ndarray:
    """Shrink so the longest side is at most ``max_side`` (never enlarges)."""
    h, w = image.shape[:2]
    if max(h, w) <= max_side:
        return image
    s = max_side / float(max(h, w))
    return cv2.resize(image, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA)


def face_crop_stats(image: np.ndarray, bbox: Sequence[float]) -> tuple[float, float]:
    """``(sharpness, brightness)`` of the grey face crop resized to 112x112.

    Sharpness is the variance of the Laplacian, brightness the mean grey level (0-255).
    ``(0.0, 0.0)`` for an empty crop.
    """
    h, w = image.shape[:2]
    x1, y1 = max(int(np.floor(bbox[0])), 0), max(int(np.floor(bbox[1])), 0)
    x2, y2 = min(int(np.ceil(bbox[2])), w), min(int(np.ceil(bbox[3])), h)
    if x2 - x1 < 2 or y2 - y1 < 2:
        return 0.0, 0.0
    grey = cv2.cvtColor(image[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
    interp = cv2.INTER_AREA if min(grey.shape) > QUALITY_CROP_SIZE else cv2.INTER_LINEAR
    grey = cv2.resize(grey, (QUALITY_CROP_SIZE, QUALITY_CROP_SIZE), interpolation=interp)
    return float(cv2.Laplacian(grey, cv2.CV_64F).var()), float(grey.mean())


# --------------------------------------------------------------------------- engine


def _tune_sessions(models: Sequence[Any]) -> None:
    """Re-create the InsightFace ONNX sessions with intra-op spinning disabled.

    ``FaceAnalysis`` doesn't forward ``SessionOptions``. With the default spinning, the idle
    thread pool of one session busy-waits while the next session runs (detection then
    recognition, every frame), which measured ~2.5x slower per frame on a 16-core CPU.
    """
    import onnxruntime as ort

    options = ort.SessionOptions()
    options.log_severity_level = 3
    options.add_session_config_entry("session.intra_op.allow_spinning", "0")
    for model in models:
        model.session = ort.InferenceSession(model.model_file, sess_options=options, providers=PROVIDERS)


class InsightFaceService:
    """InsightFace ``buffalo_l`` (detection + recognition) plus the MiniFASNet ensemble."""

    model_id: str = MODEL_ID

    def __init__(self, det_size: Optional[int] = None, antispoof_model_dir: Optional[str] = None):
        from insightface.app import FaceAnalysis

        self.model_id = MODEL_ID
        self.tolerance = float(settings.face_recognition_tolerance)
        self.confidence_threshold = DETECTION_MIN_CONFIDENCE  # legacy endpoints
        self.det_size = int(det_size or settings.insightface_det_size)

        logger.info("Loading InsightFace %s (the first run downloads the model pack)", MODEL_PACK)
        captured = io.StringIO()  # insightface prints one line per model file; keep it out of stdout
        with contextlib.redirect_stdout(captured):
            self.app = FaceAnalysis(name=MODEL_PACK, allowed_modules=["detection", "recognition"], providers=PROVIDERS)
            self.app.prepare(ctx_id=0, det_size=(self.det_size, self.det_size))
        for line in captured.getvalue().splitlines():
            logger.debug("insightface: %s", line)
        if "recognition" not in self.app.models:
            raise RuntimeError(f"InsightFace pack {MODEL_PACK!r} has no recognition model")
        self.det_model = self.app.det_model
        self.rec_model = self.app.models["recognition"]
        _tune_sessions([self.det_model, self.rec_model])

        from app.services import face_liveness

        model_dir = face_liveness.resolve_model_dir(
            antispoof_model_dir if antispoof_model_dir is not None else settings.antispoof_model_dir)
        self._liveness = face_liveness.AntiSpoofRunner(model_dir, providers=PROVIDERS)
        self.liveness_available = bool(self._liveness.available)
        logger.info("Face engine ready: %s det_size=%d liveness=%s", self.model_id, self.det_size,
                    "on" if self.liveness_available else "unavailable")

    # -- detection core ------------------------------------------------------------------
    def _detect(self, image: np.ndarray) -> list[tuple[np.ndarray, float, Optional[np.ndarray]]]:
        """``[(bbox_xyxy, det_score, kps)]`` with ``det_score >= FACE_COUNT_MIN_DET_SCORE``,
        largest first."""
        bboxes, kpss = self.det_model.detect(image, max_num=0, metric="default")
        found = []
        for i in range(bboxes.shape[0]):
            score = float(bboxes[i, 4])
            if score < FACE_COUNT_MIN_DET_SCORE:
                continue
            found.append((bboxes[i, :4].astype(np.float64), score, None if kpss is None else kpss[i]))
        found.sort(key=lambda f: float((f[0][2] - f[0][0]) * (f[0][3] - f[0][1])), reverse=True)
        return found

    def _embed(self, image: np.ndarray, bbox: np.ndarray, score: float, kps: np.ndarray) -> tuple[list[float], float]:
        """``(L2-normalised embedding, raw norm)`` for one detected face."""
        from insightface.app.common import Face

        raw = np.asarray(self.rec_model.get(image, Face(bbox=bbox, kps=kps, det_score=score)), dtype=np.float64)
        norm = float(np.linalg.norm(raw))
        emb = raw / norm if norm > 0 else raw
        return emb.tolist(), norm

    def _face_dict(self, image: np.ndarray, bbox: np.ndarray, score: float, kps: Optional[np.ndarray]) -> dict[str, Any]:
        h, w = image.shape[:2]
        x1, y1, x2, y2 = (float(v) for v in bbox)
        width, height = x2 - x1, y2 - y1
        kps_list = [[float(p[0]), float(p[1])] for p in kps] if kps is not None else []
        embedding, norm = self._embed(image, bbox, score, kps) if kps is not None else ([], 0.0)
        sharpness, brightness = face_crop_stats(image, bbox)
        return {
            "bbox": [x1, y1, x2, y2],
            "det_score": score,
            "confidence": score,
            "kps": kps_list,
            "embedding": embedding,
            "embedding_norm": norm,
            "width": width,
            "height": height,
            "area": width * height,
            "area_ratio": (width * height) / float(w * h) if w and h else 0.0,
            "yaw": yaw_from_kps(kps_list) if kps_list else 0.0,
            "sharpness": sharpness,
            "brightness": brightness,
        }

    def analyze_image(self, image: np.ndarray, *, with_liveness: bool, index: int = 0) -> dict[str, Any]:
        """Per-frame result (spec §3) for an already decoded BGR image."""
        image = downscale(image)
        result: dict[str, Any] = {
            "index": index, "ok": False, "error": None, "faces_detected": 0, "secondary_face_ratio": 0.0,
            "image_shape": [int(image.shape[0]), int(image.shape[1])], "face": None, "liveness": None,
        }
        detections = self._detect(image)
        result["faces_detected"] = len(detections)
        if not detections:
            result["error"] = ERROR_NO_FACE
            return result
        bbox, score, kps = detections[0]
        if len(detections) > 1:
            areas = [float((b[2] - b[0]) * (b[3] - b[1])) for b, _, _ in detections[:2]]
            result["secondary_face_ratio"] = areas[1] / areas[0] if areas[0] > 0 else 0.0
        face = self._face_dict(image, bbox, score, kps)
        if not face["embedding"]:
            result["error"] = ERROR_NO_FACE
            return result
        result["face"] = face
        result["ok"] = True
        if with_liveness and self.liveness_available:
            try:
                result["liveness"] = self._liveness.score(image, face["bbox"])
            except Exception:
                logger.exception("Anti-spoof scoring failed for frame %d", index)
        return result

    # -- engine API ----------------------------------------------------------------------
    def process_frames(self, frames_b64: list[str], *, with_liveness: bool) -> list[dict[str, Any]]:
        """Decode and analyse every frame (sync, CPU-bound). Never raises for a bad frame."""
        results = []
        for i, data in enumerate(frames_b64 or []):
            try:
                image = decode_frame(data)
            except FrameError as exc:
                logger.debug("frame %d rejected: %s", i, exc)
                results.append({"index": i, "ok": False, "error": exc.code, "faces_detected": 0,
                                "secondary_face_ratio": 0.0, "image_shape": None, "face": None, "liveness": None})
                continue
            try:
                results.append(self.analyze_image(image, with_liveness=with_liveness, index=i))
            except Exception:
                logger.exception("Face analysis failed for frame %d", i)
                results.append({"index": i, "ok": False, "error": ERROR_INVALID_IMAGE, "faces_detected": 0,
                                "secondary_face_ratio": 0.0, "image_shape": [int(image.shape[0]), int(image.shape[1])],
                                "face": None, "liveness": None})
        return results

    async def aprocess_frames(self, frames_b64: list[str], *, with_liveness: bool) -> list[dict[str, Any]]:
        """``process_frames`` in a worker thread, at most ``settings.face_max_concurrency`` at once."""
        func = functools.partial(self.process_frames, list(frames_b64 or []), with_liveness=with_liveness)
        return await anyio.to_thread.run_sync(func, limiter=_get_limiter())

    # -- legacy helpers ------------------------------------------------------------------
    def decode_base64_image(self, base64_string: str) -> np.ndarray:
        """Legacy: base64 -> BGR image. Raises ``ValueError("Invalid image data")``."""
        try:
            return decode_frame(base64_string)
        except FrameError:
            raise ValueError("Invalid image data") from None

    def detect_faces(self, image: np.ndarray) -> list[dict[str, Any]]:
        """Legacy: every face (``det_score >= 0.5``) with its embedding, highest confidence first."""
        try:
            image = downscale(image)
            faces = []
            for bbox, score, kps in self._detect(image):
                if kps is None:
                    continue
                faces.append(self._face_dict(image, bbox, score, kps))
            faces.sort(key=lambda f: f["det_score"], reverse=True)
            for i, f in enumerate(faces):
                f["index"] = i
            return faces
        except Exception:
            logger.exception("Face detection failed")
            return []

    def extract_face_features(self, image: np.ndarray) -> Optional[dict[str, Any]]:
        """Legacy: the largest face (engine ``face`` dict plus ``embedding_norm``) or ``None``."""
        try:
            image = downscale(image)
            for bbox, score, kps in self._detect(image):
                if kps is not None:
                    return self._face_dict(image, bbox, score, kps)
            return None
        except Exception:
            logger.exception("Face feature extraction failed")
            return None

    def extract_face_embedding(self, image: np.ndarray) -> Optional[list[float]]:
        face = self.extract_face_features(image)
        return face["embedding"] if face else None

    def compare_embeddings(self, known_embeddings, unknown_embedding) -> tuple[bool, float, int]:
        """Legacy: ``(is_match, best_similarity_pct, best_index)`` against ``self.tolerance``."""
        known = list(known_embeddings) if known_embeddings is not None else []
        idx, sim = best_match_index(known, unknown_embedding if unknown_embedding is not None else [])
        if idx < 0:
            return False, 0.0, -1
        return bool(sim > self.tolerance), float(sim * 100.0), int(idx)

    def get_model_info(self) -> dict[str, Any]:
        return {
            "status": "initialized",
            "model_id": self.model_id,
            "detection_model": type(self.det_model).__name__,
            "recognition_model": type(self.rec_model).__name__,
            "available_models": list(self.app.models.keys()),
            "det_size": self.det_size,
            "liveness_available": self.liveness_available,
            "antispoof_models": self._liveness.model_names,
            "tolerance": str(self.tolerance),
            "confidence_threshold": str(self.confidence_threshold),
        }


# --------------------------------------------------------------------------- concurrency

_limiter: Optional[anyio.CapacityLimiter] = None
_limiter_loop: Optional[weakref.ReferenceType] = None


def _get_limiter() -> anyio.CapacityLimiter:
    """Module-level limiter, created lazily inside the running event loop (anyio limiters
    can't be created at import time) and re-created if the loop changes (tests, reloads)."""
    global _limiter, _limiter_loop
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if _limiter is None or _limiter_loop is None or _limiter_loop() is not loop:
        _limiter = anyio.CapacityLimiter(max(1, int(settings.face_max_concurrency)))
        _limiter_loop = weakref.ref(loop) if loop is not None else None
    return _limiter


# --------------------------------------------------------------------------- singleton

try:
    insightface_service: Optional[InsightFaceService] = InsightFaceService()
except Exception as exc:  # missing models / onnxruntime problems: endpoints report "unavailable"
    logger.error("Failed to initialize the face engine: %s", exc)
    insightface_service = None

__all__ = [
    "InsightFaceService", "insightface_service", "MODEL_ID", "FrameError", "decode_frame", "downscale",
    "face_crop_stats", "cosine_similarity", "best_similarity", "yaw_from_kps", "composite_embedding",
]
