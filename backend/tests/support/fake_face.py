"""Model-free stand-in for ``app.services.insightface_service``.

The real module loads InsightFace ONNX models at import time (seconds, and it downloads
them on a clean machine) through the module-level singleton ``insightface_service``.
``install()`` registers this fake under the real module name in ``sys.modules`` *before*
``app`` is imported, so every ``from app.services.insightface_service import
insightface_service`` gets the fake instead. It implements the engine API of
docs/system/face-verification.md §3 (``process_frames`` / ``aprocess_frames``, ``model_id``,
``liveness_available``) plus the legacy helpers.

Tests drive it through the ``fake_face`` fixture::

    fake_face.set_face(embedding=student_embedding)            # every frame shows this face
    fake_face.set_frames([frontal(emb), turned(emb, "left")])   # per-frame control for a burst
    fake_face.set_no_face()                                     # no face in any frame
    fake_face.liveness_available = False                       # anti-spoof models "missing"

Frames beyond the ``set_frames`` list reuse its last entry. A frame spec is a dict of
face-field overrides (see ``face_spec``) or ``None`` for "no face in this frame".
"""
from __future__ import annotations

import base64
import math
import sys
import types
from typing import Any, Optional

from app.services.face_math import best_match_index, cosine_similarity

MODULE_NAME = "app.services.insightface_service"
EMBEDDING_DIM = 512
MODEL_ID = "insightface/buffalo_l"

#: ``face_verification`` setting with every anti-fraud layer off (no presence code, head turn or
#: passive liveness): one legacy ``image_data`` frame checks in. Use with the ``face_policy``
#: fixture in tests whose subject is the attendance rules, not the biometric layer.
RELAXED_FACE_POLICY = {"require_presence_code": False, "require_head_turn": False, "require_liveness": False}


def unit_embedding(seed: int, dim: int = EMBEDDING_DIM) -> list[float]:
    """Deterministic embedding; different seeds give (nearly) orthogonal vectors."""
    vec = [0.0] * dim
    vec[seed % dim] = 1.0
    vec[(seed * 7 + 3) % dim] += 0.25
    norm = math.sqrt(sum(v * v for v in vec))
    return [v / norm for v in vec]


def blend(a: list[float], b: list[float], weight_b: float) -> list[float]:
    """Unit vector between ``a`` and ``b`` (``weight_b`` in [0, 1]); handy for borderline scores."""
    v = [(1 - weight_b) * x + weight_b * y for x, y in zip(a, b)]
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v]


def face_spec(embedding: Optional[list[float]] = None, *, yaw: float = 0.0, liveness: Optional[float] = 0.95,
              det_score: float = 0.99, sharpness: float = 150.0, brightness: float = 128.0,
              width: float = 240.0, height: float = 280.0, faces_detected: int = 1,
              secondary_face_ratio: float = 0.0, error: Optional[str] = None) -> dict[str, Any]:
    """Frame spec for ``set_frames`` (all fields optional)."""
    return {
        "embedding": list(embedding) if embedding is not None else None, "yaw": yaw, "liveness": liveness,
        "det_score": det_score, "sharpness": sharpness, "brightness": brightness, "width": width,
        "height": height, "faces_detected": faces_detected, "secondary_face_ratio": secondary_face_ratio,
        "error": error,
    }


def frontal(embedding: list[float], **kw: Any) -> dict[str, Any]:
    return face_spec(embedding, yaw=kw.pop("yaw", 0.0), **kw)


def turned(embedding: list[float], direction: str = "left", amount: float = 0.30, **kw: Any) -> dict[str, Any]:
    """A frame with the head turned to the subject's ``left`` (yaw > 0) or ``right`` (yaw < 0)."""
    return face_spec(embedding, yaw=amount if direction == "left" else -amount, **kw)


def checkin_burst(embedding: list[float], direction: str = "left", **kw: Any) -> list[dict[str, Any]]:
    """frontal, frontal, turned: satisfies the default policy for the given challenge direction."""
    return [frontal(embedding, **kw), frontal(embedding, **kw), turned(embedding, direction, **kw)]


