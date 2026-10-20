import re
from urllib.parse import quote

_SAFE = re.compile(r"[^\w.\- ()]+", re.UNICODE)


def sanitize_filename(name: str | None, default: str = "photo") -> str:
    name = (name or default).replace("\\", "/").split("/")[-1]
    name = _SAFE.sub("_", name).strip(" .") or default
    return name[:120]


def content_disposition(filename: str) -> str:
    ascii_name = filename.encode("ascii", "ignore").decode() or "download"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def unique_name(name: str, used: set[str]) -> str:
    base, dot, ext = name.rpartition(".")
    if not dot:
        base, ext = name, ""
    candidate, i = name, 1
    while candidate in used:
        candidate = f"{base} ({i}).{ext}" if ext else f"{base} ({i})"
        i += 1
    used.add(candidate)
    return candidate
