"""Pure face helpers (docs/system/face-verification.md §2-§3): similarity, composite templates,
yaw sign convention, pose classes, the Silent-Face anti-spoof crop box and the quality gate."""
from __future__ import annotations

import math
import random

import numpy as np
import pytest

from app.services.face_math import (
    antispoof_crop_box,
    best_match_index,
    best_similarity,
    classify_pose,
    composite_embedding,
    cosine_similarity,
    l2_normalize,
    quality_issues,
    yaw_from_kps,
)

E1 = [1.0, 0.0, 0.0, 0.0]
E2 = [0.0, 1.0, 0.0, 0.0]


def unit(*values: float) -> list[float]:
    n = math.sqrt(sum(v * v for v in values))
    return [v / n for v in values]


# =============================================================== cosine / best match


class TestCosineSimilarity:
    def test_identical_opposite_orthogonal(self):
        assert cosine_similarity(E1, E1) == pytest.approx(1.0)
        assert cosine_similarity(E1, [-1.0, 0, 0, 0]) == pytest.approx(-1.0)
        assert cosine_similarity(E1, E2) == pytest.approx(0.0)

    def test_scale_invariant_and_symmetric(self):
        a, b = [1.0, 2.0, 3.0], [2.0, -1.0, 0.5]
        assert cosine_similarity([10 * x for x in a], b) == pytest.approx(cosine_similarity(a, b))
        assert cosine_similarity(a, b) == pytest.approx(cosine_similarity(b, a))

    def test_known_value(self):
        assert cosine_similarity([1.0, 1.0], [1.0, 0.0]) == pytest.approx(1 / math.sqrt(2))

    @pytest.mark.parametrize("a,b", [
        (None, E1), (E1, None), (None, None),   # missing
        ([], []), ([], E1),                     # empty
        (E1, [1.0, 0.0]),                       # length mismatch
        ([0.0, 0.0, 0.0, 0.0], E1),             # zero vector
    ])
    def test_degenerate_inputs_are_zero(self, a, b):
        assert cosine_similarity(a, b) == 0.0

    def test_accepts_numpy_and_returns_python_float(self):
        s = cosine_similarity(np.array(E1, dtype=np.float32), np.array(unit(1, 1, 0, 0)))
        assert isinstance(s, float)
        assert s == pytest.approx(1 / math.sqrt(2), rel=1e-6)


class TestBestSimilarity:
    def test_max_over_templates(self):
        emb = unit(1, 1, 0, 0)
        assert best_similarity([E2, E1, [0, 0, 1, 0]], emb) == pytest.approx(1 / math.sqrt(2))
        assert best_similarity([E1, emb], emb) == pytest.approx(1.0)

    @pytest.mark.parametrize("templates", [[], None, [None], [[]], [None, []]])
    def test_no_usable_template_is_zero(self, templates):
        assert best_similarity(templates, E1) == 0.0

    def test_skips_missing_templates(self):
        assert best_similarity([None, [], E1], E1) == pytest.approx(1.0)

    def test_negative_best_is_not_clamped(self):
        assert best_similarity([[-1.0, 0, 0, 0]], E1) == pytest.approx(-1.0)

    def test_numpy_template_matrix(self):
        templates = np.array([E2, E1])
        assert best_similarity(templates, E1) == pytest.approx(1.0)


class TestBestMatchIndex:
    def test_index_and_similarity(self):
        idx, sim = best_match_index([E2, unit(1, 1, 0, 0), E1], E1)
        assert idx == 2 and sim == pytest.approx(1.0)

    def test_none_and_empty(self):
        assert best_match_index([], E1) == (-1, 0.0)
        assert best_match_index(None, E1) == (-1, 0.0)
        assert best_match_index([None, []], E1) == (-1, 0.0)

    def test_skipped_entries_keep_original_indices(self):
        assert best_match_index([None, [], E1], E1)[0] == 2

    def test_first_wins_on_ties_and_negative_best_is_returned(self):
        assert best_match_index([E1, E1], E1)[0] == 0
        idx, sim = best_match_index([[-1.0, 0, 0, 0]], E1)
        assert idx == 0 and sim == pytest.approx(-1.0)

    def test_numpy_template_matrix(self):
        assert best_match_index(np.array([E2, E1]), E1)[0] == 1


# =============================================================== normalisation / composite


