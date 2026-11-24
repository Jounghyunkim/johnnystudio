"""Store 파일 보관 폴더 (Settings.store_dir).

    uploads/<업로드 ID>.part   조각으로 받는 중이거나 등록을 기다리는 파일
    uploads/<업로드 ID>.png    분석에서 뽑은 아이콘 (등록을 기다리는 동안)
    files/<저장 키>            버전의 설치 파일. 이름은 무작위 키라서 올린 사람이 정한 이름이 경로에 들어가지 않는다
    icons/<앱 코드>.png        앱 아이콘 (Pillow 로 다시 그린 PNG 만)

운영에서는 nginx 가 files/ 를 internal location 으로 내준다 (X-Accel-Redirect). 바깥에서 직접 열 수 없다.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import secrets
import unicodedata
from pathlib import Path

log = logging.getLogger("johnnystudio.store")

UPLOAD_ID = re.compile(r"^[0-9a-f]{32}$")
STORAGE_KEY = re.compile(r"^[0-9a-f]{40}$")

# 받는 형식 (JohnnyStore 와 같다). 분석기(analyze.py)가 확장자와 실제 내용이 맞는지 다시 본다
ALLOWED_EXTENSIONS = (".exe", ".msi", ".msix", ".zip", ".7z")


class StoreDirs:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.uploads = root / "uploads"
        self.files = root / "files"
        self.icons = root / "icons"

    def ensure(self) -> None:
        for d in (self.uploads, self.files, self.icons):
            d.mkdir(parents=True, exist_ok=True, mode=0o750)

    def upload_part(self, upload_id: str) -> Path:
        if not UPLOAD_ID.match(upload_id):
            raise ValueError("업로드 ID 형식")
        return self.uploads / f"{upload_id}.part"

    def upload_icon(self, upload_id: str) -> Path:
        if not UPLOAD_ID.match(upload_id):
            raise ValueError("업로드 ID 형식")
        return self.uploads / f"{upload_id}.png"

    def release_file(self, storage_key: str) -> Path:
        if not STORAGE_KEY.match(storage_key):
            raise ValueError("저장 키 형식")
        return self.files / storage_key

    def app_icon(self, code: str) -> Path:
        if not re.fullmatch(r"[0-9A-Za-z]{4,12}", code):
            raise ValueError("앱 코드 형식")
        return self.icons / f"{code}.png"


def new_upload_id() -> str:
    return secrets.token_hex(16)


def new_storage_key() -> str:
    return secrets.token_hex(20)


def remove(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError as err:
        log.warning("파일을 지우지 못했다: %s (%s)", path.name, err.strerror)


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def safe_file_name(raw: str) -> str | None:
    """내려받을 때 보여 줄 파일 이름. 경로·제어 문자를 빼고, 허용 확장자가 아니면 None.

    저장 경로에는 쓰지 않는다 (저장은 무작위 키). 그래도 Content-Disposition 에 들어가므로 깨끗하게 만든다.
    """
    name = unicodedata.normalize("NFC", raw).replace("\\", "/").rsplit("/", 1)[-1]
    name = "".join(c for c in name if unicodedata.category(c)[0] != "C")  # 제어·서식 문자 (RTL 덮어쓰기 포함)
    name = re.sub(r'[<>:"|?*;]', "_", name).strip(" .")
    if not name or len(name) > 200:
        return None
    if not name.lower().endswith(ALLOWED_EXTENSIONS):
        return None
    stem = name.rsplit(".", 1)[0]
    if not stem.strip(" ._-"):
        return None
    return name


def write_chunk(path: Path, data: bytes, offset: int) -> int:
    """offset 이 지금 크기와 같을 때만 이어 쓴다. 쓴 뒤 크기를 돌려준다."""
    have = path.stat().st_size if path.exists() else 0
    if have != offset:
        raise ValueError(f"offset {offset} != {have}")
    flags = os.O_WRONLY | os.O_CREAT | os.O_APPEND
    fd = os.open(path, flags, 0o640)
    try:
        _write_all(fd, data)
    finally:
        os.close(fd)
    return have + len(data)


def _write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        n = os.write(fd, view)
        view = view[n:]
