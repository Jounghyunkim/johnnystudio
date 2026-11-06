#!/usr/bin/env python3
"""빌드된 정적 사이트 검사. scripts/check.sh 가 부른다.

사용법: python3 scripts/check_site.py [웹루트=web/out] [--built]

  --built   Next.js 빌드 결과를 검사한다. 프레임워크가 넣는 인라인 <script>(RSC 데이터)는 허용하되,
            페이지의 CSP <meta> 에 그 스크립트의 SHA-256 해시가 모두 들어 있어야 한다
            (web/scripts/inject-csp.mjs 가 넣는다. 여기서는 HTMLParser 로 따로 계산해서 맞춰 본다. ADR-0007).
            인라인 스타일·이벤트 속성, 깨진 링크, 외부 리소스는 그대로 잡는다.

규칙의 출처는 AGENTS.md §5 와 deploy/nginx/johnnystudio.conf 의 CSP 다.
Python 표준 라이브러리만 쓴다.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

REQUIRED_META = ("description", "viewport")
SKIP_PREFIXES = ("mailto:", "tel:", "data:", "javascript:")
EXTERNAL_PREFIXES = ("http://", "https://", "//")
# 웹 루트 밖(서버의 /opt/johnnystudio/files)에서 nginx 가 내주는 경로. 빌드 결과에는 없으므로 건너뛴다
SERVER_ONLY_PREFIXES = ("/files/",)
# CSP img-src 에 허용한 외부 호스트 (deploy/nginx/johnnystudio.conf 와 맞춘다)
ALLOWED_EXTERNAL_IMG_HOSTS = {"i.ytimg.com"}
# 외부 주소를 가리켜도 리소스를 불러오지 않는 <link rel> 값
NON_RESOURCE_RELS = {
    "canonical", "alternate", "me", "author", "license",
    "external", "next", "prev", "help", "search",
}
# 실행되지 않는 데이터 블록이라 CSP 에 걸리지 않는 인라인 <script type>
INLINE_SCRIPT_TYPES_OK = {"application/ld+json"}

# CSS 안의 @import 와 url(...) 참조
CSS_REF = re.compile(
    r"""@import\s+(?:url\(\s*)?["']?(?P<imp>[^"')\s;]+)"""
    r"""|url\(\s*["']?(?P<url>[^"')]+?)["']?\s*\)"""
)
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.S)