def enrolment_burst(embedding: list[float], **kw: Any) -> list[dict[str, Any]]:
    """front, left, right (one of each pose)."""
    return [frontal(embedding, **kw), turned(embedding, "left", **kw), turned(embedding, "right", **kw)]


class _FakeImage:
    """Minimal ndarray-like object: callers only read ``image.shape``."""

    def __init__(self, height: int = 480, width: int = 640):
        self.shape = (height, width, 3)


class FakeInsightFaceService:
    """Deterministic, configurable replacement for ``InsightFaceService``."""

    IMAGE_H, IMAGE_W = 480, 640

    def __init__(self) -> None:
        self.app = object()
        self.model_id = MODEL_ID
        self.tolerance = 0.6
        self.confidence_threshold = 0.6
        self.calls: list[tuple[str, tuple]] = []
        self.reset()

    # -- test controls -------------------------------------------------
    def reset(self) -> None:
        self.calls = []
        self.liveness_available = True
        self._frames: list[Optional[dict[str, Any]]] = [face_spec(unit_embedding(1))]

    def set_face(self, embedding: Optional[list[float]] = None, confidence: float = 0.99, **kw: Any) -> None:
        """Every frame shows one face (frontal unless ``yaw`` is given)."""
        self._frames = [face_spec(embedding or unit_embedding(1), det_score=confidence, **kw)]

    def set_frames(self, specs: list[Optional[dict[str, Any]]]) -> None:
        if not specs:
            raise ValueError("set_frames needs at least one spec")
        self._frames = [dict(s) if s is not None else None for s in specs]

    def set_no_face(self) -> None:
        self._frames = [None]

    def _spec(self, index: int) -> Optional[dict[str, Any]]:
        return self._frames[min(index, len(self._frames) - 1)]

    def _face_from_spec(self, spec: dict[str, Any]) -> dict[str, Any]:
        w, h = float(spec["width"]), float(spec["height"])
        x1, y1 = (self.IMAGE_W - w) / 2, (self.IMAGE_H - h) / 2
        emb = spec["embedding"] if spec["embedding"] is not None else unit_embedding(1)
        cx = x1 + w / 2
        eye_dist = w * 0.4
        nose_x = cx + float(spec["yaw"]) * eye_dist
        kps = [[cx - eye_dist / 2, y1 + h * 0.4], [cx + eye_dist / 2, y1 + h * 0.4], [nose_x, y1 + h * 0.6],
               [cx - eye_dist / 2.5, y1 + h * 0.8], [cx + eye_dist / 2.5, y1 + h * 0.8]]
        return {
            "bbox": [x1, y1, x1 + w, y1 + h],
            "det_score": float(spec["det_score"]),
            "confidence": float(spec["det_score"]),
            "kps": kps,
            "embedding": list(emb),
            "width": w,
            "height": h,
            "area": w * h,
            "area_ratio": (w * h) / (self.IMAGE_W * self.IMAGE_H),
            "yaw": float(spec["yaw"]),
            "sharpness": float(spec["sharpness"]),
            "brightness": float(spec["brightness"]),
            "embedding_norm": math.sqrt(sum(v * v for v in emb)),
        }

    @staticmethod
    def _check_b64(data: str) -> bool:
        payload = data.split(",", 1)[1] if "," in (data or "") else (data or "")
        if not payload:
            return False
        try:
            base64.b64decode(payload, validate=False)
        except Exception:
            return False
        return True

    # -- engine API (docs/system/face-verification.md §3) ---------------
    def process_frames(self, frames_b64: list[str], *, with_liveness: bool) -> list[dict[str, Any]]:
        self.calls.append(("process_frames", (len(frames_b64 or []), with_liveness)))
        results = []
        for i, data in enumerate(frames_b64 or []):
            spec = self._spec(i)
            base = {"index": i, "image_shape": [self.IMAGE_H, self.IMAGE_W], "liveness": None}
            if not self._check_b64(data) or (spec is not None and spec.get("error") == "invalid_image"):
                results.append({**base, "ok": False, "error": "invalid_image", "faces_detected": 0,
                                "secondary_face_ratio": 0.0, "face": None, "image_shape": None})
                continue
            if spec is None or spec.get("error") == "no_face":
                results.append({**base, "ok": False, "error": "no_face", "faces_detected": 0,
                                "secondary_face_ratio": 0.0, "face": None})
                continue
            face = self._face_from_spec(spec)
            liveness = spec.get("liveness") if (with_liveness and self.liveness_available) else None
            results.append({**base, "ok": True, "error": None, "faces_detected": int(spec["faces_detected"]),
                            "secondary_face_ratio": float(spec["secondary_face_ratio"]), "face": face,
                            "liveness": None if liveness is None else float(liveness)})
        return results

    async def aprocess_frames(self, frames_b64: list[str], *, with_liveness: bool) -> list[dict[str, Any]]:
        return self.process_frames(frames_b64, with_liveness=with_liveness)

    # -- legacy helpers ------------------------------------------------
    def decode_base64_image(self, base64_string: str) -> _FakeImage:
        self.calls.append(("decode_base64_image", ()))
        if not self._check_b64(base64_string):
            raise ValueError("Invalid image data")
        return _FakeImage(self.IMAGE_H, self.IMAGE_W)

    def detect_faces(self, image: Any) -> list[dict[str, Any]]:
        self.calls.append(("detect_faces", ()))
        spec = self._spec(0)
        return [self._face_from_spec(spec)] if spec is not None else []

    def extract_face_features(self, image: Any) -> Optional[dict[str, Any]]:
        self.calls.append(("extract_face_features", ()))
        faces = self.detect_faces(image)
        return faces[0] if faces else None

    def extract_face_embedding(self, image: Any) -> Optional[list[float]]:
        face = self.extract_face_features(image)
        return face["embedding"] if face else None

    def compare_embeddings(self, known_embeddings, unknown_embedding) -> tuple[bool, float, int]:
        self.calls.append(("compare_embeddings", ()))
        idx, sim = best_match_index(list(known_embeddings or []), unknown_embedding or [])
        if idx < 0:
            return False, 0.0, -1
        return bool(sim > self.tolerance), float(sim * 100), int(idx)

    def get_model_info(self) -> dict[str, Any]:
        return {
            "status": "initialized",
            "model_id": self.model_id,
            "detection_model": "FakeDetector",
            "recognition_model": "FakeRecognizer",
            "available_models": ["fake"],
            "liveness_available": self.liveness_available,
        }


def install() -> FakeInsightFaceService:
    """Register the fake module in ``sys.modules`` (idempotent). Must run before importing ``app``."""
    existing = sys.modules.get(MODULE_NAME)
    if existing is not None and getattr(existing, "__attendai_fake__", False):
        return existing.insightface_service
    if existing is not None:
        raise RuntimeError(f"{MODULE_NAME} was imported before the test stub could be installed")
    module = types.ModuleType(MODULE_NAME)
    module.__doc__ = "pytest stub for app.services.insightface_service (see tests/support/fake_face.py)"
    module.__attendai_fake__ = True
    module.InsightFaceService = FakeInsightFaceService
    module.insightface_service = FakeInsightFaceService()
    # Re-export the pure helpers, like the real module does.
    from app.services import face_math as _fm
    for name in ("cosine_similarity", "best_similarity", "yaw_from_kps", "composite_embedding"):
        setattr(module, name, getattr(_fm, name))
    sys.modules[MODULE_NAME] = module
    return module.insightface_service


__all__ = [
    "FakeInsightFaceService", "install", "unit_embedding", "blend", "face_spec", "frontal", "turned",
    "checkin_burst", "enrolment_burst", "cosine_similarity", "MODEL_ID", "RELAXED_FACE_POLICY",
]
