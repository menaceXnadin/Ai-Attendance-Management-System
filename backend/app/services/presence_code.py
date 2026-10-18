"""Rotating proof-of-presence codes (docs/system/face-verification.md §9).

A TOTP-style code per class session, derived from the app secret, so nothing has to be
stored: the classroom screen shows ``code_for(session_id, now)`` and check-in calls
``verify_code``. Pure module (no DB); time is passed in by the caller.
"""
from __future__ import annotations

import hashlib
import hmac
import struct
from datetime import datetime
from typing import Optional

DIGITS = 6
_LABEL = "attendai-presence:{session_id}"


def _secret_key() -> bytes:
    from app.core.config import settings

    return settings.secret_key.encode("utf-8")


def session_secret(session_id: int, secret_key: Optional[bytes] = None) -> bytes:
    """Per-session HMAC key: ``HMAC-SHA256(app_secret, "attendai-presence:{id}")``."""
    key = secret_key if secret_key is not None else _secret_key()
    return hmac.new(key, _LABEL.format(session_id=int(session_id)).encode("utf-8"), hashlib.sha256).digest()


def time_step(now: datetime, period_seconds: int) -> int:
    """``floor(unix_ts / period)``; ``now`` must be timezone-aware."""
    if now.tzinfo is None:
        raise ValueError("presence codes need a timezone-aware datetime")
    return int(now.timestamp()) // int(period_seconds)


def code_for_step(session_id: int, step: int, *, digits: int = DIGITS, secret_key: Optional[bytes] = None) -> str:
    """RFC 4226 dynamic truncation over HMAC-SHA256 of the 8-byte big-endian step."""
    mac = hmac.new(session_secret(session_id, secret_key), struct.pack(">Q", step), hashlib.sha256).digest()
    offset = mac[-1] & 0x0F
    value = struct.unpack(">I", mac[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(value % (10 ** digits)).zfill(digits)


def code_for(session_id: int, now: datetime, period_seconds: int, *, digits: int = DIGITS,
             secret_key: Optional[bytes] = None) -> str:
    return code_for_step(session_id, time_step(now, period_seconds), digits=digits, secret_key=secret_key)


def seconds_until_rotation(now: datetime, period_seconds: int) -> int:
    """Whole seconds until the current code is replaced (1..period)."""
    elapsed = int(now.timestamp()) % int(period_seconds)
    return int(period_seconds) - elapsed


def verify_code(session_id: int, code: Optional[str], now: datetime, period_seconds: int, *,
                digits: int = DIGITS, secret_key: Optional[bytes] = None) -> bool:
    """Accepts the current and the previous step's code (valid for up to two periods).

    Surrounding whitespace is ignored; anything that is not exactly ``digits`` ASCII digits fails
    (``str.isdigit`` alone would accept e.g. Arabic-Indic or fullwidth digits).
    Comparison is constant-time.
    """
    if code is None:
        return False
    candidate = str(code).strip()
    if len(candidate) != digits or not (candidate.isascii() and candidate.isdigit()):
        return False
    step = time_step(now, period_seconds)
    ok = False
    for s in (step, step - 1):
        expected = code_for_step(session_id, s, digits=digits, secret_key=secret_key)
        ok = hmac.compare_digest(expected, candidate) or ok
    return ok


def checkin_path(session_id: int, code: str) -> str:
    """Student check-in deep link (the QR encodes ``origin + checkin_path``)."""
    return f"/student/attendance/mark?session={int(session_id)}&code={code}"
