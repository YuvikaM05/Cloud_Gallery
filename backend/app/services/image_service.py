"""Validate an upload by looking at its *bytes* (not the filename), read EXIF, build a thumbnail."""
import hashlib
import io
from dataclasses import dataclass, field
from datetime import datetime, timezone

from PIL import Image, ImageOps

ALLOWED = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "GIF": ("image/gif", ".gif"),
    "WEBP": ("image/webp", ".webp"),
    "BMP": ("image/bmp", ".bmp"),
}
THUMB_SIZE = 480
COMPRESS_MAX = 2048


class InvalidImage(ValueError):
    pass


@dataclass
class Processed:
    data: bytes
    thumb: bytes
    mime: str
    ext: str
    width: int
    height: int
    sha256: str
    exif: dict[str, str] = field(default_factory=dict)
    taken_at: datetime | None = None


def _fmt(v) -> str:
    try:
        return str(round(float(v), 4)).rstrip("0").rstrip(".")
    except Exception:
        return str(v)


def read_exif(img: Image.Image) -> tuple[dict[str, str], datetime | None]:
    out: dict[str, str] = {}
    taken = None
    try:
        exif = img.getexif()
        if not exif:
            return out, None
        if exif.get(271):
            out["Camera make"] = str(exif[271]).strip("\x00 ")
        if exif.get(272):
            out["Camera model"] = str(exif[272]).strip("\x00 ")
        sub = exif.get_ifd(0x8769)  # Exif sub-IFD
        raw_dt = sub.get(0x9003) or exif.get(306)
        if raw_dt:
            try:
                taken = datetime.strptime(str(raw_dt).strip("\x00 "), "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
                out["Taken"] = taken.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
        if sub.get(0x829A):
            out["Exposure"] = f"{_fmt(sub[0x829A])} s"
        if sub.get(0x829D):
            out["Aperture"] = f"f/{_fmt(sub[0x829D])}"
        if sub.get(0x8827):
            out["ISO"] = str(sub[0x8827])
        if sub.get(0x920A):
            out["Focal length"] = f"{_fmt(sub[0x920A])} mm"
    except Exception:
        pass
    return out, taken


def _to_jpeg(img: Image.Image, quality: int) -> bytes:
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def process_image(raw: bytes, compress: bool = False) -> Processed:
    sha = hashlib.sha256(raw).hexdigest()
    try:
        probe = Image.open(io.BytesIO(raw))
        probe.verify()  # cheap integrity check
        img = Image.open(io.BytesIO(raw))  # verify() invalidates the object -> reopen
        fmt = img.format
    except Exception:
        raise InvalidImage("This file is not a valid image")
    if fmt not in ALLOWED:
        raise InvalidImage(f"Unsupported image type ({fmt}). Use JPEG, PNG, GIF, WebP or BMP")

    exif, taken_at = read_exif(img)
    oriented = ImageOps.exif_transpose(img)  # apply camera rotation
    width, height = oriented.size
    mime, ext = ALLOWED[fmt]
    data = raw

    if compress and fmt != "GIF":
        work = oriented.copy()
        work.thumbnail((COMPRESS_MAX, COMPRESS_MAX))
        data = _to_jpeg(work, 85)
        mime, ext = "image/jpeg", ".jpg"
        width, height = work.size

    thumb_img = oriented.copy()
    thumb_img.thumbnail((THUMB_SIZE, THUMB_SIZE))
    thumb = _to_jpeg(thumb_img, 80)
    return Processed(data=data, thumb=thumb, mime=mime, ext=ext, width=width, height=height, sha256=sha,
                     exif=exif, taken_at=taken_at)
