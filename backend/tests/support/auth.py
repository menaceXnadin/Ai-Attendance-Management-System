"""Real JWTs for tests, minted with ``app.core.security.create_access_token``.

``get_current_user`` (app/api/dependencies.py) validates ``sub`` (users.id as str) and
``role`` (must equal users.role), so tokens are built exactly that way.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any


def _user_of(entity: Any) -> Any:
    """Accept a users Record/ORM User, or a student/teacher/admin Record carrying ``.user``."""
    return getattr(entity, "user", None) or entity


def token_for(entity: Any, *, expires_delta: timedelta | None = None, **claims: Any) -> str:
    from app.core.security import create_access_token

    user = _user_of(entity)
    role = getattr(user.role, "value", user.role)
    data = {"sub": str(user.id), "role": str(role)}
    data.update(claims)
    return create_access_token(data, expires_delta=expires_delta)


def auth_headers(entity: Any, **claims: Any) -> dict[str, str]:
    """``{"Authorization": "Bearer <jwt>"}`` for a seeded user/student/teacher/admin."""
    return {"Authorization": f"Bearer {token_for(entity, **claims)}"}
