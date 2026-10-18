"""Passive face anti-spoofing with Minivision Silent-Face MiniFASNet (ONNX, CPU).

docs/system/face-verification.md §2. Only ``app.services.insightface_service`` imports this
module; everything else reaches liveness through the engine singleton.

Two models, each looking at a differently scaled crop around the detected face:

* ``minifasnet_v2_2.7_80x80.onnx``   (MiniFASNetV2,   crop scale 2.7)
* ``minifasnet_v1se_4.0_80x80.onnx`` (MiniFASNetV1SE, crop scale 4.0)

Preprocessing matches the original Silent-Face code (``src/generate_patches.py`` and
``src/data_io/functional.py``): expand the box with ``face_math.antispoof_crop_box``, crop
``[y1:y2+1, x1:x2+1]``, ``cv2.resize`` to 80x80 (bilinear), keep **BGR float32 without dividing
by 255**, NCHW. The output is 3 logits; softmax class 1 is "real". The score is the mean
"real" probability over both models.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional, Sequence

import cv2
import numpy as np

from app.core.face_constants import ANTISPOOF_INPUT_SIZE
from app.services.face_math import antispoof_crop_box

logger = logging.getLogger(__name__)

#: ``(file name, crop scale)`` of the ensemble, in the order the scores are averaged.
MODEL_SPECS: tuple[tuple[str, float], ...] = (
    ("minifasnet_v2_2.7_80x80.onnx", 2.7),
    ("minifasnet_v1se_4.0_80x80.onnx", 4.0),
)
REAL_CLASS = 1
BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_DIR = BACKEND_DIR / "models" / "anti_spoof"


def resolve_model_dir(configured: Optional[str] = None) -> Path:
    """``settings.antispoof_model_dir``: empty = ``backend/models/anti_spoof``; relative paths
    are resolved against the backend folder."""
    if not configured:
        return DEFAULT_MODEL_DIR
    path = Path(configured).expanduser()
    return path if path.is_absolute() else (BACKEND_DIR / path)


def _softmax(logits: np.ndarray) -> np.ndarray:
    z = logits - logits.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def preprocess(image_bgr: np.ndarray, bbox_xyxy: Sequence[float], scale: float,
               size: int = ANTISPOOF_INPUT_SIZE) -> Optional[np.ndarray]:
    """Silent-Face crop for one model: ``(1, 3, size, size)`` float32 BGR (0-255), or ``None``
    when the crop is empty."""
    h, w = image_bgr.shape[:2]
    x1, y1, x2, y2 = antispoof_crop_box(w, h, bbox_xyxy, scale)
    x1, y1 = max(x1, 0), max(y1, 0)
    patch = image_bgr[y1:y2 + 1, x1:x2 + 1]
    if patch.size == 0 or patch.shape[0] < 2 or patch.shape[1] < 2:
        return None
    patch = cv2.resize(patch, (size, size))
    return np.ascontiguousarray(patch.astype(np.float32).transpose(2, 0, 1)[None])


class AntiSpoofModel:
    """One MiniFASNet ONNX session plus its crop scale."""

    def __init__(self, path: Path, scale: float, providers: Sequence[str]):
        import onnxruntime as ort

        options = ort.SessionOptions()
        # 80x80 inputs: a big intra-op thread pool costs more in hand-off than it saves.
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.log_severity_level = 3
        self.path = Path(path)
        self.scale = float(scale)
        self.session = ort.InferenceSession(str(self.path), sess_options=options, providers=list(providers))
        self.input_name = self.session.get_inputs()[0].name

    def real_probability(self, image_bgr: np.ndarray, bbox_xyxy: Sequence[float]) -> Optional[float]:
        blob = preprocess(image_bgr, bbox_xyxy, self.scale)
        if blob is None:
            return None
        logits = self.session.run(None, {self.input_name: blob})[0]
        return float(_softmax(np.asarray(logits, dtype=np.float64))[0, REAL_CLASS])


class AntiSpoofRunner:
    """The two-model ensemble. ``available`` is False when either model can't be loaded."""

    def __init__(self, model_dir: Optional[Path | str] = None, providers: Sequence[str] = ("CPUExecutionProvider",)):
        self.model_dir = Path(model_dir) if model_dir is not None else DEFAULT_MODEL_DIR
        self.models: list[AntiSpoofModel] = []
        self.available = False
        missing = [name for name, _ in MODEL_SPECS if not (self.model_dir / name).is_file()]
        if missing:
            logger.warning("Anti-spoof models missing in %s (%s); liveness is unavailable",
                           self.model_dir, ", ".join(missing))
            return
        try:
            self.models = [AntiSpoofModel(self.model_dir / name, scale, providers) for name, scale in MODEL_SPECS]
        except Exception as exc:  # corrupt file, onnxruntime missing...
            logger.warning("Could not load the anti-spoof models from %s: %s; liveness is unavailable",
                           self.model_dir, exc)
            self.models = []
            return
        self.available = True

    @property
    def model_names(self) -> list[str]:
        return [m.path.name for m in self.models]

    def score(self, image_bgr: np.ndarray, bbox_xyxy: Sequence[float]) -> Optional[float]:
        """Mean "real" probability in ``[0, 1]`` over both models; ``None`` if unavailable or the
        face crop is empty."""
        if not self.available:
            return None
        probs = []
        for model in self.models:
            p = model.real_probability(image_bgr, bbox_xyxy)
            if p is None:
                return None
            probs.append(p)
        return float(np.mean(probs))


__all__ = ["AntiSpoofModel", "AntiSpoofRunner", "MODEL_SPECS", "DEFAULT_MODEL_DIR", "preprocess", "resolve_model_dir"]
