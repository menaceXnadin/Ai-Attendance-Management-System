"""Calibrate the face match threshold from a labelled photo folder.

docs/system/face-verification.md §4: ``match_threshold`` (default 0.45) and
``duplicate_threshold`` are defaults, not calibrated values. This script embeds one face per
image with the real engine (InsightFace ``buffalo_l``, the same decode / downscale /
detection path as check-in), compares every pair of images and prints:

* how many images were usable (no face, unreadable or low-confidence images are skipped);
* the genuine (same person) and impostor (different people) cosine-similarity distributions;
* FAR (impostor pairs accepted, similarity >= t) and FRR (genuine pairs rejected, < t) for
  t = 0.20, 0.25, ..., 0.80;
* the lowest threshold whose FAR is at or below ``--target-far`` (searched in 0.01 steps),
  with its FRR.

Usage (from ``backend/``)::

    venv/Scripts/python.exe scripts/calibrate_face_threshold.py <folder> [--target-far 0.001]
                                                               [--det-size 640] [--min-det-score 0.6]

Folder layout: one sub-folder per person, any number of images inside::

    <folder>/alice/1.jpg, <folder>/alice/2.png, <folder>/bob/selfie.jpg, ...

Notes:

* Use photos like real check-ins (webcam selfies, the same lighting and distance) and at least
  two images per person; people with one image only contribute impostor pairs.
* To claim a FAR of ``p`` you need roughly ``3 / p`` impostor pairs with no false accept
  (3,000 pairs for 0.001); the script warns when there are fewer.
* Check-in compares a frame with several templates (the composite plus per-pose templates),
  which scores a little higher than these image-to-image pairs, so this recommendation is
  slightly conservative.
* No database access: the script only needs the model files. It runs from any directory.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
TABLE_THRESHOLDS = [round(0.20 + 0.05 * i, 2) for i in range(13)]  # 0.20 .. 0.80
PERCENTILES = [0, 1, 5, 25, 50, 75, 95, 99, 100]


def parse_args(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Genuine/impostor score distributions and FAR/FRR per threshold.")
    p.add_argument("folder", help="folder with one sub-folder of images per person")
    p.add_argument("--target-far", type=float, default=0.001, help="target false-accept rate (default 0.001)")
    p.add_argument("--det-size", type=int, default=640, help="SCRFD detection size (default 640)")
    p.add_argument("--min-det-score", type=float, default=0.6,
                   help="skip faces detected below this score (default 0.6, the check-in default)")
    args = p.parse_args(argv)
    if not 0 < args.target_far < 1:
        p.error("--target-far must be between 0 and 1")
    return args


def load_engine(det_size: int):
    """The real engine, without touching the database or requiring backend/.env."""
    os.environ["INSIGHTFACE_DET_SIZE"] = str(det_size)
    # Settings needs these to exist; the script never connects to anything.
    for key, value in (("DATABASE_URL", "postgresql+asyncpg://unused/unused"),
                       ("DATABASE_URL_SYNC", "postgresql://unused/unused"),
                       ("SECRET_KEY", "calibration-script"),
                       ("ALLOWED_ORIGINS", "[]")):
        os.environ.setdefault(key, value)
    os.chdir(BACKEND_DIR)  # .env and the relative upload dir resolve against backend/
    sys.path.insert(0, str(BACKEND_DIR))
    from app.services import insightface_service as engine_module

    engine = engine_module.insightface_service
    if engine is None:
        raise SystemExit("The face engine failed to load (see the log above).")
    return engine


def read_image(path: Path):
    import cv2
    import numpy as np

    data = np.fromfile(str(path), dtype=np.uint8)  # works with non-ASCII paths on Windows
    if data.size == 0:
        return None
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def collect(folder: Path) -> list[tuple[str, Path]]:
    items = []
    for person_dir in sorted(p for p in folder.iterdir() if p.is_dir()):
        for img in sorted(person_dir.rglob("*")):
            if img.is_file() and img.suffix.lower() in IMAGE_EXTENSIONS:
                items.append((person_dir.name, img))
    return items


def embed_all(engine, items, min_det_score: float):
    import numpy as np

    labels, embeddings, skipped = [], [], {"unreadable": 0, "no_face": 0, "low_confidence": 0}
    multi_face = 0
    for i, (person, path) in enumerate(items, 1):
        image = read_image(path)
        if image is None:
            skipped["unreadable"] += 1
            print(f"  skip (unreadable): {path}")
            continue
        result = engine.analyze_image(image, with_liveness=False)
        face = result.get("face")
        if not result.get("ok") or not face:
            skipped["no_face"] += 1
            print(f"  skip (no face): {path}")
            continue
        if face["det_score"] < min_det_score:
            skipped["low_confidence"] += 1
            print(f"  skip (det_score {face['det_score']:.2f}): {path}")
            continue
        if result["faces_detected"] > 1:
            multi_face += 1
        labels.append(person)
        embeddings.append(face["embedding"])
        if i % 25 == 0:
            print(f"  {i}/{len(items)} images processed")
    matrix = np.asarray(embeddings, dtype=np.float32).reshape(len(embeddings), -1)
    return labels, matrix, skipped, multi_face


def pair_scores(labels, matrix):
    import numpy as np

    n = len(labels)
    if n < 2:
        return np.empty(0), np.empty(0)
    sims = matrix @ matrix.T  # embeddings are L2-normalised => cosine similarity
    ids = np.unique(np.asarray(labels), return_inverse=True)[1]
    iu = np.triu_indices(n, k=1)
    same = ids[iu[0]] == ids[iu[1]]
    scores = sims[iu].astype(np.float64)
    return scores[same], scores[~same]


def far_frr(genuine, impostor, t: float) -> tuple[float | None, float | None]:
    far = float((impostor >= t).mean()) if impostor.size else None
    frr = float((genuine < t).mean()) if genuine.size else None
    return far, frr


def fmt_rate(x: float | None) -> str:
    return "   n/a" if x is None else f"{100 * x:6.2f}%"


def describe(name: str, scores) -> None:
    import numpy as np

    if scores.size == 0:
        print(f"{name:9s} pairs:       0")
        return
    pct = np.percentile(scores, PERCENTILES)
    cells = "  ".join(f"p{p}={v:+.3f}" for p, v in zip(PERCENTILES, pct))
    print(f"{name:9s} pairs: {scores.size:7d}  mean={scores.mean():+.3f}  {cells}")


def main(argv=None) -> int:
    args = parse_args(argv)
    folder = Path(args.folder).expanduser().resolve()
    if not folder.is_dir():
        print(f"Not a folder: {folder}", file=sys.stderr)
        return 2
    items = collect(folder)
    people = sorted({p for p, _ in items})
    print(f"Found {len(items)} images of {len(people)} people in {folder}")
    if not items:
        return 2

    t0 = time.perf_counter()
    engine = load_engine(args.det_size)
    print(f"Engine {engine.model_id} loaded in {time.perf_counter() - t0:.1f}s (det_size={engine.det_size})")

    t0 = time.perf_counter()
    labels, matrix, skipped, multi_face = embed_all(engine, items, args.min_det_score)
    print(f"Embedded {len(labels)} of {len(items)} images in {time.perf_counter() - t0:.1f}s; skipped: "
          + ", ".join(f"{k}={v}" for k, v in skipped.items()))
    if multi_face:
        print(f"Note: {multi_face} images had more than one face; the largest face was used.")
    usable_people = sorted(set(labels))
    per_person = {p: labels.count(p) for p in usable_people}
    print(f"Usable people: {len(usable_people)}; with >= 2 images: {sum(1 for c in per_person.values() if c >= 2)}")

    genuine, impostor = pair_scores(labels, matrix)
    print()
    describe("genuine", genuine)
    describe("impostor", impostor)
    if genuine.size == 0:
        print("No genuine pairs: add at least two images for some people. FRR can't be computed.")
    if impostor.size == 0:
        print("No impostor pairs: add images of at least two people. FAR can't be computed.")
        return 1

    print()
    print(" threshold     FAR      FRR")
    for t in TABLE_THRESHOLDS:
        far, frr = far_frr(genuine, impostor, t)
        print(f"   {t:.2f}    {fmt_rate(far)}  {fmt_rate(frr)}")

    print()
    needed = int(round(3 / args.target_far))
    if impostor.size < needed:
        print(f"Warning: {impostor.size} impostor pairs is too few to demonstrate FAR <= {args.target_far:g} "
              f"(need about {needed}); treat the recommendation as a rough estimate.")
    best = None
    for k in range(0, 101):
        t = k / 100
        far, frr = far_frr(genuine, impostor, t)
        if far is not None and far <= args.target_far:
            best = (t, far, frr)
            break
    if best is None:
        print(f"No threshold up to 1.00 reaches FAR <= {args.target_far:g}.")
        return 1
    t, far, frr = best
    print(f"Recommended match_threshold for FAR <= {args.target_far:g}: {t:.2f} "
          f"(FAR {fmt_rate(far).strip()}, FRR {fmt_rate(frr).strip()})")
    if impostor.size:
        print(f"Highest impostor score: {impostor.max():+.3f}. "
              f"Set duplicate_threshold at or above match_threshold (current default 0.45).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
