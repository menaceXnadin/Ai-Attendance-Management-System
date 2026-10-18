"""App-level wiring: error handlers, route ordering and CORS (regressions from the docs review)."""


async def test_explicit_404_detail_is_passed_through(client, factory, db, auth_headers):
    admin = await factory.admin()
    resp = await client.get("/api/attendance/sessions/987654/register", headers=auth_headers(admin))
    assert resp.status_code == 404, resp.text
    detail = resp.json()["detail"]
    assert isinstance(detail, dict) and detail["code"] == "session_not_found"


async def test_unknown_route_404_stays_generic(client):
    resp = await client.get("/api/definitely-not-a-route")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "The requested resource was not found"}


async def test_admins_me_is_reachable(client, factory, db, auth_headers):
    admin = await factory.admin()
    resp = await client.get("/api/admins/me", headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    assert resp.json()["user_id"] == admin.user.id


async def test_cors_allows_patch(client):
    resp = await client.options(
        "/api/attendance/records/1/metrics-exclusion",
        headers={"Origin": "http://test", "Access-Control-Request-Method": "PATCH"},
    )
    assert resp.status_code == 200, resp.text
    assert "PATCH" in resp.headers.get("access-control-allow-methods", "")


async def test_face_endpoints_return_503_when_engine_failed_to_load(client, factory, db, auth_headers, monkeypatch):
    """The engine singleton is None when the models fail to load: model endpoints answer 503, not 500."""
    from app.services import insightface_service as engine_module

    monkeypatch.setattr(engine_module, "insightface_service", None)
    student = await factory.student()
    resp = await client.post("/api/face-recognition/verify-face", json={"image_data": "aGVsbG8="},
                             headers=auth_headers(student))
    assert resp.status_code == 503, resp.text
    assert resp.json()["detail"]["code"] == "face_engine_unavailable"
