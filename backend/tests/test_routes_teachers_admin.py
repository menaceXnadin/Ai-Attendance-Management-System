"""Admin teacher management (routes/teachers.py)."""
from sqlalchemy import text


async def test_admin_rename_updates_teacher_and_login_name(client, db, factory, auth_headers):
    """Regression: the Teachers page sends `name`, which the API used to drop silently."""
    admin = await factory.admin()
    teacher = await factory.teacher()
    res = await client.put(f"/api/teachers/{teacher.id}", json={"name": "  Ada Lovelace  "}, headers=auth_headers(admin))
    assert res.status_code == 200, res.text
    row = (await db.execute(text(
        "SELECT t.name, u.full_name FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = :i"),
        {"i": teacher.id})).one()
    assert tuple(row) == ("Ada Lovelace", "Ada Lovelace")


async def test_admin_rename_rejects_blank_name(client, db, factory, auth_headers):
    admin = await factory.admin()
    teacher = await factory.teacher()
    res = await client.put(f"/api/teachers/{teacher.id}", json={"name": "   "}, headers=auth_headers(admin))
    assert res.status_code == 400, res.text
