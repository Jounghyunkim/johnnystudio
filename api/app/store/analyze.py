"""Windows 배포 파일의 메타데이터와 아이콘을 뽑는다 (Store, ADR-0012).

출처: johnnystore 6dc01fe (보관본) backend/app/pe_extractor.py. 분석 로직은 그대로 두고, 맨 아래 실행 방식만 바꿨다.

Windows API 없이 순수 Python(`pefile`, `icoextract`, `Pillow`, `olefile`)만 쓴다.

지원 형식과 추출 내용
    .exe   PE 헤더 Machine → 아키텍처, VS_VERSIONINFO → 이름/버전/개발자/소개,
           RT_GROUP_ICON → 256px PNG 아이콘, Authenticode 서명 포함 여부
    .msi   OLE SummaryInformation → 제품명/제조사/플랫폼
    .msix  AppxManifest.xml → 이름/버전/게시자/아키텍처/로고
    .zip   내부의 대표 .exe 를 찾아 위 PE 분석을 적용
    .7z    시그니처 검증 + 파일명 기반 추정

회원이 올린 파일을 읽으므로 API 프로세스 안에서 돌리지 않는다. router 가 별도 프로세스로 부르고(run_isolated),
시간·메모리 한도를 건다. 파서가 멈추거나 죽어도 API 는 그대로다.

    python -m app.store.analyze <파일> <원래 파일 이름> [--icon 아이콘.png]   → 표준 출력에 JSON
    python -m app.store.analyze --icon-from <그림> <저장할 PNG>              회원이 올린 아이콘을 256px PNG 로
    python -m app.store.analyze --screenshot-from <그림> <저장할 WebP>       Showroom 화면 그림을 1600px 이하 WebP 로
"""
from __future__ import annotations

import io
import logging
import os
import re
import struct
import tempfile
import zipfile
from dataclasses import asdict, dataclass, field
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree

import olefile
import pefile
from icoextract import IconExtractor
from PIL import Image

log = logging.getLogger(__name__)

# 허용 확장자 화이트리스트 → 내부 파일 타입
ALLOWED_EXTENSIONS: dict[str, str] = {
    ".exe": "exe",
    ".msi": "msi",
    ".msix": "msix",
    ".zip": "zip",
    ".7z": "7z",
}

# 파일 타입별로 기대하는 컨테이너 시그니처
_EXPECTED_MAGIC = {"exe": "pe", "msi": "ole", "msix": "zip", "zip": "zip", "7z": "7z"}
_MAGIC_LABEL = {"pe": "Windows 실행 파일(PE)", "ole": "MSI 설치 패키지", "zip": "ZIP 압축", "7z": "7-Zip 압축"}

_OLE_MAGIC = bytes.fromhex("D0CF11E0A1B11AE1")
_ZIP_MAGIC = b"PK\x03\x04"
_7Z_MAGIC = bytes.fromhex("377ABCAF271C")

# IMAGE_FILE_HEADER.Machine
MACHINE_TYPES: dict[int, str] = {
    0x8664: "x64",  # IMAGE_FILE_MACHINE_AMD64
    0x014C: "x86",  # IMAGE_FILE_MACHINE_I386
    0xAA64: "arm64",  # IMAGE_FILE_MACHINE_ARM64
    0x01C4: "arm",  # IMAGE_FILE_MACHINE_ARMNT
    0x0200: "ia64",  # IMAGE_FILE_MACHINE_IA64
}

ICON_SIZE = 256
_ZIP_INNER_EXE_LIMIT = 512 * 1024 * 1024  # zip 안의 exe 를 풀어 분석할 때의 최대 크기
_ZIP_AUX_EXE = re.compile(r"unins|uninstall|update|crash|helper|vc_?redist|dotnet|ffmpeg|elevate|setup-?helper", re.I)

_IMAGE_FILE_DLL = 0x2000
_DIR_SECURITY = 4
_DIR_COM_DESCRIPTOR = 14
_COMIMAGE_FLAGS_32BITREQUIRED = 0x2


class BinaryValidationError(ValueError):
    """확장자/시그니처 검증 실패. 메시지는 사용자에게 그대로 보여줄 수 있다."""


