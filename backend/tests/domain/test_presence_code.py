"""Rotating proof-of-presence codes (docs/system/face-verification.md §9): TOTP-style, per session,
current + previous step accepted, constant-time comparison, strict digit input."""
from __future__ import annotations

import hashlib
import hmac
import struct
from datetime import datetime, timedelta, timezone

import pytest

from app.services import presence_code as pc

KEY = b"attendai-test-secret"
PERIOD = 30
NPT = timezone(timedelta(hours=5, minutes=45))
BOUNDARY = datetime(2026, 3, 2, 3, 15, 0, tzinfo=timezone.utc)  # a whole minute => a step boundary
NOW = BOUNDARY + timedelta(seconds=7)
SID = 42


def code(at: datetime, session_id: int = SID, period: int = PERIOD, **kw) -> str:
    return pc.code_for(session_id, at, period, secret_key=KEY, **kw)


def verify(candidate, at: datetime = NOW, session_id: int = SID, period: int = PERIOD, **kw) -> bool:
    return pc.verify_code(session_id, candidate, at, period, secret_key=KEY, **kw)


def reference_code(session_id: int, step: int, key: bytes = KEY, digits: int = 6) -> str:
    """Independent implementation of the spec text (§9)."""
    secret = hmac.new(key, f"attendai-presence:{session_id}".encode(), hashlib.sha256).digest()
    mac = hmac.new(secret, step.to_bytes(8, "big"), hashlib.sha256).digest()
    offset = mac[-1] & 0x0F
    value = int.from_bytes(mac[offset:offset + 4], "big") & 0x7FFFFFFF
    return f"{value % 10 ** digits:0{digits}d}"


class TestCodeGeneration:
    def test_six_ascii_digits_and_deterministic(self):
        c = code(NOW)
        assert len(c) == 6 and c.isascii() and c.isdigit()
        assert code(NOW) == c

    def test_matches_the_spec_algorithm(self):
        step = int(NOW.timestamp()) // PERIOD
        assert pc.time_step(NOW, PERIOD) == step
        for sid in (1, SID, 999_999):
            for s in (0, 1, step - 1, step, step + 1):
                assert pc.code_for_step(sid, s, secret_key=KEY) == reference_code(sid, s)

    def test_golden_values(self):
        # pinned so an accidental algorithm change (and every printed QR) is caught
        assert pc.code_for_step(42, 59_000_000, secret_key=KEY) == "937373"
        assert pc.code_for_step(1, 0, secret_key=KEY) == "040736"  # zero padded

    def test_same_code_for_the_whole_step(self):
        assert code(BOUNDARY) == code(BOUNDARY + timedelta(seconds=29))
        assert code(BOUNDARY) != code(BOUNDARY + timedelta(seconds=30))

    def test_timezone_of_now_does_not_matter(self):
        assert code(NOW) == code(NOW.astimezone(NPT))

    def test_depends_on_session_secret_and_period(self):
        assert code(NOW, session_id=SID) != code(NOW, session_id=SID + 1)
        assert pc.code_for(SID, NOW, PERIOD, secret_key=b"other") != code(NOW)
        assert pc.session_secret(SID, KEY) != pc.session_secret(SID + 1, KEY)
        assert code(NOW, period=60) != code(NOW, period=PERIOD)

    def test_custom_digits(self):
        c = code(NOW, digits=8)
        assert len(c) == 8 and c.isdigit()
        assert verify(c, digits=8)
        assert not verify(c)  # 8 digits where 6 are expected

    def test_naive_datetime_is_rejected(self):
        with pytest.raises(ValueError):
            pc.time_step(datetime(2026, 3, 2, 9, 0), PERIOD)

    def test_default_secret_comes_from_settings(self):
        from app.core.config import settings

        assert pc.session_secret(5) == pc.session_secret(5, settings.secret_key.encode("utf-8"))


class TestVerify:
    def test_current_step_is_accepted(self):
        assert verify(code(NOW))

    def test_previous_step_is_accepted(self):
        assert verify(code(NOW - timedelta(seconds=PERIOD)))

    def test_two_steps_back_is_rejected(self):
        old = code(NOW - timedelta(seconds=2 * PERIOD))
        assert old not in (code(NOW), code(NOW - timedelta(seconds=PERIOD)))  # precondition
        assert not verify(old)

    def test_next_step_is_rejected(self):
        future = code(NOW + timedelta(seconds=PERIOD))
        assert future not in (code(NOW), code(NOW - timedelta(seconds=PERIOD)))
        assert not verify(future)

    def test_code_lives_up_to_two_periods(self):
        c = code(BOUNDARY)
        assert verify(c, at=BOUNDARY)
        assert verify(c, at=BOUNDARY + timedelta(seconds=2 * PERIOD - 1))
        assert not verify(c, at=BOUNDARY + timedelta(seconds=2 * PERIOD))

    def test_other_session_is_rejected(self):
        other = code(NOW, session_id=SID + 1)
        assert other not in (code(NOW), code(NOW - timedelta(seconds=PERIOD)))
        assert not verify(other)

    def test_other_secret_is_rejected(self):
        assert not pc.verify_code(SID, code(NOW), NOW, PERIOD, secret_key=b"another-secret")

    def test_surrounding_whitespace_is_ignored(self):
        assert verify(f"  {code(NOW)}\n")

    @pytest.mark.parametrize("bad", [None, "", "12345", "1234567", "12a456", "12 456", "-12345", "+12345", "12.456",
                                     "abcdef"])
    def test_malformed_codes_are_rejected(self, bad):
        assert verify(bad) is False

    def test_wrong_digits_are_rejected(self):
        c = code(NOW)
        wrong = f"{(int(c) + 1) % 10 ** 6:06d}"
        assert wrong not in (c, code(NOW - timedelta(seconds=PERIOD)))
        assert not verify(wrong)

    @pytest.mark.parametrize("unicode_digits", ["١٢٣٤٥٦", "12345²",
                                                "１２３４５６"])
    def test_non_ascii_digits_are_rejected_not_raised(self, unicode_digits):
        assert verify(unicode_digits) is False


class TestRotationAndLinks:
    @pytest.mark.parametrize("offset,expected", [(0, 30), (1, 29), (7, 23), (29, 1)])
    def test_seconds_until_rotation(self, offset, expected):
        assert pc.seconds_until_rotation(BOUNDARY + timedelta(seconds=offset), PERIOD) == expected

    def test_rotation_matches_step_change(self):
        left = pc.seconds_until_rotation(NOW, PERIOD)
        assert code(NOW + timedelta(seconds=left - 1)) == code(NOW)
        assert code(NOW + timedelta(seconds=left)) != code(NOW)

    def test_checkin_path(self):
        assert pc.checkin_path(7, "012345") == "/student/attendance/mark?session=7&code=012345"
