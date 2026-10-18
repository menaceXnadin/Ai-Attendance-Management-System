"""Face verification policy (docs/system/face-verification.md §4): defaults, per-field fallback
for missing / invalid / out-of-range values, strict booleans, cross-field consistency,
settings-PUT validation messages and the public subset."""
from __future__ import annotations

from dataclasses import fields

import pytest

from app.services.face_policy import DEFAULT_FACE_POLICY, FacePolicy, build_face_policy, validation_errors

# The §4 table, verbatim.
SPEC_DEFAULTS = {
    "match_threshold": 0.45,
    "consistency_threshold": 0.30,
    "duplicate_threshold": 0.45,
    "require_liveness": True,
    "antispoof_threshold": 0.70,
    "require_head_turn": True,
    "head_turn_min_yaw": 0.18,
    "max_turn_yaw": 1.0,
    "frontal_max_yaw": 0.12,
    "challenge_ttl_seconds": 90,
    "frames_min": 3,
    "frames_max": 8,
    "require_presence_code": True,
    "presence_code_period_seconds": 30,
    "max_failed_attempts": 5,
    "failed_attempt_window_minutes": 10,
    "min_detection_score": 0.60,
    "enrolment_min_detection_score": 0.70,
    "min_face_size_px": 80,
    "min_sharpness": 20.0,
    "min_brightness": 40,
    "max_brightness": 220,
    "enrolment_min_images": 3,
}
BOOL_FIELDS = ["require_liveness", "require_head_turn", "require_presence_code"]
INT_FIELDS = ["challenge_ttl_seconds", "frames_min", "frames_max", "presence_code_period_seconds",
              "max_failed_attempts", "failed_attempt_window_minutes", "min_face_size_px", "enrolment_min_images"]


class TestDefaults:
    def test_defaults_match_the_spec_table(self):
        assert DEFAULT_FACE_POLICY.to_dict() == SPEC_DEFAULTS
        assert {f.name for f in fields(FacePolicy)} == set(SPEC_DEFAULTS)

    @pytest.mark.parametrize("raw", [None, {}, [], "match_threshold=0.5", 0.5, True])
    def test_missing_or_non_mapping_setting_gives_defaults(self, raw):
        assert build_face_policy(raw) == DEFAULT_FACE_POLICY

    def test_policy_is_frozen(self):
        with pytest.raises(Exception):
            DEFAULT_FACE_POLICY.match_threshold = 0.1  # type: ignore[misc]

    def test_types(self):
        p = build_face_policy({})
        for name in BOOL_FIELDS:
            assert type(getattr(p, name)) is bool
        for name in INT_FIELDS:
            assert type(getattr(p, name)) is int


class TestBuild:
    def test_valid_overrides_are_applied(self):
        p = build_face_policy({"match_threshold": 0.5, "require_liveness": False, "frames_max": 6,
                               "presence_code_period_seconds": 60, "min_sharpness": 35})
        assert (p.match_threshold, p.require_liveness, p.frames_max, p.presence_code_period_seconds) == (0.5, False, 6, 60)
        assert p.min_sharpness == 35.0 and type(p.min_sharpness) is float
        assert p.consistency_threshold == DEFAULT_FACE_POLICY.consistency_threshold

    def test_unknown_keys_are_ignored(self):
        assert build_face_policy({"nonsense": 1, "match_threshold": 0.5}).match_threshold == 0.5

    @pytest.mark.parametrize("key,value", [
        ("match_threshold", 0.05), ("match_threshold", 0.96), ("match_threshold", -1),
        ("antispoof_threshold", 1.5), ("frames_min", 0), ("frames_max", 13), ("challenge_ttl_seconds", 5),
        ("presence_code_period_seconds", 301), ("min_face_size_px", 8), ("max_brightness", 300),
        ("enrolment_min_images", 9), ("max_failed_attempts", 0), ("failed_attempt_window_minutes", 1441),
    ])
    def test_out_of_range_falls_back_per_field(self, key, value):
        p = build_face_policy({key: value, "match_threshold": 0.5} if key != "match_threshold" else {key: value})
        assert getattr(p, key) == getattr(DEFAULT_FACE_POLICY, key)
        if key != "match_threshold":
            assert p.match_threshold == 0.5  # the other fields are kept

    @pytest.mark.parametrize("key,value", [("match_threshold", 0.10), ("match_threshold", 0.95),
                                           ("frames_min", 1), ("frames_max", 12), ("antispoof_threshold", 0.0)])
    def test_bounds_are_inclusive(self, key, value):
        assert getattr(build_face_policy({key: value}), key) == value

    @pytest.mark.parametrize("value", ["false", "False", 0, 1, None, "", [], {}])
    @pytest.mark.parametrize("key", BOOL_FIELDS)
    def test_booleans_are_strict_and_keep_the_secure_default(self, key, value):
        assert getattr(build_face_policy({key: value}), key) is True

    @pytest.mark.parametrize("key", BOOL_FIELDS)
    def test_real_booleans_are_accepted(self, key):
        assert getattr(build_face_policy({key: False}), key) is False
        assert getattr(build_face_policy({key: True}), key) is True

    @pytest.mark.parametrize("value", ["0.5", None, True, False, [0.5], {"v": 0.5}])
    def test_non_numbers_fall_back(self, value):
        assert build_face_policy({"match_threshold": value}).match_threshold == 0.45

    def test_integer_fields(self):
        assert build_face_policy({"frames_max": 6.0}).frames_max == 6
        assert type(build_face_policy({"frames_max": 6.0}).frames_max) is int
        assert build_face_policy({"frames_max": 6.5}).frames_max == 8  # fractional => default
        assert build_face_policy({"frames_max": True}).frames_max == 8  # bool is not a number here

    def test_nan_float_falls_back(self):
        assert build_face_policy({"match_threshold": float("nan")}).match_threshold == 0.45

    @pytest.mark.parametrize("value", [float("inf"), float("nan")])
    def test_non_finite_integer_field_falls_back(self, value):
        assert build_face_policy({"frames_min": value}).frames_min == 3


