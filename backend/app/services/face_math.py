"""Pure face-verification helpers (docs/system/face-verification.md §3).

No model is loaded here, so domain services and tests can import this module freely
(``app.services.insightface_service`` is replaced by a stub in tests).

* Embeddings are plain ``list[float]`` / 1-D arrays; similarities are raw cosine values.
* ``yaw_from_kps`` works on the SCRFD 5-point landmarks of an **unmirrored** camera image:
  ``> 0`` means the subject turned to *their* left, ``< 0`` to their right.
"""
from __future__ import annotations

from typing import Iterable, Optional, Sequence

import numpy as np

Vector = Sequence[float]


def _as_vec(v: Vector) -> np.ndarray:
    return np.asarray(v, dtype=np.float64).reshape(-1)


def l2_normalize(v: Vector) -> list[float]:
    """Unit-length copy of ``v`` (a zero vector is returned unchanged)."""
    arr = _as_vec(v)
    norm = float(np.linalg.norm(arr))
    return (arr / norm).tolist() if norm > 0 else arr.tolist()


def cosine_similarity(a: Vector, b: Vector) -> float:
    """Raw cosine similarity in ``[-1, 1]``; ``0.0`` for empty, mismatched or zero vectors."""
    if a is None or b is None:
        return 0.0
    va, vb = _as_vec(a), _as_vec(b)
    if va.size == 0 or va.size != vb.size:
        return 0.0
    na, nb = float(np.linalg.norm(va)), float(np.linalg.norm(vb))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


def best_similarity(templates: Iterable[Optional[Vector]], embedding: Vector) -> float:
    """Max cosine similarity of ``embedding`` against ``templates`` (``0.0`` when there are none).

    ``None`` / empty templates are skipped.
    """
    best = None
    for t in (templates if templates is not None else ()):  # not `or`: numpy arrays are allowed
        if t is None or len(t) == 0:
            continue
        s = cosine_similarity(t, embedding)
        best = s if best is None else max(best, s)
    return 0.0 if best is None else best


def best_match_index(templates: Sequence[Optional[Vector]], embedding: Vector) -> tuple[int, float]:
    """``(index, similarity)`` of the best template; ``(-1, 0.0)`` when there are none."""
    best_i, best_s = -1, 0.0
    for i, t in enumerate(templates if templates is not None else ()):
        if t is None or len(t) == 0:
            continue
        s = cosine_similarity(t, embedding)
        if best_i < 0 or s > best_s:
            best_i, best_s = i, s
    return best_i, best_s


def composite_embedding(embeddings: Iterable[Vector]) -> list[float]:
    """L2-normalised mean of L2-normalised embeddings (the stored composite template)."""
    rows = [np.asarray(l2_normalize(e), dtype=np.float64) for e in embeddings if e is not None and len(e)]
    if not rows:
        raise ValueError("composite_embedding needs at least one embedding")
    return l2_normalize(np.mean(np.stack(rows), axis=0))


def yaw_from_kps(kps: Optional[Sequence[Sequence[float]]]) -> float:
    """Head-turn proxy from SCRFD 5-point landmarks (eye L, eye R, nose, mouth L, mouth R).

    ``(nose.x - eye_mid.x) / eye_distance``. ≈0 frontal; ~0.2-0.4 for a clear 20-35° turn.
    Returns ``0.0`` when landmarks are missing or degenerate.
    """
    if kps is None or len(kps) < 3:
        return 0.0
    (lx, ly), (rx, ry), (nx, _ny) = kps[0][:2], kps[1][:2], kps[2][:2]
    eye_dist = float(np.hypot(rx - lx, ry - ly))
    if eye_dist <= 1e-6:
        return 0.0
    mid_x = (lx + rx) / 2.0
    return float((nx - mid_x) / eye_dist)


def classify_pose(yaw: float, *, frontal_max_yaw: float, turn_min_yaw: float) -> Optional[str]:
    """``front`` / ``left`` / ``right`` (subject's perspective) or ``None`` for in-between angles."""
    if abs(yaw) <= frontal_max_yaw:
        return "front"
    if yaw >= turn_min_yaw:
        return "left"
    if yaw <= -turn_min_yaw:
        return "right"
    return None


def antispoof_crop_box(img_w: int, img_h: int, bbox_xyxy: Sequence[float], scale: float) -> tuple[int, int, int, int]:
    """Silent-Face ``CropImage._get_new_box`` for an ``[x1, y1, x2, y2]`` bbox.

    Returns ``(x1, y1, x2, y2)`` inclusive pixel coordinates of the expanded square-ish crop,
    shifted to stay inside the image.
    """
    x, y = float(bbox_xyxy[0]), float(bbox_xyxy[1])
    box_w = max(float(bbox_xyxy[2]) - x + 1.0, 1.0)
    box_h = max(float(bbox_xyxy[3]) - y + 1.0, 1.0)
    scale = min((img_h - 1) / box_h, min((img_w - 1) / box_w, scale))
    new_w, new_h = box_w * scale, box_h * scale
    cx, cy = box_w / 2 + x, box_h / 2 + y
    x1, y1 = cx - new_w / 2, cy - new_h / 2
    x2, y2 = cx + new_w / 2, cy + new_h / 2
    if x1 < 0:
        x2 -= x1
        x1 = 0
    if y1 < 0:
        y2 -= y1
        y1 = 0
    if x2 > img_w - 1:
        x1 -= x2 - img_w + 1
        x2 = img_w - 1
    if y2 > img_h - 1:
        y1 -= y2 - img_h + 1
        y2 = img_h - 1
    return int(x1), int(y1), int(x2), int(y2)


def quality_issues(
    face: dict,
    *,
    min_detection_score: float,
    min_face_size_px: float,
    min_sharpness: float,
    min_brightness: float,
    max_brightness: float,
) -> list[str]:
    """Quality-gate issue codes for one engine ``face`` dict (empty list = acceptable).

    Codes: ``low_confidence``, ``too_small``, ``too_blurry``, ``too_dark``, ``too_bright``.
    Missing measurements are not treated as failures.
    """
    issues: list[str] = []
    det = face.get("det_score", face.get("confidence"))
    if det is not None and float(det) < min_detection_score:
        issues.append("low_confidence")
    w, h = face.get("width"), face.get("height")
    if w is not None and h is not None and min(float(w), float(h)) < min_face_size_px:
        issues.append("too_small")
    sharp = face.get("sharpness")
    if sharp is not None and float(sharp) < min_sharpness:
        issues.append("too_blurry")
    bright = face.get("brightness")
    if bright is not None:
        if float(bright) < min_brightness:
            issues.append("too_dark")
        elif float(bright) > max_brightness:
            issues.append("too_bright")
    return issues