class TestNormalisation:
    def test_l2_normalize(self):
        v = l2_normalize([3.0, 4.0])
        assert v == pytest.approx([0.6, 0.8])
        assert isinstance(v, list)

    def test_zero_vector_unchanged(self):
        assert l2_normalize([0.0, 0.0]) == [0.0, 0.0]

    def test_composite_is_unit_length_mean_of_unit_vectors(self):
        comp = composite_embedding([E1, E2])
        assert comp == pytest.approx(unit(1, 1, 0, 0))
        assert math.sqrt(sum(x * x for x in comp)) == pytest.approx(1.0)

    def test_composite_ignores_input_scale(self):
        # each embedding is normalised first, so a large-norm frame doesn't dominate
        assert composite_embedding([[100.0, 0, 0, 0], E2]) == pytest.approx(composite_embedding([E1, E2]))

    def test_composite_of_one_is_its_unit_copy(self):
        assert composite_embedding([[0.0, 2.0, 0.0, 0.0]]) == pytest.approx(E2)

    def test_composite_skips_missing(self):
        assert composite_embedding([None, [], E1]) == pytest.approx(E1)

    @pytest.mark.parametrize("embs", [[], [None], [[]]])
    def test_composite_needs_one_embedding(self, embs):
        with pytest.raises(ValueError):
            composite_embedding(embs)

    def test_composite_is_close_to_every_member(self):
        rng = np.random.default_rng(7)
        base = rng.normal(size=512)
        frames = [base + rng.normal(scale=0.3, size=512) for _ in range(5)]
        comp = composite_embedding(frames)
        assert all(cosine_similarity(comp, f) > 0.9 for f in frames)


# =============================================================== yaw / pose


def kps(eye_l=(100.0, 100.0), eye_r=(160.0, 100.0), nose=(130.0, 130.0)):
    return [list(eye_l), list(eye_r), list(nose), [110.0, 160.0], [150.0, 160.0]]


class TestYaw:
    def test_frontal_is_zero(self):
        assert yaw_from_kps(kps()) == pytest.approx(0.0)

    def test_sign_convention_unmirrored_image(self):
        # Nose to the image right of the eye midpoint = subject turned to THEIR left => yaw > 0.
        assert yaw_from_kps(kps(nose=(145.0, 130.0))) == pytest.approx(15 / 60)
        assert yaw_from_kps(kps(nose=(115.0, 130.0))) == pytest.approx(-15 / 60)

    def test_horizontal_flip_flips_sign(self):
        width = 300.0
        pts = kps(nose=(148.0, 131.0))
        flipped = [[width - x, y] for x, y in pts]
        flipped[0], flipped[1] = flipped[1], flipped[0]  # image-left eye stays first
        assert yaw_from_kps(flipped) == pytest.approx(-yaw_from_kps(pts))

    def test_eye_order_does_not_matter(self):
        pts = kps(nose=(140.0, 130.0))
        swapped = [pts[1], pts[0]] + pts[2:]
        assert yaw_from_kps(swapped) == pytest.approx(yaw_from_kps(pts))

    def test_scale_and_translation_invariant(self):
        pts = kps(nose=(142.0, 128.0))
        moved = [[3 * x + 50, 3 * y - 20] for x, y in pts]
        assert yaw_from_kps(moved) == pytest.approx(yaw_from_kps(pts))

    def test_tilted_eyes_use_euclidean_eye_distance(self):
        # eyes 60 px apart horizontally and 80 px vertically => distance 100
        assert yaw_from_kps(kps(eye_l=(100, 100), eye_r=(160, 180), nose=(150, 150))) == pytest.approx(20 / 100)

    def test_accepts_numpy_and_returns_float(self):
        y = yaw_from_kps(np.array(kps(nose=(145.0, 130.0)), dtype=np.float32))
        assert isinstance(y, float) and y == pytest.approx(0.25)

    @pytest.mark.parametrize("bad", [
        None,
        [],
        [[100.0, 100.0], [160.0, 100.0]],                      # fewer than 3 points
        [[100.0, 100.0], [100.0, 100.0], [130.0, 130.0]],      # coincident eyes
    ])
    def test_degenerate_landmarks_are_zero(self, bad):
        assert yaw_from_kps(bad) == 0.0


