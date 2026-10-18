"""Fixed face-engine limits and legacy recognition thresholds.

Tunable verification thresholds (match, liveness, quality gate, head turn...) are **not**
here: they live in the ``face_verification`` system setting (``app/services/face_policy.py``,
docs/system/face-verification.md §4). This module holds the engine's input limits and the
constants older endpoints still import.

Engine input limits (docs/system/face-verification.md §3):
    MAX_FRAME_BASE64_CHARS: a frame string longer than this is rejected as ``invalid_image``.
    MAX_DECODE_PIXELS: decoded images with more pixels than this are rejected (decompression bombs).
    MAX_DECODE_DIMENSION: larger images are downscaled to this longest side before detection.
    FACE_COUNT_MIN_DET_SCORE: detections at or above this score count in ``faces_detected``.
    QUALITY_CROP_SIZE: the face crop is resized to this square before sharpness/brightness.
    ANTISPOOF_INPUT_SIZE: MiniFASNet input (square, pixels).

Legacy:
    DETECTION_MIN_CONFIDENCE: ``insightface_service.confidence_threshold`` for the legacy helpers.
"""

# -- Engine input limits ------------------------------------------------------------------
MAX_FRAME_BASE64_CHARS: int = 3_000_000
MAX_DECODE_PIXELS: int = 40_000_000
MAX_DECODE_DIMENSION: int = 1280
FACE_COUNT_MIN_DET_SCORE: float = 0.5
QUALITY_CROP_SIZE: int = 112
ANTISPOOF_INPUT_SIZE: int = 80

# -- Legacy ----------------------------------------------------------------------------------
DETECTION_MIN_CONFIDENCE: float = 0.6

__all__ = [
    "MAX_FRAME_BASE64_CHARS",
    "MAX_DECODE_PIXELS",
    "MAX_DECODE_DIMENSION",
    "FACE_COUNT_MIN_DET_SCORE",
    "QUALITY_CROP_SIZE",
    "ANTISPOOF_INPUT_SIZE",
    "DETECTION_MIN_CONFIDENCE",
]
