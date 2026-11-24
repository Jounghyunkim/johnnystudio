"""설치 파일 분석기 테스트. 출처: johnnystore 6dc01fe (보관본) backend/tests/test_pe_extractor.py (분석기와 함께 옮겼다)"""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pytest
from PIL import Image

from app.store import analyze as px
from tests.conftest import make_pe

NOTEPAD = Path(r"C:\Windows\System32\notepad.exe")


def _write(tmp_path, name: str, data: bytes) -> Path:
    p = tmp_path / name
    p.write_bytes(data)
    return p


@pytest.mark.parametrize(
    ("machine", "expected"), [(0x8664, "x64"), (0x014C, "x86"), (0xAA64, "arm64")]
)
def test_architecture_from_pe_machine_field(tmp_path, machine, expected):
    path = _write(tmp_path, "tool.exe", make_pe(machine))
    info = px.inspect_binary(path, "tool.exe")
    assert info.file_type == "exe"
    assert info.machine == machine
    assert info.architecture == expected


def test_installer_stub_uses_filename_architecture(tmp_path):
    path = _write(tmp_path, "a.exe", make_pe(0x014C))
    info = px.inspect_binary(path, "WLT_0.3.1_x64-setup.exe")
    assert info.architecture == "x64"
    assert info.machine == 0x014C
    assert any("32비트" in w for w in info.warnings)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("CPU / Memory / GPU monitor for Windows x64 (tray)", "x64"),
        ("Native ARM64 build", "arm64"),
        ("A 32-bit x86 helper", ""),
        ("Box64x editor", ""),
    ],
)
def test_arch_hint_only_trusts_explicit_64bit_markers(text, expected):
    assert px._arch_hint(text) == expected


@pytest.mark.parametrize(
    ("filename", "data"),
    [
        ("fake.exe", b"this is not an executable at all" * 4),
        ("dos-only.exe", b"MZ" + b"\x00" * 200),  # MZ 는 있지만 PE 시그니처 없음
        ("renamed.msi", make_pe()),  # 확장자와 내용 불일치
        ("renamed.zip", make_pe()),
        ("archive.7z", b"PK\x03\x04" + b"\x00" * 64),
    ],
)
def test_magic_number_mismatch_is_rejected(tmp_path, filename, data):
    path = _write(tmp_path, filename, data)
    with pytest.raises(px.BinaryValidationError):
        px.inspect_binary(path, filename)


@pytest.mark.parametrize("filename", ["script.bat", "tool.exe.txt", "payload.scr", "noext"])
def test_extension_whitelist(filename):
    with pytest.raises(px.BinaryValidationError):
        px.file_type_from_name(filename)


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("My-App_1.2.3_x64-setup.exe", ("My App", "1.2.3", "x64")),
        ("CMG Monitor Setup 1.0.0.exe", ("CMG Monitor", "1.0.0", "unknown")),
        ("tool-v2.10-arm64.zip", ("tool", "2.10", "arm64")),
        ("plain.exe", ("plain", "", "unknown")),
    ],
)
def test_guess_from_filename(filename, expected):
    assert px.guess_from_filename(filename) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1, 2, 3, 0", "1.2.3"),
        ("10.0.26100.9818 (WinBuild.160101.0800)", "10.0.26100.9818"),
        ("1.2.3+abcdef", "1.2.3"),
        ("v2.0", "2.0"),
        ("", ""),
        ("release build", ""),
    ],
)
def test_normalize_version(raw, expected):
    assert px.normalize_version(raw) == expected


def test_zip_picks_main_exe_and_falls_back_without_one(tmp_path):
    with_exe = tmp_path / "bundle.zip"
    with zipfile.ZipFile(with_exe, "w") as zf:
        zf.writestr("App/readme.txt", "hello")
        zf.writestr("App/uninstall.exe", make_pe(0x014C) + b"\x00" * 4096)
        zf.writestr("App/App.exe", make_pe(0xAA64))
    info = px.inspect_binary(with_exe, "bundle.zip")
    assert info.file_type == "zip"
    assert info.inner_path == "App/App.exe"
    assert info.architecture == "arm64"

    without = tmp_path / "docs-1.4.zip"
    with zipfile.ZipFile(without, "w") as zf:
        zf.writestr("readme.txt", "hello")
    info = px.inspect_binary(without, "docs-1.4.zip")
    assert info.inner_path == ""
    assert info.from_filename and info.product_name == "docs"
    assert info.suggested_version("docs-1.4.zip") == "1.4"


def test_ico_to_png_picks_largest_frame():
    src = Image.new("RGBA", (64, 64), (255, 0, 0, 255))
    buf = io.BytesIO()
    src.save(buf, format="ICO", sizes=[(16, 16), (32, 32), (64, 64)])
    png = px.ico_to_png(buf.getvalue())
    with Image.open(io.BytesIO(png)) as out:
        assert out.format == "PNG"
        assert out.size == (px.ICON_SIZE, px.ICON_SIZE)
        assert out.getpixel((128, 128))[:3] == (255, 0, 0)


@pytest.mark.skipif(not NOTEPAD.exists(), reason="실제 Windows 바이너리가 있을 때만")
def test_real_windows_binary_metadata_and_icon():
    info = px.inspect_binary(NOTEPAD, "notepad.exe")
    assert info.architecture == "x64"
    assert info.company_name == "Microsoft Corporation"
    assert info.file_description
    assert info.suggested_version("notepad.exe")[0].isdigit()
    assert info.icon_png and info.icon_png[:8] == b"\x89PNG\r\n\x1a\n"
    assert not info.from_filename


def test_isolated_run_reports_architecture_and_rejects_mismatch(tmp_path):
    exe = _write(tmp_path, "upload.part", make_pe(0x8664))
    result = px.run_isolated(exe, "My-Tool_2.1.0_x64-setup.exe", tmp_path / "icon.png")
    assert result["architecture"] == "x64"
    assert result["suggested"] == {"name": "My Tool", "version": "2.1.0", "summary": ""}
    assert not (tmp_path / "icon.png").exists()  # 아이콘 없는 PE

    fake = _write(tmp_path, "fake.part", b"<html><script>alert(1)</script></html>" * 4)
    assert "error" in px.run_isolated(fake, "fake.exe", tmp_path / "x.png")
