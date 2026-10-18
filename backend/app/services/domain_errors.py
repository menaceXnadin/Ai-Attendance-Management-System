"""Structured business-rule errors shared by the attendance domain services.

Services raise :class:`DomainError`; routes translate it with one of

* ``err.to_http_exception()`` -> ``HTTPException(err.http_status, detail=err.to_dict())``
* ``err.to_legacy_response()`` -> HTTP 200 body ``{"success": False, "message", "code", ...}``
  for legacy endpoints whose clients read ``success`` (Rule §13.3, §13.9, §13.10).

``code`` values are stable identifiers the frontend may switch on (e.g. ``already_recorded``,
``window_closed``, ``not_enrolled``, ``session_cancelled``, ``no_session_today``,
``between_terms``, ``confirm_held``, ``reason_required``, ``validation_failed``, ...).
"""
from __future__ import annotations

from typing import Any, Optional


class DomainError(Exception):
    """A business-rule rejection with a stable ``code`` and suggested ``http_status``."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        http_status: int = 400,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = int(http_status)
        self.details: dict[str, Any] = dict(details or {})

    def to_dict(self) -> dict[str, Any]:
        """JSON body for the modern error contract: ``{code, message, details}``."""
        return {"code": self.code, "message": self.message, "details": self.details}

    def to_legacy_response(self) -> dict[str, Any]:
        """HTTP-200 body for legacy clients: ``{success: False, message, code, **details}``.

        Detail keys never override ``success``/``message``/``code``.
        """
        body: dict[str, Any] = {k: v for k, v in self.details.items() if k not in ("success", "message", "code")}
        body.update({"success": False, "message": self.message, "code": self.code})
        return body

    def to_http_exception(self):
        from fastapi import HTTPException

        return HTTPException(status_code=self.http_status, detail=self.to_dict())

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"DomainError(code={self.code!r}, http_status={self.http_status}, message={self.message!r})"


def not_found(what: str, **details: Any) -> DomainError:
    return DomainError(f"{what}_not_found", f"{what.replace('_', ' ').capitalize()} not found", http_status=404, details=details)


def forbidden(code: str, message: str, **details: Any) -> DomainError:
    return DomainError(code, message, http_status=403, details=details)


def conflict(code: str, message: str, **details: Any) -> DomainError:
    return DomainError(code, message, http_status=409, details=details)


def invalid(code: str, message: str, **details: Any) -> DomainError:
    return DomainError(code, message, http_status=422, details=details)


__all__ = ["DomainError", "not_found", "forbidden", "conflict", "invalid"]
