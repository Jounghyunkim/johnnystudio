"""소개 자료 (ADR-0013): Store 앱·Showroom 서비스의 상세 소개.

이름·한 줄 소개·설명·분류는 앱·서비스 테이블에 그대로 두고, 그 밖의 소개(연관 검색어·추천 대상·주요 기능·사용 방법·
필요한 환경·가격·자주 묻는 질문·관련 링크·그림 모음·만든 이·지원 정보)를 JSON 한 덩어리로 둔다 (store_app_pages · showroom_service_pages).

항목과 한도는 Microsoft Store(Partner Center) 등록 항목과 함께 쓸 수 있게 맞췄다 (2026-11-25 사용자 요청):
설명 10,000자 · 제품 기능 20개(이름 — 설명이 200자 안) · 검색어 7개×30자 · 스크린샷 10장·설명 200자 ·
추가 시스템 요구 사항 최소·권장 각 11개×200자 · 저작권 200자 · 개인정보처리방침·웹 사이트·지원 연락처 · 분류.

- 회원이 쓴 글이다. 서버는 글자만 정리하고(clean_line·clean_text), 웹은 HTML 로 넣지 않는다.
- 그림은 자식 프로세스(analyze.run_screenshot_isolated)가 다시 그린 WebP 만 저장하고 낸다. 원본을 내주지 않는다.
- 그림 파일: <store_dir>/gallery/<store|showroom>/<코드>/<그림 ID>.webp. 그림 ID 는 무작위라서 한 번 올린 그림은 바뀌지 않는다.
- 웹이 md·zip 을 읽어 양식을 채운다 (web/src/lib/listing-format.ts). 서버는 zip 을 받지 않는다.

auth.py → store.service → 이 모듈 순서로 가져오므로 여기서는 auth.py 를 가져오지 않는다 (오류는 ListingError).
"""

from __future__ import annotations

import logging
import re
import secrets
import shutil
from pathlib import Path
from typing import Annotated, Any

from pydantic import BaseModel, Field

from .config import Settings
from .store.files import remove

log = logging.getLogger("johnnystudio.listing")

KINDS = ("store", "showroom")
IMAGE_ID = re.compile(r"^[0-9a-f]{16}$")
_CODE = re.compile(r"^[0-9A-Za-z]{4,12}$")

# 한도 (웹 lib/listing.ts 의 LISTING_LIMITS 와 같게 둔다. 바꾸면 둘 다 고친다). 괄호는 Microsoft Store 의 한도
KEYWORDS_MAX, KEYWORD_LEN = 7, 30  # 검색어 (7개, 30자)
AUDIENCE_MAX, AUDIENCE_LEN = 5, 100
FEATURES_MAX, FEATURE_TITLE_LEN, FEATURE_TEXT_LEN = 20, 40, 150  # 제품 기능 (20개, 200자: "이름 — 설명" 이 넘지 않게)
STEPS_MAX, STEP_LEN = 8, 200
REQUIREMENTS_MAX, REQUIREMENT_LEN = 11, 200  # 추가 시스템 요구 사항 최소·권장 (각 11개, 200자)
PRICING_LEN = 80
FAQ_MAX, QUESTION_LEN, ANSWER_LEN = 8, 120, 600
LINKS_MAX, LINK_LABEL_LEN = 5, 30
GALLERY_MAX, CAPTION_LEN = 10, 200  # 스크린샷 (데스크톱 10장, 설명 200자)
DEVELOPER_LEN, COPYRIGHT_LEN, LICENSE_LEN = 80, 200, 200  # 개발자 (255자) · 저작권 및 상표 정보 (200자)
SUPPORT_LEN = 320

# Microsoft Store 분류 (Partner Center 의 앱 범주. 하위 범주는 받지 않는다)
MS_CATEGORIES: dict[str, str] = {
    "books-reference": "Books + reference (책·참고 자료)",
    "business": "Business (비즈니스)",
    "developer-tools": "Developer tools (개발자 도구)",
    "education": "Education (교육)",
    "entertainment": "Entertainment (엔터테인먼트)",
    "food-dining": "Food + dining (음식·식당)",
    "government-politics": "Government + politics (정부·정치)",
    "health-fitness": "Health + fitness (건강·운동)",
    "kids-family": "Kids + family (어린이·가족)",
    "lifestyle": "Lifestyle (라이프스타일)",
    "medical": "Medical (의료)",
    "multimedia-design": "Multimedia design (멀티미디어 디자인)",
    "music": "Music (음악)",
    "navigation-maps": "Navigation + maps (내비게이션·지도)",
    "news-weather": "News + weather (뉴스·날씨)",
    "personal-finance": "Personal finance (개인 금융)",
    "personalization": "Personalization (개인 설정)",
    "photo-video": "Photo + video (사진·비디오)",
    "productivity": "Productivity (생산성)",
    "security": "Security (보안)",
    "shopping": "Shopping (쇼핑)",
    "social": "Social (소셜)",
    "sports": "Sports (스포츠)",
    "travel": "Travel (여행)",
    "utilities-tools": "Utilities + tools (유틸리티·도구)",
    "games": "Games (게임)",
}