class Page(HTMLParser):
    """HTML 한 파일에서 검사에 필요한 정보를 모은다."""

    def __init__(self, allow_inline_scripts: bool = False) -> None:
        super().__init__(convert_charrefs=True)
        self.allow_inline_scripts = allow_inline_scripts
        self.lang: str | None = None
        self.title = ""
        self.meta: dict[str, str] = {}
        self.ids: set[str] = set()
        self.refs: list[tuple[int, str, str, str]] = []  # (줄, 태그, rel, 주소)
        self.problems: list[tuple[int, str]] = []
        self._in_title = False
        # CSP: <meta http-equiv="Content-Security-Policy"> 와 실행되는 인라인 스크립트의 해시
        # 빌드된 HTML 은 한 줄이라 줄 번호 대신 태그 순서(order)로 앞뒤를 비교한다
        self.meta_csp: tuple[int, int, str] | None = None  # (줄, 순서, 정책)
        self.inline_hashes: list[tuple[int, int, str]] = []  # (줄, 순서, 해시)
        self._script: tuple[int, int, list[str]] | None = None
        self._order = 0

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
        self._order += 1
        a = {k: (v or "") for k, v in attrs}

        if a.get("id"):
            self.ids.add(a["id"])
        if "style" in a:
            self.problems.append((line, f'<{tag} style="…"> 인라인 스타일 (CSP 가 막는다 → CSS 파일로)'))
        for name in a:
            if name.startswith("on"):
                self.problems.append(
                    (line, f"<{tag} {name}=…> 인라인 이벤트 (CSP 가 막는다 → JS 파일에서 addEventListener)")
                )

        if tag == "html":
            self.lang = a.get("lang") or None
        elif tag == "title":
            self._in_title = True
        elif tag == "meta" and a.get("name"):
            self.meta[a["name"].lower()] = a.get("content", "")
        elif tag == "meta" and a.get("http-equiv", "").lower() == "content-security-policy":
            self.meta_csp = (line, self._order, a.get("content", ""))
        elif tag == "style":
            self.problems.append((line, "<style> 블록 (CSP 가 막는다 → CSS 파일로)"))
        elif tag == "script" and not a.get("src") and a.get("type", "").lower() not in INLINE_SCRIPT_TYPES_OK:
            if self.allow_inline_scripts:
                self._script = (line, self._order, [])  # 본문을 모아서 끝 태그에서 해시한다
            else:
                self.problems.append((line, "인라인 <script> (CSP 가 막는다 → JS 파일로)"))
        elif tag == "img" and "alt" not in a:
            self.problems.append((line, '<img> 에 alt 가 없다 (장식용 이미지라면 alt="")'))

        for attr in ("href", "src"):
            if a.get(attr):
                self.refs.append((line, tag, a.get("rel", "").lower(), a[attr].strip()))

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._script is not None:
            line, order, parts = self._script
            digest = base64.b64encode(hashlib.sha256("".join(parts).encode("utf-8")).digest()).decode()
            self.inline_hashes.append((line, order, f"'sha256-{digest}'"))
            self._script = None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._script is not None:
            self._script[2].append(data)


