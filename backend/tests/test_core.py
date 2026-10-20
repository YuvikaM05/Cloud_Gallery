import io

import pytest
from PIL import Image

from app.core.security import create_access_token, decode_token, hash_password, verify_password
from app.services.image_service import InvalidImage, process_image
from app.utils.files import sanitize_filename, unique_name


def _jpeg(w=800, h=600) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (10, 120, 200)).save(buf, "JPEG")
    return buf.getvalue()


def test_password_roundtrip():
    stored = hash_password("StrongPass123")
    assert stored.startswith("scrypt$")
    assert verify_password("StrongPass123", stored)
    assert not verify_password("wrong", stored)


def test_jwt_roundtrip():
    token = create_access_token("abc123")
    assert decode_token(token) == "abc123"
    assert decode_token(token + "x") is None


def test_process_image_makes_thumbnail_and_hash():
    p = process_image(_jpeg())
    assert (p.width, p.height) == (800, 600)
    assert p.mime == "image/jpeg" and len(p.sha256) == 64
    assert Image.open(io.BytesIO(p.thumb)).size[0] <= 480


def test_compress_shrinks_large_images():
    p = process_image(_jpeg(4000, 3000), compress=True)
    assert max(p.width, p.height) == 2048


def test_rejects_non_images():
    with pytest.raises(InvalidImage):
        process_image(b"%PDF-1.4 definitely not an image")


def test_filename_helpers():
    assert "/" not in sanitize_filename("../../etc/passwd")
    used = {"a.jpg"}
    assert unique_name("a.jpg", used) == "a (1).jpg"
