"""Centralized facial recognition thresholds and quality parameters.

All modules (services, routers) should import from here instead of hard-coding
numeric literals, enabling consistent tuning and A/B experimentation.

Definitions:
    DETECTION_MIN_CONFIDENCE: Minimum detector confidence to accept a face box.
    REGISTRATION_MIN_CONFIDENCE: Stricter confidence required when persisting an embedding.
    SIMILARITY_THRESHOLD: Cosine similarity (raw) required for positive identity match.
    LIVE_SIMILARITY_THRESHOLD: Slightly lower threshold for provisional/live feedback.
    EXCELLENT_MATCH_THRESHOLD / GOOD_MATCH_THRESHOLD: Buckets for UI quality labels.
    MIN_EMBEDDING_NORM: Lower bound of embedding vector norm to consider features valid.
    MIN_FACE_PIXEL_SIZE: Minimum width/height in pixels of detected face for quality.
    MIN_FACE_AREA_PERCENT / MAX_FACE_AREA_PERCENT: Frame coverage bounds (percent of total image area).
    MAX_CENTER_OFFSET: Allowed normalized offset of face center from image center.
    MAX_DECODE_DIMENSION: Cap on largest side during decode to avoid excessive CPU cost.

Note: SIMILARITY_THRESHOLD aligns with settings.face_recognition_tolerance (0.6) at
initialization; adjust here then remove per-file changes.
"""

# Detection & Registration
DETECTION_MIN_CONFIDENCE: float = 0.6
REGISTRATION_MIN_CONFIDENCE: float = 0.7

# Similarity thresholds (raw cosine values, NOT percentages)
SIMILARITY_THRESHOLD: float = 0.6
LIVE_SIMILARITY_THRESHOLD: float = 0.55

# Quality categorization (raw cosine)
EXCELLENT_MATCH_THRESHOLD: float = 0.80
GOOD_MATCH_THRESHOLD: float = 0.70

# Embedding quality
MIN_EMBEDDING_NORM: float = 0.10

# Face geometry / placement
MIN_FACE_PIXEL_SIZE: int = 80
MIN_FACE_AREA_PERCENT: float = 5.0
MAX_FACE_AREA_PERCENT: float = 70.0
MAX_CENTER_OFFSET: float = 0.30

# Decode / performance safeguards
MAX_DECODE_DIMENSION: int = 1280  # Downscale larger images to reduce inference time

__all__ = [
    "DETECTION_MIN_CONFIDENCE",
    "REGISTRATION_MIN_CONFIDENCE",
    "SIMILARITY_THRESHOLD",
    "LIVE_SIMILARITY_THRESHOLD",
    "EXCELLENT_MATCH_THRESHOLD",
    "GOOD_MATCH_THRESHOLD",
    "MIN_EMBEDDING_NORM",
    "MIN_FACE_PIXEL_SIZE",
    "MIN_FACE_AREA_PERCENT",
    "MAX_FACE_AREA_PERCENT",
    "MAX_CENTER_OFFSET",
    "MAX_DECODE_DIMENSION",
]