_EMAIL = re.compile(r"^[^@\s]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$")
_MS_STORE = re.compile(r"^https://apps\.microsoft\.com/detail/[0-9A-Za-z]{12}/?(\?hl=[A-Za-z-]{2,10})?$")
IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024  # 회원이 올리는 그림 원본 (nginx 본문 한도 안)
IMAGE_MAX_BYTES = 3 * 1024 * 1024  # 다시 그린 WebP


class ListingError(ValueError):
    """회원에게 그대로 보여 줄 입력 오류 (라우터가 400 으로 바꾼다)"""


# ── 입력 모양 (넉넉한 원본 한도. 정확한 글자 수는 clean_page 가 본다) ──

Short = Annotated[str, Field(max_length=800)]


class FeatureIn(BaseModel):
    title: str = Field(max_length=400)
    text: str = Field(default="", max_length=2400)
    image: str | None = Field(default=None, max_length=40)


class FaqIn(BaseModel):
    q: str = Field(max_length=800)
    a: str = Field(max_length=4000)


class LinkIn(BaseModel):
    label: str = Field(max_length=400)
    url: str = Field(max_length=1000)


class ImageIn(BaseModel):
    id: str = Field(max_length=40)
    caption: str = Field(default="", max_length=800)


class PageIn(BaseModel):
    keywords: list[Short] = Field(default_factory=list, max_length=40)
    audience: list[Short] = Field(default_factory=list, max_length=40)
    features: list[FeatureIn] = Field(default_factory=list, max_length=40)
    steps: list[Short] = Field(default_factory=list, max_length=40)
    requirements: list[Short] = Field(default_factory=list, max_length=40)
    recommended: list[Short] = Field(default_factory=list, max_length=40)
    pricing: str = Field(default="", max_length=800)
    faq: list[FaqIn] = Field(default_factory=list, max_length=40)
    links: list[LinkIn] = Field(default_factory=list, max_length=40)
    gallery: list[ImageIn] = Field(default_factory=list, max_length=40)
    developer: str = Field(default="", max_length=800)
    copyright: str = Field(default="", max_length=800)
    license: str = Field(default="", max_length=800)
    website: str = Field(default="", max_length=1000)
    support: str = Field(default="", max_length=1000)
    privacy_url: str = Field(default="", max_length=1000)
    ms_store_url: str = Field(default="", max_length=1000)
    ms_category: str = Field(default="", max_length=60)


# ── 정리 ──


def empty_page() -> dict[str, Any]:
    return {
        "keywords": [],
        "audience": [],
        "features": [],
        "steps": [],
        "requirements": [],
        "pricing": "",
        "faq": [],
        "links": [],
        "gallery": [],
        "recommended": [],
        "developer": "",
        "copyright": "",
        "license": "",
        "website": "",
        "support": "",
        "privacy_url": "",
        "ms_store_url": "",
        "ms_category": "",
    }


def _line(raw: str, label: str, max_len: int) -> str:
    from .store.service import clean_line

    text = clean_line(raw)
    if len(text) > max_len:
        raise ListingError(f"{label}은(는) {max_len}자까지 쓸 수 있습니다.")
    return text


def _text(raw: str, label: str, max_len: int) -> str:
    from .store.service import clean_text

    text = clean_text(raw)
    if len(text) > max_len:
        raise ListingError(f"{label}은(는) {max_len}자까지 쓸 수 있습니다.")
    return text


def _lines(items: list[str], label: str, max_items: int, max_len: int, *, unique: bool = False) -> list[str]:
    out: list[str] = []
    for raw in items:
        text = _line(raw, label, max_len)
        if not text or (unique and text.casefold() in (x.casefold() for x in out)):
            continue
        out.append(text)
    if len(out) > max_items:
        raise ListingError(f"{label}은(는) {max_items}개까지 넣을 수 있습니다.")
    return out


