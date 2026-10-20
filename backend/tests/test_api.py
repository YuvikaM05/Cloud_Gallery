from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)  # not used as a context manager -> startup/DB ping is skipped


def test_root():
    r = client.get("/")
    assert r.status_code == 200 and r.json()["docs"] == "/docs"


def test_openapi_lists_all_routers():
    paths = client.get("/openapi.json").json()["paths"]
    for p in ["/auth/login", "/photos", "/photos/bulk", "/albums", "/share", "/bin", "/storage/summary",
              "/analytics/overview", "/notifications"]:
        assert p in paths


def test_photos_require_login():
    assert client.get("/photos").status_code == 401
    assert client.post("/photos/bulk", json={"ids": ["x"], "action": "favorite"}).status_code == 401


def test_register_validation():
    r = client.post("/auth/register", json={"name": "A", "email": "not-an-email", "password": "short"})
    assert r.status_code == 422