@dataclass
class BinaryInfo:
    file_type: str  # exe | msi | msix | zip | 7z
    architecture: str = "unknown"  # x64 | x86 | arm64 | arm | anycpu | neutral | unknown
    machine: int | None = None  # PE Machine 원본 값
    product_name: str = ""
    file_description: str = ""
    company_name: str = ""
    file_version: str = ""
    product_version: str = ""
    original_filename: str = ""
    legal_copyright: str = ""
    is_signed: bool = False  # Authenticode 서명 블록 포함 여부 (서명의 유효성 검증은 아님)
    is_dotnet: bool = False
    is_installer: bool = False  # NSIS 설치 프로그램 스텁 (스텁의 아키텍처 ≠ 설치되는 앱의 아키텍처)
    subsystem: str = ""  # gui | console
    inner_path: str = ""  # zip 인 경우 분석에 사용한 내부 exe 경로
    from_filename: bool = False  # 파일 내부에 메타데이터가 없어 파일명으로 이름을 추정했는지
    icon_png: bytes | None = field(default=None, repr=False)
    warnings: list[str] = field(default_factory=list)

    # ---- 등록 폼 기본값 -------------------------------------------------
    def suggested_name(self, filename: str = "") -> str:
        return self.product_name or self.file_description or guess_from_filename(filename)[0]

    def suggested_version(self, filename: str = "") -> str:
        return (
            normalize_version(self.product_version)
            or normalize_version(self.file_version)
            or guess_from_filename(filename)[1]
        )

    def suggested_summary(self, filename: str = "") -> str:
        desc = self.file_description
        return desc if desc and desc.casefold() != self.suggested_name(filename).casefold() else ""

    def to_dict(self) -> dict:
        data = asdict(self)
        data.pop("icon_png")
        data["has_icon"] = self.icon_png is not None
        return data