def clean_link(raw: str) -> str | None:
    """관련 링크: Showroom 서비스 주소와 같은 규칙 (https, 도메인, 사용자 정보 없음)"""
    from .showroom.service import clean_url

    return clean_url(raw)


def _https(raw: str, label: str) -> str:
    text = raw.strip()
    if not text:
        return ""
    url = clean_link(text)
    if url is None:
        raise ListingError(f"{label}는 https:// 로 시작하는 도메인 주소여야 합니다.")
    return url


def _support(raw: str) -> str:
    """지원 연락처: https 주소 또는 이메일 (Microsoft Store 의 '지원 연락처 정보'와 같다)"""
    text = raw.strip()
    if not text:
        return ""
    if "@" in text and "/" not in text:
        if len(text) > SUPPORT_LEN or not _EMAIL.match(text):
            raise ListingError("지원 연락처는 https 주소나 이메일 주소로 적어 주세요.")
        return text
    return _https(text, "지원 연락처")


def _ms_store(raw: str) -> str:
    text = raw.strip()
    if not text:
        return ""
    if not _MS_STORE.match(text):
        raise ListingError("Microsoft Store 주소는 https://apps.microsoft.com/detail/<제품 ID 12자> 모양이어야 합니다.")
    return text


def clean_page(body: PageIn, current: dict[str, Any] | None) -> dict[str, Any]:
    """회원이 보낸 소개 자료를 정리한다. 그림 모음은 이미 올린 그림(current 의 gallery)의 순서·설명만 바꿀 수 있다."""
    known = {g["id"]: g for g in (current or {}).get("gallery", []) if isinstance(g, dict) and IMAGE_ID.match(str(g.get("id", "")))}
    gallery: list[dict[str, Any]] = []
    for item in body.gallery:
        if item.id not in known:
            raise ListingError("올리지 않은 그림이 들어 있습니다. 그림을 다시 올려 주세요.")
        if any(g["id"] == item.id for g in gallery):
            continue
        gallery.append({**known[item.id], "caption": _line(item.caption, "그림 설명", CAPTION_LEN)})
    if len(gallery) > GALLERY_MAX:
        raise ListingError(f"그림은 {GALLERY_MAX}장까지 넣을 수 있습니다.")
    ids = {g["id"] for g in gallery}

    features: list[dict[str, Any]] = []
    for f in body.features:
        title = _line(f.title, "기능 이름", FEATURE_TITLE_LEN)
        text = _text(f.text, "기능 설명", FEATURE_TEXT_LEN)
        if not title and not text:
            continue
        if not title:
            raise ListingError("기능마다 이름을 적어 주세요.")
        image = f.image if f.image and f.image in ids else None
        features.append({"title": title, "text": text, "image": image})
    if len(features) > FEATURES_MAX:
        raise ListingError(f"주요 기능은 {FEATURES_MAX}개까지 넣을 수 있습니다.")

    faq: list[dict[str, str]] = []
    for item in body.faq:
        q = _line(item.q, "질문", QUESTION_LEN)
        a = _text(item.a, "답", ANSWER_LEN)
        if not q and not a:
            continue
        if not q or not a:
            raise ListingError("자주 묻는 질문에는 질문과 답을 함께 적어 주세요.")
        faq.append({"q": q, "a": a})
    if len(faq) > FAQ_MAX:
        raise ListingError(f"자주 묻는 질문은 {FAQ_MAX}개까지 넣을 수 있습니다.")

    links: list[dict[str, str]] = []
    for item in body.links:
        label = _line(item.label, "링크 이름", LINK_LABEL_LEN)
        raw_url = item.url.strip()
        if not label and not raw_url:
            continue
        url = clean_link(raw_url)
        if url is None:
            raise ListingError(f"관련 링크 주소는 https:// 로 시작하는 도메인 주소여야 합니다: {label or raw_url[:60]}")
        if any(x["url"] == url for x in links):
            continue
        links.append({"label": label or (urlsplit_host(url)), "url": url})
    if len(links) > LINKS_MAX:
        raise ListingError(f"관련 링크는 {LINKS_MAX}개까지 넣을 수 있습니다.")

    if body.ms_category and body.ms_category not in MS_CATEGORIES:
        raise ListingError("Microsoft Store 분류를 목록에서 골라 주세요.")

    return {
        "keywords": _lines(body.keywords, "연관 검색어", KEYWORDS_MAX, KEYWORD_LEN, unique=True),
        "audience": _lines(body.audience, "추천 대상", AUDIENCE_MAX, AUDIENCE_LEN),
        "features": features,
        "steps": _lines(body.steps, "사용 방법", STEPS_MAX, STEP_LEN),
        "requirements": _lines(body.requirements, "필요한 환경", REQUIREMENTS_MAX, REQUIREMENT_LEN),
        "recommended": _lines(body.recommended, "권장 환경", REQUIREMENTS_MAX, REQUIREMENT_LEN),
        "pricing": _line(body.pricing, "가격", PRICING_LEN),
        "faq": faq,
        "links": links,
        "gallery": gallery,
        "developer": _line(body.developer, "개발자", DEVELOPER_LEN),
        "copyright": _line(body.copyright, "저작권·상표 정보", COPYRIGHT_LEN),
        "license": _line(body.license, "라이선스", LICENSE_LEN),
        "website": _https(body.website, "웹 사이트 주소"),
        "support": _support(body.support),
        "privacy_url": _https(body.privacy_url, "개인정보처리방침 주소"),
        "ms_store_url": _ms_store(body.ms_store_url),
        "ms_category": body.ms_category,
    }