class TestClassifyPose:
    POLICY = {"frontal_max_yaw": 0.12, "turn_min_yaw": 0.18}

    @pytest.mark.parametrize("yaw,expected", [
        (0.0, "front"),
        (0.12, "front"),       # inclusive
        (-0.12, "front"),
        (0.15, None),          # in between: neither frontal nor a clear turn
        (-0.15, None),
        (0.18, "left"),        # inclusive; yaw > 0 = subject's left
        (0.6, "left"),
        (-0.18, "right"),
        (-0.6, "right"),
    ])
    def test_classes(self, yaw, expected):
        assert classify_pose(yaw, **self.POLICY) == expected

    def test_front_wins_if_ranges_overlap(self):
        assert classify_pose(0.2, frontal_max_yaw=0.3, turn_min_yaw=0.1) == "front"


# =============================================================== Silent-Face crop box


def silent_face_get_new_box(src_w, src_h, bbox, scale):
    """Verbatim copy of Minivision Silent-Face ``CropImage._get_new_box`` (Apache-2.0),
    ``bbox = [x, y, w, h]``. Reference implementation for the port in face_math."""
    x = bbox[0]
    y = bbox[1]
    box_w = bbox[2]
    box_h = bbox[3]
    scale = min((src_h - 1) / box_h, min((src_w - 1) / box_w, scale))
    new_width = box_w * scale
    new_height = box_h * scale
    center_x, center_y = box_w / 2 + x, box_h / 2 + y
    left_top_x = center_x - new_width / 2
    left_top_y = center_y - new_height / 2
    right_bottom_x = center_x + new_width / 2
    right_bottom_y = center_y + new_height / 2
    if left_top_x < 0:
        right_bottom_x -= left_top_x
        left_top_x = 0
    if left_top_y < 0:
        right_bottom_y -= left_top_y
        left_top_y = 0
    if right_bottom_x > src_w - 1:
        left_top_x -= right_bottom_x - src_w + 1
        right_bottom_x = src_w - 1
    if right_bottom_y > src_h - 1:
        left_top_y -= right_bottom_y - src_h + 1
        right_bottom_y = src_h - 1
    return int(left_top_x), int(left_top_y), int(right_bottom_x), int(right_bottom_y)


class TestAntispoofCropBox:
    def test_centered_box_expands_around_its_centre(self):
        # 100x100 box (w = x2 - x1 + 1) centred at (320, 240) in a 640x480 image, scale 2.7
        x1, y1, x2, y2 = antispoof_crop_box(640, 480, [270, 190, 369, 289], 2.7)
        assert (x1, y1, x2, y2) == (185, 105, 455, 375)
        assert (x2 - x1, y2 - y1) == (270, 270)

    def test_left_and_top_edges_shift_the_box_inside(self):
        x1, y1, x2, y2 = antispoof_crop_box(640, 480, [0, 0, 99, 99], 2.7)
        assert (x1, y1) == (0, 0)
        assert (x2, y2) == (270, 270)  # same size, shifted rather than cut

    def test_right_and_bottom_edges_shift_the_box_inside(self):
        x1, y1, x2, y2 = antispoof_crop_box(640, 480, [540, 380, 639, 479], 2.7)
        assert (x2, y2) == (639, 479)
        assert (x2 - x1, y2 - y1) == (270, 270)

    def test_scale_is_clamped_to_the_image(self):
        # 4.0 x 200 px = 800 px would not fit a 640x480 image: the crop becomes as large as the image
        x1, y1, x2, y2 = antispoof_crop_box(640, 480, [220, 140, 419, 339], 4.0)
        assert y2 - y1 == 479 and (x1, y1, y2) == (80, 0, 479)

    def test_box_partly_outside_the_image(self):
        x1, y1, x2, y2 = antispoof_crop_box(640, 480, [-40, -30, 80, 100], 2.7)
        assert x1 == 0 and y1 == 0 and x2 <= 639 and y2 <= 479

    def test_box_larger_than_the_image(self):
        # scale drops below 1 so the limiting side (height) spans the whole image; aspect is kept
        x1, y1, x2, y2 = antispoof_crop_box(640, 480, [-100, -100, 800, 700], 2.7)
        assert (y1, y2) == (0, 479)
        assert 0 <= x1 < x2 <= 639
        assert (x2 - x1) / (y2 - y1) == pytest.approx(901 / 801, abs=0.01)

    def test_always_inside_the_image(self):
        rng = random.Random(11)
        for _ in range(2000):
            w, h = rng.randint(64, 2000), rng.randint(64, 2000)
            x1, y1 = rng.uniform(-0.2 * w, w), rng.uniform(-0.2 * h, h)
            bw, bh = rng.uniform(4, 1.2 * w), rng.uniform(4, 1.2 * h)
            scale = rng.choice([1.0, 2.7, 4.0])
            cx1, cy1, cx2, cy2 = antispoof_crop_box(w, h, [x1, y1, x1 + bw, y1 + bh], scale)
            assert 0 <= cx1 <= cx2 <= w - 1, (w, h, x1, y1, bw, bh, scale)
            assert 0 <= cy1 <= cy2 <= h - 1, (w, h, x1, y1, bw, bh, scale)

    def test_matches_silent_face_for_integer_boxes(self):
        # Silent-Face's detector returns integer [x, y, w, h] with w = right - left + 1.
        rng = random.Random(5)
        for _ in range(3000):
            w, h = rng.choice([(640, 480), (480, 640), (1280, 720), (1280, 886), (320, 240)])
            x1, y1 = rng.randint(-60, w - 10), rng.randint(-60, h - 10)
            bw, bh = rng.randint(10, w), rng.randint(10, h)
            for scale in (2.7, 4.0):
                expected = silent_face_get_new_box(w, h, [x1, y1, bw + 1, bh + 1], scale)
                assert antispoof_crop_box(w, h, [x1, y1, x1 + bw, y1 + bh], scale) == expected

    def test_degenerate_box_does_not_divide_by_zero(self):
        x1, y1, x2, y2 = antispoof_crop_box(640, 480, [100, 100, 100, 100], 2.7)
        assert 0 <= x1 <= x2 <= 639 and 0 <= y1 <= y2 <= 479