# ---------------------------------------------------------------------------
# 1) 확장자 화이트리스트 + Magic Number 교차 검증
# ---------------------------------------------------------------------------
def file_type_from_name(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(ALLOWED_EXTENSIONS)
        raise BinaryValidationError(f"허용되지 않는 파일 형식입니다. 등록 가능한 형식: {allowed}")
    return ALLOWED_EXTENSIONS[ext]


def sniff_magic(path: str | os.PathLike) -> str | None:
    """파일 앞부분의 시그니처로 실제 컨테이너 형식을 판별한다: pe | ole | zip | 7z | None."""
    with open(path, "rb") as fh:
        head = fh.read(64)
        if head[:2] == b"MZ":
            # DOS 헤더의 e_lfanew(0x3C) 가 가리키는 곳에 'PE\0\0' 가 있어야 진짜 PE 다.
            if len(head) < 64:
                return None
            (e_lfanew,) = struct.unpack_from("<I", head, 0x3C)
            fh.seek(e_lfanew)
            return "pe" if fh.read(4) == b"PE\x00\x00" else None
    if head[:8] == _OLE_MAGIC:
        return "ole"
    if head[:4] == _ZIP_MAGIC:
        return "zip"
    if head[:6] == _7Z_MAGIC:
        return "7z"
    return None


def validate_binary(path: str | os.PathLike, filename: str) -> str:
    """확장자와 실제 파일 시그니처가 일치하는지 검증하고 파일 타입을 돌려준다."""
    file_type = file_type_from_name(filename)
    expected = _EXPECTED_MAGIC[file_type]
    actual = sniff_magic(path)
    if actual != expected:
        found = _MAGIC_LABEL.get(actual or "", "알 수 없는 형식")
        raise BinaryValidationError(
            f"확장자({Path(filename).suffix.lower()})와 실제 파일 내용이 일치하지 않습니다. (감지된 형식: {found})"
        )
    if expected == "zip" and not zipfile.is_zipfile(path):
        raise BinaryValidationError("손상되었거나 올바르지 않은 압축 파일입니다.")
    return file_type


# ---------------------------------------------------------------------------
# 2) 파일명 기반 추정 (메타데이터가 없을 때의 폴백)
# ---------------------------------------------------------------------------
_VERSION_IN_NAME = re.compile(r"(?<![\d.])v?(\d+(?:\.\d+){1,3})(?![\d.])", re.I)
_ARCH_IN_NAME = [
    (re.compile(r"(?<![a-z0-9])(arm64|aarch64)(?![a-z0-9])", re.I), "arm64"),
    (re.compile(r"(?<![a-z0-9])(x64|amd64|x86[_-]64|win64|64[-_]?bit)(?![a-z0-9])", re.I), "x64"),
    (re.compile(r"(?<![a-z0-9])(x86|ia32|win32|32[-_]?bit)(?![a-z0-9])", re.I), "x86"),
]
_NOISE_IN_NAME = re.compile(r"(?<![a-z0-9])(setup|installer|install|portable|windows|win|release)(?![a-z0-9])", re.I)


def guess_from_filename(filename: str) -> tuple[str, str, str]:
    """`My-App_1.2.3_x64-setup.exe` → ("My App", "1.2.3", "x64")."""
    stem = Path(filename).stem
    version = ""
    m = _VERSION_IN_NAME.search(stem)
    if m:
        version = m.group(1)
        stem = stem[: m.start()] + " " + stem[m.end() :]
    arch = "unknown"
    for pattern, label in _ARCH_IN_NAME:
        if pattern.search(stem):
            arch = label
            stem = pattern.sub(" ", stem)
            break
    stem = re.sub(r"[_\-.]+", " ", stem)  # 구분자를 공백으로 바꾼 뒤 잡음 단어 제거
    stem = _NOISE_IN_NAME.sub(" ", stem)
    name = re.sub(r"\s+", " ", stem).strip(" ()[]")
    return name, version, arch


def _arch_hint(text: str) -> str:
    """자유 텍스트에서 64비트 대상임을 명시한 표현을 찾는다: "x64" | "arm64" | ""."""
    for pattern, label in _ARCH_IN_NAME[:2]:
        if pattern.search(text):
            return label
    return ""


def normalize_version(raw: str) -> str:
    """`1, 2, 3, 0` / `10.0.1 (build 5)` / `1.2.3+abc` 같은 표기를 `1.2.3` 형태로 정리."""
    raw = (raw or "").strip()
    if not raw:
        return ""
    raw = re.sub(r"\s*,\s*", ".", raw)  # 옛 리소스 컴파일러의 "1, 2, 3, 4" 표기
    token = raw.split()[0].split("+")[0].strip(".,;")
    if not re.match(r"^v?\d", token):
        return ""
    token = token.lstrip("vV")
    parts = token.split(".")
    if len(parts) == 4 and parts[3] == "0":
        token = ".".join(parts[:3])
    return token[:40]


# ---------------------------------------------------------------------------
# 3) PE (.exe) 분석
# ---------------------------------------------------------------------------
def _decode(value) -> str:
    if isinstance(value, bytes):
        value = value.decode("utf-8", "replace")
    return str(value or "").replace("\x00", "").strip()


def _version_strings(pe: pefile.PE) -> dict[str, str]:
    """VS_VERSIONINFO 의 StringFileInfo 테이블에서 한국어 → 영어 → 첫 번째 순으로 고른다."""
    tables: list[tuple[str, dict[str, str]]] = []
    for file_info in getattr(pe, "FileInfo", None) or []:
        entries = file_info if isinstance(file_info, list) else [file_info]
        for entry in entries:
            if _decode(getattr(entry, "Key", b"")) != "StringFileInfo":
                continue
            for table in getattr(entry, "StringTable", None) or []:
                lang = _decode(getattr(table, "LangID", b""))[:4].lower()
                strings = {_decode(k): _decode(v) for k, v in table.entries.items()}
                tables.append((lang, strings))
    if not tables:
        return {}
    for preferred in ("0412", "0409"):
        for lang, strings in tables:
            if lang == preferred and strings.get("ProductName"):
                return strings
    return max(tables, key=lambda t: len(t[1]))[1]


def _fixed_version(pe: pefile.PE) -> tuple[str, str]:
    fixed = getattr(pe, "VS_FIXEDFILEINFO", None)
    if not fixed:
        return "", ""
    info = fixed[0] if isinstance(fixed, list) else fixed

    def fmt(ms: int, ls: int) -> str:
        return f"{ms >> 16}.{ms & 0xFFFF}.{ls >> 16}.{ls & 0xFFFF}"

    file_v = fmt(info.FileVersionMS, info.FileVersionLS)
    prod_v = fmt(info.ProductVersionMS, info.ProductVersionLS)
    return ("" if file_v == "0.0.0.0" else file_v, "" if prod_v == "0.0.0.0" else prod_v)


def _pe_architecture(pe: pefile.PE, is_dotnet: bool) -> str:
    machine = pe.FILE_HEADER.Machine
    arch = MACHINE_TYPES.get(machine, "unknown")
    if is_dotnet and machine == 0x014C:
        # .NET AnyCPU 어셈블리는 Machine 이 I386 이지만 x64 Windows 에서 64비트로 실행된다.
        try:
            rva = pe.OPTIONAL_HEADER.DATA_DIRECTORY[_DIR_COM_DESCRIPTOR].VirtualAddress
            (flags,) = struct.unpack_from("<I", pe.get_data(rva, 20), 16)
            if not flags & _COMIMAGE_FLAGS_32BITREQUIRED:
                arch = "anycpu"
        except Exception:  # noqa: BLE001 - 손상된 CLR 헤더는 무시
            pass
    return arch


def extract_pe_info(path: str | os.PathLike) -> BinaryInfo:
    """PE 헤더와 버전 리소스를 읽는다. 아이콘은 extract_icon_png() 가 따로 담당한다."""
    info = BinaryInfo(file_type="exe")
    # fast_load 로 헤더만 읽고, 필요한 리소스 디렉터리만 선택적으로 파싱한다 (대용량 설치 파일 대비).
    pe = pefile.PE(str(path), fast_load=True)
    try:
        info.machine = pe.FILE_HEADER.Machine
        dirs = pe.OPTIONAL_HEADER.DATA_DIRECTORY
        info.is_signed = len(dirs) > _DIR_SECURITY and dirs[_DIR_SECURITY].Size > 0
        info.is_dotnet = len(dirs) > _DIR_COM_DESCRIPTOR and dirs[_DIR_COM_DESCRIPTOR].Size > 0
        info.architecture = _pe_architecture(pe, info.is_dotnet)
        info.subsystem = {2: "gui", 3: "console"}.get(pe.OPTIONAL_HEADER.Subsystem, "")
        info.is_installer = any(s.Name.rstrip(b"\x00") == b".ndata" for s in pe.sections)  # NSIS 고유 섹션
        if pe.FILE_HEADER.Characteristics & _IMAGE_FILE_DLL:
            info.warnings.append("실행 파일이 아니라 DLL 로 표시된 파일입니다.")

        try:
            pe.parse_data_directories(
                directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_RESOURCE"]]
            )
        except Exception as exc:  # noqa: BLE001 - 리소스가 깨져도 헤더 정보는 살린다
            log.info("리소스 디렉터리 파싱 실패: %s", exc)

        strings = _version_strings(pe)
        fixed_file_v, fixed_prod_v = _fixed_version(pe)
        info.product_name = strings.get("ProductName", "")
        info.file_description = strings.get("FileDescription", "")
        info.company_name = strings.get("CompanyName", "")
        info.file_version = strings.get("FileVersion", "") or fixed_file_v
        info.product_version = strings.get("ProductVersion", "") or fixed_prod_v
        info.original_filename = strings.get("OriginalFilename", "")
        info.legal_copyright = strings.get("LegalCopyright", "")
    finally:
        pe.close()

    if info.architecture == "unknown":
        info.warnings.append(f"알 수 없는 CPU 아키텍처입니다 (Machine=0x{info.machine:04x}).")
    elif info.architecture in ("arm64", "arm"):
        info.warnings.append("ARM용 프로그램입니다. 일반 x64 PC에서는 실행되지 않을 수 있습니다.")
    return info


def ico_to_png(ico_bytes: bytes, size: int = ICON_SIZE) -> bytes:
    """.ico 안에서 가장 크고 색 깊이가 높은 이미지를 골라 size×size RGBA PNG 로 변환."""
    with Image.open(io.BytesIO(ico_bytes)) as im:  # Pillow 는 ICO 의 최대 해상도 프레임을 기본 선택
        im = im.convert("RGBA")
        if im.size != (size, size):
            im = im.resize((size, size), Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, format="PNG", optimize=True)
        return out.getvalue()


def extract_icon_png(path: str | os.PathLike, size: int = ICON_SIZE) -> bytes | None:
    """.exe 에 임베딩된 대표 아이콘(첫 번째 RT_GROUP_ICON)을 PNG 로 추출한다. 없으면 None."""
    extractor = None
    try:
        extractor = IconExtractor(filename=str(path))
        ico = extractor.get_icon(num=0)  # 탐색기가 보여주는 것과 같은 첫 번째 아이콘 그룹
        return ico_to_png(ico.getvalue(), size)
    except Exception as exc:  # noqa: BLE001 - 아이콘이 없거나 손상된 경우는 정상 흐름
        log.info("아이콘 추출 실패 (%s): %s", Path(path).name, exc)
        return None
    finally:
        pe = getattr(extractor, "_pe", None)
        if pe is not None:
            pe.close()  # mmap 핸들을 닫아야 이후 파일 이동/삭제가 가능하다


def inspect_exe(path: str | os.PathLike) -> BinaryInfo:
    info = extract_pe_info(path)
    info.icon_png = extract_icon_png(path)
    return info


# ---------------------------------------------------------------------------
# 4) MSI / MSIX / ZIP / 7z
# ---------------------------------------------------------------------------
_MSI_PLATFORM = {"x64": "x64", "amd64": "x64", "intel64": "ia64", "intel": "x86", "arm64": "arm64", "arm": "arm"}


def inspect_msi(path: str | os.PathLike) -> BinaryInfo:
    info = BinaryInfo(file_type="msi")
    with olefile.OleFileIO(str(path)) as ole:
        meta = ole.get_metadata()
        codepage = meta.codepage if isinstance(meta.codepage, int) and meta.codepage > 0 else 1252

        def text(value) -> str:
            if isinstance(value, bytes):
                for enc in ("utf-8" if codepage == 65001 else f"cp{codepage}", "utf-8", "cp1252"):
                    try:
                        return value.decode(enc).replace("\x00", "").strip()
                    except (UnicodeDecodeError, LookupError):
                        continue
                return value.decode("utf-8", "replace").strip()
            return str(value or "").strip()

        info.product_name = text(meta.subject)  # MSI 관례: Subject = 제품명
        info.company_name = text(meta.author)  # Author = 제조사
        info.file_description = text(meta.comments)
        platform = text(meta.template).split(";")[0].split(",")[0].strip().lower()  # 예: "x64;1033"
        info.architecture = _MSI_PLATFORM.get(platform, "x86" if platform == "" else "unknown")
    return info


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def inspect_msix(path: str | os.PathLike) -> BinaryInfo:
    info = BinaryInfo(file_type="msix")
    with zipfile.ZipFile(path) as zf:
        try:
            manifest = zf.read("AppxManifest.xml")
        except KeyError:
            raise BinaryValidationError("유효한 MSIX 패키지가 아닙니다 (AppxManifest.xml 없음).") from None
        if len(manifest) > 2 * 1024 * 1024 or b"<!DOCTYPE" in manifest or b"<!ENTITY" in manifest:
            raise BinaryValidationError("MSIX 매니페스트를 읽을 수 없습니다.")
        root = ElementTree.fromstring(manifest)
        logo = ""
        for el in root.iter():
            tag = _local(el.tag)
            if tag == "Identity":
                info.product_version = el.get("Version", "")
                info.architecture = {"x64": "x64", "x86": "x86", "arm64": "arm64", "arm": "arm", "neutral": "neutral"}.get(
                    el.get("ProcessorArchitecture", "neutral").lower(), "unknown"
                )
                if not info.product_name:
                    info.product_name = el.get("Name", "")
            elif tag == "DisplayName" and el.text and not el.text.startswith("ms-resource:"):
                info.product_name = el.text.strip()
            elif tag == "PublisherDisplayName" and el.text and not el.text.startswith("ms-resource:"):
                info.company_name = el.text.strip()
            elif tag == "Description" and el.text and not el.text.startswith("ms-resource:"):
                info.file_description = el.text.strip()
            elif tag == "Logo" and el.text:
                logo = el.text.strip().replace("\\", "/")
        info.is_signed = "AppxSignature.p7x" in zf.namelist()
        info.icon_png = _msix_logo(zf, logo)
    return info


def _msix_logo(zf: zipfile.ZipFile, logo: str) -> bytes | None:
    """매니페스트의 Logo 경로(예: Assets/StoreLogo.png)에 대응하는 가장 큰 scale 변형을 찾는다."""
    if not logo:
        return None
    stem, ext = os.path.splitext(logo.lower())
    candidates = [
        zi
        for zi in zf.infolist()
        if zi.filename.lower().startswith(stem) and zi.filename.lower().endswith(ext) and zi.file_size < 5 * 1024 * 1024
    ]
    if not candidates:
        return None
    best = max(candidates, key=lambda zi: zi.file_size)
    try:
        with Image.open(io.BytesIO(zf.read(best))) as im:
            im = im.convert("RGBA")
            im.thumbnail((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
            canvas = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
            canvas.paste(im, ((ICON_SIZE - im.width) // 2, (ICON_SIZE - im.height) // 2))
            out = io.BytesIO()
            canvas.save(out, format="PNG", optimize=True)
            return out.getvalue()
    except Exception as exc:  # noqa: BLE001
        log.info("MSIX 로고 변환 실패: %s", exc)
        return None


def _pick_main_exe(zf: zipfile.ZipFile) -> zipfile.ZipInfo | None:
    """zip 안에서 대표 실행 파일을 고른다: 보조 실행 파일 제외 → 얕은 경로 → 큰 파일 순."""
    exes = [
        zi
        for zi in zf.infolist()
        if not zi.is_dir()
        and zi.filename.lower().endswith(".exe")
        and not zi.flag_bits & 0x1  # 암호화된 항목 제외
        and 0 < zi.file_size <= _ZIP_INNER_EXE_LIMIT
    ]
    if not exes:
        return None

    def rank(zi: zipfile.ZipInfo):
        p = PurePosixPath(zi.filename.replace("\\", "/"))
        return (bool(_ZIP_AUX_EXE.search(p.name)), len(p.parts), -zi.file_size)

    return min(exes, key=rank)


def inspect_zip(path: str | os.PathLike) -> BinaryInfo:
    info = BinaryInfo(file_type="zip")
    with zipfile.ZipFile(path) as zf:
        member = _pick_main_exe(zf)
        if member is None:
            info.warnings.append("압축 파일 안에서 실행 파일(.exe)을 찾지 못해 파일명으로 정보를 추정했습니다.")
            return info
        # zip 헤더의 크기 정보는 조작될 수 있으므로(zip bomb) 실제로 쓴 바이트 수로 한 번 더 제한한다.
        tmp = tempfile.NamedTemporaryFile(prefix="jszip_", suffix=".exe", delete=False)
        try:
            written = 0
            with tmp, zf.open(member) as src:
                while chunk := src.read(1024 * 1024):
                    written += len(chunk)
                    if written > _ZIP_INNER_EXE_LIMIT:
                        raise BinaryValidationError("압축 파일 내부의 실행 파일이 너무 큽니다.")
                    tmp.write(chunk)
            if sniff_magic(tmp.name) == "pe":
                inner = inspect_exe(tmp.name)
                inner.file_type = "zip"
                inner.inner_path = member.filename
                return inner
            info.warnings.append("압축 파일 안의 .exe 가 올바른 Windows 실행 파일이 아닙니다.")
        except BinaryValidationError:
            raise
        except Exception as exc:  # noqa: BLE001 - 내부 exe 분석 실패는 치명적이지 않다
            log.info("zip 내부 exe 분석 실패: %s", exc)
            info.warnings.append("압축 파일 안의 실행 파일을 분석하지 못했습니다.")
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass
    return info


# ---------------------------------------------------------------------------
# 5) 통합 진입점
# ---------------------------------------------------------------------------
def inspect_binary(path: str | os.PathLike, filename: str) -> BinaryInfo:
    """확장자·시그니처를 검증한 뒤 형식에 맞는 분석기를 실행한다.

    검증 실패는 BinaryValidationError 로 알리고, 그 밖의 분석 오류는 삼켜서
    (경고와 함께) 파일명 기반 추정값으로 폴백한다 — 분석 실패가 등록을 막지 않도록.
    """
    file_type = validate_binary(path, filename)
    try:
        if file_type == "exe":
            info = inspect_exe(path)
        elif file_type == "msi":
            info = inspect_msi(path)
        elif file_type == "msix":
            info = inspect_msix(path)
        elif file_type == "zip":
            info = inspect_zip(path)
        else:
            info = BinaryInfo(file_type=file_type)
    except BinaryValidationError:
        raise
    except Exception as exc:  # noqa: BLE001
        log.warning("바이너리 분석 실패 (%s): %s", filename, exc)
        info = BinaryInfo(file_type=file_type)
        info.warnings.append("파일에서 앱 정보를 읽지 못했습니다. 직접 입력해 주세요.")
    info.file_type = file_type

    name_guess, _version_guess, arch_guess = guess_from_filename(filename)
    if info.architecture == "unknown" and arch_guess != "unknown":
        info.architecture = arch_guess
    elif file_type == "exe" and info.architecture == "x86":
        # NSIS/Inno 등 설치 프로그램은 32비트 스텁 안에 64비트 앱을 담는 경우가 많다.
        # 파일명이나 파일 설명이 x64/arm64 를 명시하면 그쪽이 실제 앱의 대상 아키텍처다.
        described = _arch_hint(f"{info.file_description} {info.product_name}")
        if arch_guess in ("x64", "arm64"):
            info.architecture = arch_guess
            info.warnings.append(f"설치 프로그램 자체는 32비트(x86)지만, 파일명에 따라 {arch_guess} 앱으로 표시합니다.")
        elif described:
            info.architecture = described
            info.warnings.append(f"설치 프로그램 자체는 32비트(x86)지만, 파일 설명에 따라 {described} 앱으로 표시합니다.")
        elif info.is_installer:
            info.warnings.append(
                "설치 프로그램은 32비트(x86)로 감지됐지만 설치되는 앱은 64비트일 수 있습니다. "
                "64비트 앱이라면 아래 ‘아키텍처’에서 x64 로 바꿔 주세요."
            )
    if not info.product_name and not info.file_description:
        info.product_name = name_guess
        info.from_filename = True
    return info


# ---------------------------------------------------------------------------
# 6) 별도 프로세스로 실행 (Store)
# ---------------------------------------------------------------------------
def analyze(path: str | os.PathLike, filename: str, icon_out: str | os.PathLike | None = None) -> dict:
    """inspect_binary 결과를 JSON 으로 보낼 수 있는 dict 로. 검증 실패는 {"error": 문구}"""
    try:
        info = inspect_binary(path, filename)
    except BinaryValidationError as exc:
        return {"error": str(exc)}
    result = info.to_dict()
    result["suggested"] = {
        "name": info.suggested_name(filename)[:80],
        "version": info.suggested_version(filename),
        "summary": info.suggested_summary(filename)[:160],
    }
    if icon_out and info.icon_png:
        Path(icon_out).write_bytes(info.icon_png)
    return result


# 회원이 직접 올리는 아이콘 (JohnnyStore 의 icon_custom). 어떤 형식이든 256px PNG 로 다시 그려서 원본을 내주지 않는다
ICON_FORMATS = {"PNG", "JPEG", "WEBP", "ICO"}
_ICON_MAX_PIXELS = 4096 * 4096


def normalize_icon(src: str | os.PathLike, dst: str | os.PathLike) -> dict:
    """그림을 256×256 투명 배경 PNG 로 (비율 유지, 작으면 키운다). 실패하면 {"error": 문구}"""
    from PIL import ImageOps

    Image.MAX_IMAGE_PIXELS = _ICON_MAX_PIXELS
    try:
        with Image.open(src) as im:
            if im.format not in ICON_FORMATS:
                return {"error": "PNG·JPEG·WebP·ICO 그림만 쓸 수 있습니다."}
            if im.width * im.height > _ICON_MAX_PIXELS:
                return {"error": "그림이 너무 큽니다 (4096×4096 이하)."}
            fitted = ImageOps.contain(im.convert("RGBA"), (ICON_SIZE, ICON_SIZE), Image.LANCZOS)
    except (OSError, ValueError, Image.DecompressionBombError):
        return {"error": "그림 파일을 읽을 수 없습니다."}
    canvas = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    canvas.paste(fitted, ((ICON_SIZE - fitted.width) // 2, (ICON_SIZE - fitted.height) // 2))
    canvas.save(dst, format="PNG", optimize=True)
    return {"ok": True}


# Showroom 의 서비스 화면 그림. 긴 변 1600px 이하 WebP 로 다시 그린다 (원본을 내주지 않는다)
SCREENSHOT_MAX = 1600
_SCREENSHOT_FORMATS = {"PNG", "JPEG", "WEBP"}
_SCREENSHOT_MAX_PIXELS = 8000 * 8000


def normalize_screenshot(src: str | os.PathLike, dst: str | os.PathLike) -> dict:
    """화면 그림을 WebP 로 (비율 유지, 크면 줄인다). 실패하면 {"error": 문구}"""
    Image.MAX_IMAGE_PIXELS = _SCREENSHOT_MAX_PIXELS
    try:
        with Image.open(src) as im:
            if im.format not in _SCREENSHOT_FORMATS:
                return {"error": "PNG·JPEG·WebP 그림만 쓸 수 있습니다."}
            if im.width * im.height > _SCREENSHOT_MAX_PIXELS:
                return {"error": "그림이 너무 큽니다."}
            out = im.convert("RGB")
            out.thumbnail((SCREENSHOT_MAX, SCREENSHOT_MAX), Image.LANCZOS)
    except (OSError, ValueError, Image.DecompressionBombError):
        return {"error": "그림 파일을 읽을 수 없습니다."}
    out.save(dst, format="WEBP", quality=82, method=4)
    return {"ok": True, "width": out.width, "height": out.height}


def _limit_resources(memory_bytes: int, cpu_seconds: int) -> None:  # pragma: no cover - 자식 프로세스에서 돈다
    import resource

    resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def run_isolated(path: Path, filename: str, icon_out: Path, timeout: int = 120) -> dict:
    """분석을 자식 프로세스에서 돌린다. 시간이 넘거나 프로세스가 죽으면 분석 없이(경고만) 돌려준다.

    pefile 이 파일을 mmap 하므로 메모리 한도는 파일 크기 + 1.5GB 로 잡는다.
    """
    return _run_child([str(path), filename, "--icon", str(icon_out)], path.stat().st_size + 1536 * 1024 * 1024, timeout)


def run_icon_isolated(src: Path, dst: Path, timeout: int = 30) -> dict:
    """회원이 올린 아이콘 그림을 자식 프로세스에서 다시 그린다 (Pillow 가 남의 그림을 이 프로세스에서 풀지 않게)"""
    result = _run_child(["--icon-from", str(src), str(dst)], 1024 * 1024 * 1024, timeout)
    return {"error": "그림을 처리하지 못했습니다."} if result.get("failed") else result


def run_screenshot_isolated(src: Path, dst: Path, timeout: int = 60) -> dict:
    """회원이 올린 서비스 화면 그림을 자식 프로세스에서 WebP 로 다시 그린다"""
    result = _run_child(["--screenshot-from", str(src), str(dst)], 1536 * 1024 * 1024, timeout)
    return {"error": "그림을 처리하지 못했습니다."} if result.get("failed") else result


def _run_child(args: list[str], memory: int, timeout: int) -> dict:
    import json
    import subprocess
    import sys

    api_dir = Path(__file__).resolve().parents[2]
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "PYTHONDONTWRITEBYTECODE": "1", "LANG": "C.UTF-8"}
    try:
        done = subprocess.run(
            [sys.executable, "-E", "-s", "-m", "app.store.analyze", *args],
            cwd=api_dir,
            env=env,
            capture_output=True,
            timeout=timeout,
            check=False,
            preexec_fn=lambda: _limit_resources(memory, timeout),  # noqa: PLW1509 - 자식에서 한도만 건다
        )
    except subprocess.TimeoutExpired:
        log.warning("분석 프로세스 시간 초과 (%ss)", timeout)
        return {"failed": True}
    if done.returncode != 0:
        log.warning("분석 프로세스 실패 (종료 코드 %s): %s", done.returncode, done.stderr.decode("utf-8", "replace")[-500:])
        return {"failed": True}
    try:
        return json.loads(done.stdout)
    except ValueError:
        log.warning("분석 프로세스의 결과를 읽지 못했다")
        return {"failed": True}


def _main() -> None:  # pragma: no cover - CLI (run_isolated 가 부른다)
    import argparse
    import json
    import sys

    if sys.argv[1:2] == ["--icon-from"] and len(sys.argv) == 4:
        json.dump(normalize_icon(sys.argv[2], sys.argv[3]), sys.stdout, ensure_ascii=False)
        return
    if sys.argv[1:2] == ["--screenshot-from"] and len(sys.argv) == 4:
        json.dump(normalize_screenshot(sys.argv[2], sys.argv[3]), sys.stdout, ensure_ascii=False)
        return
    parser = argparse.ArgumentParser(description="Windows 바이너리 메타데이터/아이콘 추출")
    parser.add_argument("file")
    parser.add_argument("filename", help="올린 사람이 준 파일 이름 (확장자 검사·이름 추정에 쓴다)")
    parser.add_argument("--icon", help="추출한 아이콘을 저장할 PNG 경로")
    args = parser.parse_args()
    logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
    Image.MAX_IMAGE_PIXELS = 64 * 1024 * 1024  # 아이콘 하나에 이보다 큰 그림은 없다 (압축 폭탄 방지)
    json.dump(analyze(args.file, args.filename, args.icon), sys.stdout, ensure_ascii=False)


if __name__ == "__main__":  # pragma: no cover
    _main()
