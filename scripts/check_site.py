#!/usr/bin/env python3
"""정적 사이트 검사. scripts/check.sh 가 부른다.

사용법: python3 scripts/check_site.py [웹루트]   (기본값: src)

규칙의 출처는 AGENTS.md §5 와 deploy/nginx/johnnystudio.conf 의 CSP 다.
Python 표준 라이브러리만 쓴다.
"""

from __future__ import annotations

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

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lang: str | None = None
        self.title = ""
        self.meta: dict[str, str] = {}
        self.ids: set[str] = set()
        self.refs: list[tuple[int, str, str, str]] = []  # (줄, 태그, rel, 주소)
        self.problems: list[tuple[int, str]] = []
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
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
        elif tag == "style":
            self.problems.append((line, "<style> 블록 (CSP 가 막는다 → CSS 파일로)"))
        elif tag == "script" and not a.get("src"):
            if a.get("type", "").lower() not in INLINE_SCRIPT_TYPES_OK:
                self.problems.append((line, "인라인 <script> (CSP 가 막는다 → src/assets/js/ 로)"))
        elif tag == "img" and "alt" not in a:
            self.problems.append((line, '<img> 에 alt 가 없다 (장식용 이미지라면 alt="")'))

        for attr in ("href", "src"):
            if a.get(attr):
                self.refs.append((line, tag, a.get("rel", "").lower(), a[attr].strip()))

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


class Checker:
    def __init__(self, root: Path) -> None:
        self.root = root
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
            if not is_plain_link:
                self.report(file, line, f"외부 리소스 로드 금지 (src/assets/ 에 두기): {url}")
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
            page = Page()
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
            for line, tag, rel, url in page.refs:
                self.check_html_ref(f, line, tag, rel, url)

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
                    self.report(f, line, f"외부 리소스 로드 금지 (src/assets/ 에 두기): {url}")
                    continue
                self.check_local(f, line, url)

    def check_json(self, files: list[Path]) -> None:
        for f in files:
            try:
                json.loads(f.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                self.report(f, e.lineno, f"JSON 문법 오류: {e.msg}")


def main(argv: list[str]) -> int:
    root = Path(argv[1] if len(argv) > 1 else "src").resolve()
    if not root.is_dir():
        print(f"  ✗ 웹 루트가 없다: {root}")
        return 2

    html = sorted(p.resolve() for p in root.rglob("*.html"))
    css = sorted(p.resolve() for p in root.rglob("*.css"))
    data = sorted(p.resolve() for ext in ("*.json", "*.webmanifest") for p in root.rglob(ext))

    checker = Checker(root)
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