class TestCrossField:
    def test_frames_max_below_min_resets_both(self):
        p = build_face_policy({"frames_min": 6, "frames_max": 4})
        assert (p.frames_min, p.frames_max) == (3, 8)

    def test_equal_frames_are_fine(self):
        p = build_face_policy({"frames_min": 5, "frames_max": 5})
        assert (p.frames_min, p.frames_max) == (5, 5)

    @pytest.mark.parametrize("lo,hi", [(100, 100), (150, 90)])
    def test_brightness_range_must_be_increasing(self, lo, hi):
        p = build_face_policy({"min_brightness": lo, "max_brightness": hi})
        assert (p.min_brightness, p.max_brightness) == (40.0, 220.0)

    def test_valid_brightness_range(self):
        p = build_face_policy({"min_brightness": 60, "max_brightness": 200})
        assert (p.min_brightness, p.max_brightness) == (60.0, 200.0)

    @pytest.mark.parametrize("frontal,turn", [(0.2, 0.2), (0.3, 0.2)])
    def test_frontal_must_be_below_turn(self, frontal, turn):
        p = build_face_policy({"frontal_max_yaw": frontal, "head_turn_min_yaw": turn})
        assert (p.frontal_max_yaw, p.head_turn_min_yaw) == (0.12, 0.18)

    def test_cross_field_check_uses_the_coerced_values(self):
        # frames_min out of range => default 3, which is still <= frames_max 4
        p = build_face_policy({"frames_min": 50, "frames_max": 4})
        assert (p.frames_min, p.frames_max) == (3, 4)


class TestDerived:
    def test_effective_frames_min(self):
        assert DEFAULT_FACE_POLICY.effective_frames_min == 3
        assert build_face_policy({"require_head_turn": False}).effective_frames_min == 1

    def test_public_dict_exposes_only_the_listed_keys(self):
        pub = DEFAULT_FACE_POLICY.public_dict()
        assert pub == {
            "require_liveness": True, "require_head_turn": True, "require_presence_code": True,
            "frames_min": 3, "frames_max": 8, "challenge_ttl_seconds": 90,
            "presence_code_period_seconds": 30, "enrolment_min_images": 3,
        }
        assert not any("threshold" in k or "yaw" in k for k in pub)

    def test_public_dict_uses_effective_frames_min(self):
        pub = build_face_policy({"require_head_turn": False, "frames_min": 4}).public_dict()
        assert pub["frames_min"] == 1 and pub["require_head_turn"] is False

    def test_to_dict_round_trips(self):
        p = build_face_policy({"match_threshold": 0.55, "require_presence_code": False})
        assert build_face_policy(p.to_dict()) == p


class TestValidationErrors:
    def test_valid_partial_update(self):
        assert validation_errors({"match_threshold": 0.5, "require_liveness": False, "frames_max": 6}) == []
        assert validation_errors({}) == []
        assert validation_errors({"frames_max": 6.0}) == []

    def test_unknown_key(self):
        assert validation_errors({"bogus": 1}) == ["Unknown face verification setting 'bogus'"]

    @pytest.mark.parametrize("value", [0.05, 0.99, "0.5", None, True])
    def test_number_message_names_the_range(self, value):
        assert validation_errors({"match_threshold": value}) == ["'match_threshold' must be a number between 0.1 and 0.95"]

    def test_integer_messages(self):
        assert validation_errors({"frames_max": 6.5}) == ["'frames_max' must be a number between 1 and 12"]
        assert validation_errors({"challenge_ttl_seconds": 1000}) == ["'challenge_ttl_seconds' must be a number between 15 and 600"]

    @pytest.mark.parametrize("value", [1, 0, "true", None])
    def test_boolean_message(self, value):
        assert validation_errors({"require_liveness": value}) == ["'require_liveness' must be true/false"]

    def test_several_errors_are_all_reported(self):
        errs = validation_errors({"bogus": 1, "match_threshold": 2, "require_head_turn": "no"})
        assert len(errs) == 3

    def test_value_equal_to_default_is_valid(self):
        assert validation_errors(DEFAULT_FACE_POLICY.to_dict()) == []


def test_max_turn_yaw_default_and_pair_fallback():
    from app.services.face_policy import build_face_policy as build

    assert build({}).max_turn_yaw == 1.0
    p = build({"head_turn_min_yaw": 0.5, "max_turn_yaw": 0.4})  # min >= max: both fall back
    assert (p.head_turn_min_yaw, p.max_turn_yaw) == (0.18, 1.0)
    assert build({"max_turn_yaw": 0.8}).max_turn_yaw == 0.8