# =============================================================== quality gate


GATE = dict(min_detection_score=0.6, min_face_size_px=80, min_sharpness=20.0, min_brightness=40.0, max_brightness=220.0)
GOOD = {"det_score": 0.95, "width": 200.0, "height": 240.0, "sharpness": 150.0, "brightness": 128.0}


class TestQualityIssues:
    def test_good_face_has_no_issues(self):
        assert quality_issues(GOOD, **GATE) == []

    @pytest.mark.parametrize("override,issue", [
        ({"det_score": 0.59}, "low_confidence"),
        ({"width": 79.0}, "too_small"),
        ({"height": 60.0}, "too_small"),
        ({"sharpness": 19.9}, "too_blurry"),
        ({"brightness": 39.0}, "too_dark"),
        ({"brightness": 221.0}, "too_bright"),
    ])
    def test_single_issue(self, override, issue):
        assert quality_issues({**GOOD, **override}, **GATE) == [issue]

    def test_boundaries_pass(self):
        edge = {"det_score": 0.6, "width": 80.0, "height": 80.0, "sharpness": 20.0, "brightness": 40.0}
        assert quality_issues(edge, **GATE) == []
        assert quality_issues({**edge, "brightness": 220.0}, **GATE) == []

    def test_several_issues_in_fixed_order(self):
        bad = {"det_score": 0.3, "width": 50.0, "height": 50.0, "sharpness": 2.0, "brightness": 10.0}
        assert quality_issues(bad, **GATE) == ["low_confidence", "too_small", "too_blurry", "too_dark"]

    def test_legacy_confidence_key_is_used_when_det_score_is_missing(self):
        face = {k: v for k, v in GOOD.items() if k != "det_score"}
        assert quality_issues({**face, "confidence": 0.5}, **GATE) == ["low_confidence"]

    def test_missing_measurements_are_not_failures(self):
        assert quality_issues({}, **GATE) == []
        assert quality_issues({"width": 50.0}, **GATE) == []  # needs both width and height

    def test_engine_face_dict_shape(self):
        face = {"bbox": [0, 0, 200, 240], "det_score": 0.9, "confidence": 0.9, "kps": [], "embedding": [0.1] * 512,
                "width": 200.0, "height": 240.0, "area": 48000.0, "area_ratio": 0.15, "yaw": 0.0,
                "sharpness": 15.0, "brightness": 230.0}
        assert quality_issues(face, **GATE) == ["too_blurry", "too_bright"]