class Checker:
    def __init__(self, root: Path, built: bool = False) -> None:
        self.root = root
        self.built = built
        self.errors: list[str] = []
        self.page_ids: dict[Path, set[str]] = {}

    def report(self, file: Path, line: int, msg: str) -> None:
        self.errors.append(f"{os.path.relpath(file)}:{line}: {msg}")

    def resolve(self, base_file: Path, path: str) -> Path:
        base = self.root if path.startswith("/") else base_file.parent
        target = (base / path.lstrip("/")).resolve()
        if path.endswith("/") or target.is_dir():
            target = target / "index.html"
        return target

    def check_local(self, file: Path, line: int, url: str) -> Path | None:
        """로컬 주소가 가리키는 파일을 돌려준다. 문제가 있으면 보고하고 None."""
        path = unquote(urlsplit(url).path)
        if not path:  # "#id" 처럼 같은 문서를 가리킨다
            return file
        if path.startswith(SERVER_ONLY_PREFIXES):
            return None
        target = self.resolve(file, path)
        if not target.is_relative_to(self.root):
            self.report(file, line, f"웹 루트 밖을 가리킨다: {url}")
            return None
        if not target.exists():
            self.report(file, line, f"파일이 없다: {url}")
            return None
        return target

    def check_html_ref(self, file: Path, line: int, tag: str, rel: str, url: str) -> None:
        low = url.lower()
        if low.startswith(SKIP_PREFIXES):
            return
        if low.startswith(EXTERNAL_PREFIXES):
            is_plain_link = tag == "a" or (
                tag == "link" and rel and set(rel.split()) <= NON_RESOURCE_RELS
            )
            allowed_img = tag == "img" and urlsplit(url).hostname in ALLOWED_EXTERNAL_IMG_HOSTS
            if not (is_plain_link or allowed_img):
                self.report(file, line, f"외부 리소스 로드 금지 (web/public/ 에 두기): {url}")
            return
        target = self.check_local(file, line, url)
        fragment = urlsplit(url).fragment
        if target is not None and fragment and target.suffix == ".html":
            ids = self.page_ids.get(target)
            if ids is not None and fragment not in ids:
                self.report(file, line, f'앵커 대상 id="{fragment}" 가 없다: {url}')

    def check_html(self, files: list[Path]) -> None:
        pages: dict[Path, Page] = {}
        for f in files:
            page = Page(allow_inline_scripts=self.built)
            try:
                page.feed(f.read_text(encoding="utf-8"))
                page.close()
            except UnicodeDecodeError:
                self.report(f, 1, "UTF-8 이 아니다")
                continue
            pages[f] = page
            self.page_ids[f] = page.ids

        for f, page in pages.items():
            if not page.lang:
                self.report(f, 1, '<html lang="…"> 이 없다')
            if not page.title.strip():
                self.report(f, 1, "<title> 이 없거나 비어 있다")
            for name in REQUIRED_META:
                if not page.meta.get(name):
                    self.report(f, 1, f'<meta name="{name}"> 이 없다')
            for line, msg in page.problems:
                self.report(f, line, msg)
            if self.built:
                self.check_csp(f, page)
            for line, tag, rel, url in page.refs:
                self.check_html_ref(f, line, tag, rel, url)

    def check_csp(self, file: Path, page: Page) -> None:
        """출시 빌드: 인라인 스크립트는 CSP <meta> 의 해시로만 허용된다"""
        if page.meta_csp is None:
            self.report(file, 1, "CSP <meta> 가 없다 (npm run build 가 web/scripts/inject-csp.mjs 를 돌렸는지 확인)")
            return
        meta_line, meta_order, policy = page.meta_csp
        directives = {d.split()[0]: d.split()[1:] for d in policy.split(";") if d.strip()}
        allowed = set(directives.get("script-src", []))
        if "'unsafe-inline'" in allowed:
            self.report(file, meta_line, "CSP <meta> 의 script-src 에 'unsafe-inline' 이 있다")
        for line, order, digest in page.inline_hashes:
            if order < meta_order:
                self.report(file, line, "인라인 <script> 가 CSP <meta> 보다 앞에 있다 (브라우저가 막지 못한다)")
            if digest not in allowed:
                self.report(file, line, f"인라인 <script> 의 해시 {digest} 가 CSP <meta> 에 없다")

    def check_css(self, files: list[Path]) -> None:
        for f in files:
            text = f.read_text(encoding="utf-8")
            # 주석은 지우되 줄 번호가 유지되도록 줄바꿈은 남긴다
            text = CSS_COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), text)
            for m in CSS_REF.finditer(text):
                url = (m.group("imp") or m.group("url") or "").strip()
                line = text.count("\n", 0, m.start()) + 1
                low = url.lower()
                if not url or low.startswith(("data:", "#")):
                    continue
                if low.startswith(EXTERNAL_PREFIXES):
                    self.report(f, line, f"외부 리소스 로드 금지 (web/public/ 에 두기): {url}")
                    continue
                self.check_local(f, line, url)

    def check_json(self, files: list[Path]) -> None:
        for f in files:
            try:
                json.loads(f.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                self.report(f, e.lineno, f"JSON 문법 오류: {e.msg}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="빌드된 정적 사이트 검사")
    parser.add_argument("root", nargs="?", default="web/out", help="웹 루트 (기본 web/out)")
    parser.add_argument("--built", action="store_true", help="Next.js 빌드 결과: 프레임워크의 인라인 <script> 허용")
    args = parser.parse_args(argv[1:])

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"  ✗ 웹 루트가 없다: {root}")
        return 2

    html = sorted(p.resolve() for p in root.rglob("*.html"))
    css = sorted(p.resolve() for p in root.rglob("*.css"))
    data = sorted(p.resolve() for ext in ("*.json", "*.webmanifest") for p in root.rglob(ext))

    checker = Checker(root, built=args.built)
    checker.check_html(html)
    checker.check_css(css)
    checker.check_json(data)

    print(f"  HTML {len(html)}개 · CSS {len(css)}개 · JSON {len(data)}개 검사")
    if checker.errors:
        for e in checker.errors:
            print(f"  ✗ {e}")
        print(f"  → 문제 {len(checker.errors)}건")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
