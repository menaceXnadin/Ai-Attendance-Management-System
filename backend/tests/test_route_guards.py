"""Route-permission matrix: every mutating route must require authentication.

Walks ``app.routes`` and, for each POST/PUT/PATCH/DELETE route, the full FastAPI dependant
tree (route-, router- and sub-dependencies). A route counts as guarded only if
``app.api.dependencies.get_current_user`` (the JWT validator every role guard builds on)
appears somewhere in that tree. Do not weaken this test: fix the route or, for a genuinely
public endpoint, add it to ``PUBLIC_MUTATING_ROUTES`` with a justification.
"""
from __future__ import annotations

import pytest
from fastapi.routing import APIRoute

MUTATING = {"POST", "PUT", "PATCH", "DELETE"}

#: (METHOD, path) -> why it is public. Keep this list minimal.
PUBLIC_MUTATING_ROUTES: dict[tuple[str, str], str] = {
    ("POST", "/api/auth/login"): "obtains the token",
    ("POST", "/api/auth/forgot-password"): "password-reset request (user is logged out)",
    ("POST", "/api/auth/reset-password"): "password-reset confirm with one-time token",
}
#: GET-only public routes kept for documentation/consistency checks.
PUBLIC_READ_ROUTES = {("GET", "/health")}


def _auth_roots():
    from app.api import dependencies

    return {dependencies.get_current_user}


def _dependency_calls(dependant, seen=None):
    seen = set() if seen is None else seen
    for dep in dependant.dependencies:
        if id(dep) in seen:
            continue
        seen.add(id(dep))
        if dep.call is not None:
            yield dep.call
        yield from _dependency_calls(dep, seen)


def _mutating_routes(app):
    for route in app.routes:
        if isinstance(route, APIRoute):
            for method in sorted(route.methods & MUTATING):
                yield method, route


def _describe(route: APIRoute) -> str:
    endpoint = route.endpoint
    return f"{endpoint.__module__}.{endpoint.__name__}"


def test_every_mutating_route_requires_auth(app):
    roots = _auth_roots()
    offenders = []
    for method, route in _mutating_routes(app):
        if (method, route.path) in PUBLIC_MUTATING_ROUTES:
            continue
        calls = set(_dependency_calls(route.dependant))
        if not (calls & roots):
            offenders.append(f"{method:6} {route.path}  ->  {_describe(route)}")
    if offenders:
        pytest.fail(
            f"{len(offenders)} mutating route(s) have no authentication dependency "
            "(get_current_user not in their dependency tree):\n  " + "\n  ".join(sorted(offenders)),
            pytrace=False,
        )


def test_public_allowlist_entries_exist(app):
    """Allowlist must not rot: every entry has to match a real route."""
    existing = {(m, r.path) for m, r in _mutating_routes(app)}
    existing |= {(m, r.path) for r in app.routes if isinstance(r, APIRoute) for m in r.methods}
    stale = sorted(set(PUBLIC_MUTATING_ROUTES) - existing) + sorted(PUBLIC_READ_ROUTES - existing)
    assert not stale, f"allowlisted routes that no longer exist: {stale}"


def test_guard_detection_sanity():
    """The walker must see auth through role guards and router-level dependencies."""
    from fastapi import APIRouter, Depends, FastAPI

    from app.api.dependencies import require_admin_role

    probe = FastAPI()
    guarded_router = APIRouter(dependencies=[Depends(require_admin_role)])

    @guarded_router.post("/router-guarded")
    async def _a():  # pragma: no cover - never called
        return {}

    open_router = APIRouter()

    @open_router.delete("/open")
    async def _b():  # pragma: no cover - never called
        return {}

    probe.include_router(guarded_router)
    probe.include_router(open_router)
    roots = _auth_roots()
    verdict = {r.path: bool(set(_dependency_calls(r.dependant)) & roots) for _, r in _mutating_routes(probe)}
    assert verdict == {"/router-guarded": True, "/open": False}
