# 아키텍처

> **Last Updated**: 2026-11-05

## 1. 한눈에 보기

```
[방문자] ──HTTP(S)──▶ iptime 공유기 (80/443 → M8 192.168.0.206)
                          │
                          ▼
                 M8 nginx ─┬─ server_name johnnyhouse.iptime.org → Arkurator 백엔드 (기존, 건드리지 않음)
                           └─ server_name <JohnnyStudio 도메인>   → /opt/johnnystudio/current (정적 파일)
                                                                     ▲
     ~/workspace/JohnnyStudio/src ──── deploy/deploy.sh ─────────────┘
                                       (새 릴리스 폴더에 복사 → current 링크 교체)
```

- 서버에서 도는 코드가 없다. nginx 가 파일만 내려준다.
- 결정 배경: [ADR-0001](adr/0001-static-html-stack.md) (정적 사이트), [ADR-0002](adr/0002-deploy-home-server-nginx.md) (배포)
- 도메인은 아직 정하지 않았다. 정하기 전까지는 `./scripts/dev.sh` 로 확인한다.

## 2. 소스 구조

```
src/                         ← 웹 루트
├── index.html               홈 (허브)
├── 404.html                 없는 주소 안내 (nginx error_page)
├── robots.txt               출시 전에는 색인을 막는다
└── assets/
    ├── css/
    │   ├── main.css         진입점. 아래 네 파일을 순서대로 @import 한다
    │   ├── tokens.css       디자인 토큰 (CSS 변수, 라이트/다크)
    │   ├── base.css         리셋, 기본 요소, 접근성 (skip-link, focus)
    │   ├── layout.css       container, 헤더, 섹션, 푸터
    │   └── components.css   brand, nav, hero, card, badge
    ├── js/main.js           보조 스크립트 (ES 모듈)
    └── img/favicon.svg      임시 파비콘
```

## 3. 규칙

- **페이지 추가**: `src/<이름>/index.html` 을 만들면 주소는 `/<이름>/` 이다. 헤더·푸터는 `index.html` 에서 복사한다.
  페이지가 늘어 복사가 부담이 되면 ADR-0001 의 재검토 조건에 따라 SSG 전환을 검토한다.
- **경로**: 루트 기준 절대경로를 쓴다 (`/assets/css/main.css`, `/#projects`). 404 페이지는 어느 주소에서든 열리기 때문이다.
- **CSP**: 운영 nginx 가 `default-src 'self'` 로 인라인 스크립트·스타일과 외부 리소스를 막는다.
  `<script>`·`<style>` 블록, `style=""`, `on*=""` 속성은 쓰지 않는다. `scripts/check.sh` 가 이것을 검사한다.
- **캐시** (nginx):

  | 대상 | 캐시 | 이유 |
  |---|---|---|
  | HTML | 매번 재검증 (`no-cache`) | 배포가 바로 보이게 |
  | CSS·JS | 1시간 | 파일명에 해시가 없어서 오래 두지 않는다 |
  | 이미지·폰트 | 30일 | 거의 바뀌지 않는다. 바꿀 때는 파일명을 바꾼다 |

  CSS·JS 를 배포한 직후 바뀐 내용이 안 보이면 강력 새로고침(Ctrl+Shift+R)을 한다.

## 4. 검사 (`scripts/check.sh`)

| 대상 | 검사 내용 |
|---|---|
| HTML | `lang`·`title`·`description`·`viewport` 존재, 내부 링크·리소스 파일 존재, `#앵커` 대상 `id` 존재, `<img alt>`, 인라인 스크립트·스타일·이벤트 속성 금지, 외부 리소스 로드 금지 |
| CSS | `@import`·`url()` 이 가리키는 파일 존재, 외부 URL 금지 |
| JSON | 문법 |
| 셸 스크립트 | `bash -n` 문법 검사 |
| 전체 텍스트 | CRLF 줄바꿈 금지 |

검사 코드는 `scripts/check_site.py` (Python 표준 라이브러리만 사용).
