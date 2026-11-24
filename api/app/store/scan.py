"""ClamAV 검사 (Store, ADR-0012). 통합 검토 문서 §6 S2 의 판단대로 상주 clamd 없이 clamscan 을 실행한다.

- 파일이 서버 밖으로 나가지 않는다. VirusTotal 같은 외부 서비스에 보내지 않는다.
- clamscan 은 실행할 때마다 시그니처를 읽어 메모리를 많이 쓴다. 그래서 한 번에 하나만 돌린다 (_lock).
- ClamAV 가 없으면 'skipped'(검사 안 함)로 남긴다. 운영은 JOHNNYSTUDIO_STORE_REQUIRE_SCAN 이 켜져 있어서
  'clean' 이 아니면 승인할 수 없다.
- 결과 문구는 "ClamAV <버전> · 시그니처 <번호> (<날짜>)" 처럼 엔진과 기준일을 함께 남긴다. '안전'을 보장하지 않는다.
"""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

log = logging.getLogger("johnnystudio.store")

_lock = threading.Lock()
SCAN_TIMEOUT = 15 * 60
_FOUND = re.compile(r":\s*(\S+)\s+FOUND\s*$", re.M)
# clamscan --version → "ClamAV 1.4.3/27831/Sun Nov 23 09:24:57 2026"
_VERSION = re.compile(r"^ClamAV\s+([\w.]+)(?:/(\d+)/(.+))?$")


@dataclass
class ScanResult:
    status: str  # clean | infected | error | skipped
    engine: str = ""
    detail: str = ""


def find_clamscan(command: str) -> str | None:
    return shutil.which(command) if command else None


def engine_label(version_output: str) -> str:
    m = _VERSION.match(version_output.strip())
    if not m:
        return "ClamAV"
    label = f"ClamAV {m.group(1)}"
    if m.group(2):
        label += f" · 시그니처 {m.group(2)}"
        try:
            label += f" ({datetime.strptime(m.group(3).strip(), '%a %b %d %H:%M:%S %Y').date().isoformat()})"
        except ValueError:
            pass
    return label


def _env() -> dict[str, str]:
    return {"PATH": "/usr/local/bin:/usr/bin:/bin", "LANG": "C", "LC_ALL": "C"}


def scan_file(path: Path, command: str, max_mb: int) -> ScanResult:
    exe = find_clamscan(command)
    if exe is None:
        why = "검사 설정이 꺼져 있습니다" if not command else "서버에 ClamAV 가 설치되어 있지 않습니다"
        return ScanResult("skipped", detail=why)
    with _lock:
        try:
            version = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=30, env=_env(), check=False)
            engine = engine_label(version.stdout)
            done = subprocess.run(
                [
                    exe,
                    "--no-summary",
                    "--stdout",
                    f"--max-filesize={max_mb}M",
                    f"--max-scansize={max_mb * 4}M",
                    # 한도를 넘어 다 보지 못한 파일은 '탐지 없음'이 아니라 따로 알린다 (아래에서 error 로 바꾼다)
                    "--alert-exceeds-max=yes",
                    str(path),
                ],
                capture_output=True,
                text=True,
                timeout=SCAN_TIMEOUT,
                env=_env(),
                check=False,
            )
        except subprocess.TimeoutExpired:
            return ScanResult("error", detail="검사 시간이 너무 오래 걸려 멈췄습니다")
        except OSError as err:
            return ScanResult("error", detail=f"clamscan 을 실행하지 못했습니다 ({err.strerror})")
    if done.returncode == 0:
        return ScanResult("clean", engine=engine)
    if done.returncode == 1:
        names = _FOUND.findall(done.stdout)
        name = names[0] if names else "알 수 없는 탐지"
        if name.startswith("Heuristics.Limits.Exceeded"):
            return ScanResult("error", engine=engine, detail="파일이 커서 끝까지 검사하지 못했습니다")
        return ScanResult("infected", engine=engine, detail=name[:200])
    tail = (done.stderr or done.stdout).strip().splitlines()[-1:] or [""]
    log.warning("clamscan 실패 (종료 코드 %s): %s", done.returncode, tail[0][:300])
    return ScanResult("error", engine=engine, detail="검사 도중 오류가 났습니다 (시그니처가 없거나 파일을 읽지 못함)")