def meta_out() -> dict[str, Any]:
    """웹이 쓰는 소개 자료 정보 (Store·Showroom 의 /meta 에 들어간다)"""
    return {"ms_categories": MS_CATEGORIES}


def urlsplit_host(url: str) -> str:
    from urllib.parse import urlsplit

    return urlsplit(url).hostname or url


def page_out(data: dict[str, Any] | None) -> dict[str, Any]:
    """응답용 (저장된 값에 빠진 칸이 있어도 모양을 맞춘다)"""
    page = empty_page()
    if data:
        page.update({k: data[k] for k in page if k in data})
    return page


def search_text(data: dict[str, Any]) -> str:
    """목록 검색에 쓰는 글 (연관 검색어). 소문자로 둔다"""
    return " ".join(data.get("keywords", [])).lower()[:400]


# ── 그림 파일 ──


class Gallery:
    """한 앱·서비스의 그림 폴더: <store_dir>/gallery/<kind>/<code>/"""

    def __init__(self, settings: Settings, kind: str, code: str) -> None:
        if kind not in KINDS or not _CODE.match(code):
            raise ValueError("그림 폴더 형식")
        self.dir = settings.store_dir / "gallery" / kind / code
        self.tmp = settings.store_dir / "gallery" / "tmp"

    def path(self, image_id: str) -> Path:
        if not IMAGE_ID.match(image_id):
            raise ValueError("그림 ID 형식")
        return self.dir / f"{image_id}.webp"

    def save(self, data: bytes) -> dict[str, Any]:
        """그림을 다시 그려 저장한다. 그림 모음에 넣을 항목을 돌려준다 (실패하면 ListingError)"""
        from .store.analyze import run_screenshot_isolated

        if not data:
            raise ListingError("빈 파일입니다.")
        self.dir.mkdir(parents=True, exist_ok=True, mode=0o750)
        self.tmp.mkdir(parents=True, exist_ok=True, mode=0o750)
        image_id = secrets.token_hex(8)
        src, out = self.tmp / f"{image_id}.src", self.tmp / f"{image_id}.webp"
        try:
            src.write_bytes(data)
            result = run_screenshot_isolated(src, out)
            head = out.read_bytes()[:12] if out.is_file() else b""
            if "error" in result or head[:4] != b"RIFF" or head[8:12] != b"WEBP" or out.stat().st_size > IMAGE_MAX_BYTES:
                raise ListingError(str(result.get("error") or "그림을 처리하지 못했습니다."))
            out.replace(self.path(image_id))
        finally:
            remove(src)
            remove(out)
        width, height = result.get("width"), result.get("height")
        return {
            "id": image_id,
            "caption": "",
            "width": width if isinstance(width, int) and width > 0 else 0,
            "height": height if isinstance(height, int) and height > 0 else 0,
        }

    def keep_only(self, ids: set[str]) -> None:
        """그림 모음에서 빠진 그림 파일을 지운다"""
        if not self.dir.is_dir():
            return
        for p in self.dir.glob("*.webp"):
            if p.stem not in ids:
                remove(p)

    def remove_all(self) -> None:
        if self.dir.is_dir():
            shutil.rmtree(self.dir, ignore_errors=True)


def remove_gallery(settings: Settings, kind: str, code: str) -> None:
    try:
        Gallery(settings, kind, code).remove_all()
    except ValueError:
        log.warning("그림 폴더 코드 형식이 아니다: %s", kind)
