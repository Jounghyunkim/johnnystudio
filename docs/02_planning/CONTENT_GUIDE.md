# 콘텐츠 작성 가이드

> 작품·기록·소개 문구를 추가하거나 고치는 방법. 결정 배경은 [ADR-0005](../04_architecture/adr/0005-file-based-content.md).
> 형식의 정답은 코드에 있다: [web/src/lib/schema.ts](../../web/src/lib/schema.ts)
> **Last Updated**: 2026-11-22

## 0. 관리 화면으로 등록하기 (권장)

`./scripts/dev.sh` 를 띄우면 터미널에 관리 화면 주소가 찍힌다 ([ADR-0009](../04_architecture/adr/0009-local-portfolio-manager.md), [기능 명세](features/portfolio-manager.md)).

```
  작품 관리: http://localhost:3000/admin/#k=<토큰>
```

1. **새 작품** → 유형·이름·주소(slug)·한 줄 소개 → 초안 파일(`content/assets/<slug>.md`)이 생기고 편집기가 열린다
2. 편집기에서 채운다: 기본 정보, 대표 이미지(올리기), 유형별 정보(주소·영상·사진·설치 파일), 링크, 본문
   - 설치 파일을 올리면 크기·SHA-256 이 채워진다. 서버 복사 명령이 나오면 그대로 실행한다 (운영 다운로드 폴더가 있으면 바로 거기에 저장한다)
   - 저장하면 스키마로 검사하고, 틀린 칸은 옆에 이유가 나온다. 틀리면 파일을 쓰지 않는다
3. 오른쪽 **검사 결과**에서 "공개 전에 채울 것"이 비면 **공개하기** (= `draft` 지우기)
4. **미리보기**로 `/library/<slug>/` 를 확인한다 (개발 미리보기는 저장하면 바로 바뀐다)
5. 지금처럼 `./scripts/check.sh` → 커밋 → `./deploy/deploy.sh`

- 관리 화면은 **개발 서버에만** 있다. 출시 빌드·운영 사이트에는 없다
- 토큰은 `.local/admin-token` 에 있다. 주소를 아는 사람은 작품 파일을 고칠 수 있으니 공유하지 않는다 (지우면 다음 `dev.sh` 때 새로 만든다)
- `PUBLIC_URL` 로 인터넷에 열어도 관리 화면을 쓸 수 있다. 이때 토큰은 **실행할 때마다 새로 나오고**(터미널의 주소로 들어간다), 설치 파일은 `.local/files` 에 저장된다. http 주소라면 토큰이 암호화되지 않으니 공용 와이파이에서는 쓰지 않는다 ([ADR-0010](../04_architecture/adr/0010-admin-on-public-dev-server.md))
- 손으로 쓴 주석·키 순서는 지킨다. 편집기나 AI 도구로 같은 파일을 고친 뒤에 관리 화면에서 저장하면 "다시 불러오기"를 요구한다
- 삭제는 초안만, Life Log·서비스가 가리키지 않을 때만 된다. 파일은 `.local/trash/` 로 옮겨진다

터미널(AI 도구)에서는 같은 일을 CLI 로 한다.

```bash
npm --prefix web run admin -- list                     # 목록과 검사 결과
npm --prefix web run admin -- check hardware-monitor   # 자세한 검사 (문제가 있으면 종료 코드 1)
npm --prefix web run admin -- new my-tool --type desktop-app --title "내 도구" --summary "한 줄 소개"
npm --prefix web run admin -- publish my-tool          # 채울 것이 남아 있으면 거부한다
npm --prefix web run admin -- unpublish my-tool
```

## 1. 한눈에 (파일을 직접 고칠 때)

| 하고 싶은 일 | 고칠 파일 |
|---|---|
| 작품 추가·수정 | `content/assets/<slug>.md` (파일 하나 = 작품 하나, 파일명 = 주소) |
| Life Log 마일스톤 | `content/lifelog.yaml` |
| 홈·About·Work with me 문구, 서비스, 연락처 | `content/profile.yaml` |
| 홈(랜딩)의 단계·자주 묻는 질문·마지막 안내 | `content/profile.yaml` 의 `landing` (답은 지금 실제로 동작하는 것만 쓴다. 링크는 `/` 로 시작하는 사이트 안 주소) |
| 개인정보처리방침 같은 문서 페이지 | `content/pages/<slug>.md` (머리말: `title`·`description`·`updated`, 본문 Markdown) |
| 작품 이미지 | `web/public/media/<slug>/` (git 에 넣는다) |
| 다운로드 파일(exe·zip) | 서버 `/opt/johnnystudio/files/<slug>/` (git 에 넣지 않는다) |

고친 뒤의 순서는 다음과 같다.

```bash
./scripts/dev.sh        # 초안까지 보이는 미리보기 → http://127.0.0.1:3000
./scripts/check.sh      # 형식·완성도·링크 검사 + 출시 빌드
./scripts/preview.sh    # 실제로 배포될 모습 (초안 제외) → http://127.0.0.1:8080
```

## 2. 작품 파일 (`content/assets/<slug>.md`)

- 파일명(slug)은 영문 소문자·숫자·하이픈만 쓴다: `hardware-monitor.md` → `/library/hardware-monitor/`
- 맨 위 `---` 사이가 머리말(YAML)이고, 그 아래가 Markdown 본문(상세 페이지의 "소개")이다
- `_` 로 시작하는 파일은 읽지 않는다 (메모용)

### 공통 필드

| 필드 | 필수 | 설명 |
|---|---|---|
| `title` | ✓ | 이름 |
| `type` | ✓ | `web-app` `desktop-app` `web-package` `video` `gallery` `article` `hardware` |
| `summary` | ✓ | 한 줄 소개 (140자 이내). 카드와 검색에 쓰인다 |
| `status` | ✓ | `live`(운영 중) `beta` `dev`(개발 중) `archived`(보관) |
| `date` | 출시 시 | 시작 또는 공개한 날: `2025`, `2025-12`, `2025-12-19` |
| `updated` | | 마지막 업데이트 날 |
| `tags` | | `[AI, RAG]`. Library 에서 `#AI` 로 찾을 수 있다 |
| `cover` · `coverAlt` | | 대표 이미지 경로와 대체 텍스트 (이미지가 있으면 대체 텍스트도 필수) |
| `icon` | | 앱 아이콘 경로 (정사각형, 256px, png·webp). 대표 이미지가 없으면 카드·상세 가운데에 보인다. 이름 옆에 나오므로 대체 텍스트는 쓰지 않는다 |
| `featured` | | `true` 면 홈 "대표 작품"에 먼저 나온다 |
| `draft` | | `true` 면 개발 미리보기에서만 보인다 |
| `links` | | 추가 링크: `- { label: GitHub, href: https://… }` |

### 유형별 필드

| 유형 | 필드 | 출시하려면 |
|---|---|---|
| `web-app` | `url` | `url` |
| `desktop-app` | `downloads` (목록), `requirements` | 다운로드 1개 이상, 각각 `size`·`sha256` |
| `web-package` | `playUrl`(샌드박스 주소), `download` | 둘 중 하나 |
| `video` | `youtubeId` (watch?v= 뒤의 11자) | `youtubeId` |
| `gallery` | `photos` (목록: `src`, `alt`, `caption`) | 사진 1장 이상 |
| `article` | `url`, `source`(블로그 이름) | `url` |
| `hardware` | `photos`, `youtubeId` | 사진 또는 영상 |

### 예: 데스크톱 툴

```yaml
---
title: 하드웨어 모니터링 앱
type: desktop-app
summary: CPU·GPU 온도와 사용률을 작은 창에 띄워 주는 Windows 도구
status: live
date: 2024-05
tags: [데스크톱, 모니터링]
cover: /media/hardware-monitor/cover.webp
coverAlt: 작은 창에 CPU·GPU 그래프가 보이는 화면
requirements: Windows 10 이상
downloads:
  - label: Windows 설치 파일
    file: /files/hardware-monitor/hw-monitor-1.2.0-setup.exe
    version: 1.2.0
    os: [windows]
    size: 18874368
    sha256: <scripts/file-meta.sh 결과>
    released: 2026-11-01
    signed: false
    notes: 시작 속도 개선
---

## 무엇을 하나

본문은 Markdown 으로 쓴다.
```

### 다운로드 파일 올리기

```bash
./scripts/file-meta.sh ~/build/hw-monitor-1.2.0-setup.exe hardware-monitor     # downloads 에 붙일 YAML 출력
install -D -m 644 ~/build/hw-monitor-1.2.0-setup.exe /opt/johnnystudio/files/hardware-monitor/hw-monitor-1.2.0-setup.exe
```

`signed: false` 이면 상세 화면에 SmartScreen 경고 안내가 붙는다. 체크섬은 화면에서 복사할 수 있고, 검증 명령도 함께 보인다.

## 3. 이미지

- `web/public/media/<slug>/` 에 **webp** 로 둔다. 카드용은 가로 1200px 이하, 한 장 300KB 이하가 기준이다
- 모든 이미지에 대체 텍스트(`coverAlt`, `photos[].alt`)를 쓴다. 무엇이 보이는지 한 문장으로 쓴다 (앱 아이콘 `icon` 은 꾸밈 이미지라 예외)
- 앱 아이콘은 `icon.png`(또는 webp) 로 둔다. 작고 투명 배경이 흔해서 png 도 괜찮다
- 본문(Markdown)의 `https://` 링크는 새 탭으로 열린다 (빌드할 때 `target="_blank" rel="noopener noreferrer"` 를 붙인다)
- 외부 주소의 이미지는 쓰지 않는다 (CSP 가 막는다). YouTube 썸네일만 예외다

## 4. Life Log (`content/lifelog.yaml`)

```yaml
- date: 2026-06-01
  title: Arkwave 에서 Arkurator 로 이름을 바꾸다
  kind: milestone          # start | release | milestone | note
  description: 한두 문장 (선택)
  asset: arkurator         # 관련 작품 slug (선택). 넣으면 그 작품으로 연결된다
```

작품은 `date` 만 있으면 자동으로 타임라인에 들어간다. 그 작품을 가리키는 마일스톤이 있으면 작품 항목은 따로 넣지 않는다.

## 5. 초안과 샘플

- `draft: true`: 개발 미리보기(`dev.sh`)에서만 보이고 "초안" 표시가 붙는다. 출시 빌드(`check.sh`, `deploy.sh`, `preview.sh`)에서는 빠진다
- 초안을 지우고 출시하려면 **완성도 검사**를 통과해야 한다: 날짜, 유형별 필수 값, 실제 체크섬, 머리말과 본문에 `TODO(` 표시 없음
- 채울 곳에는 `TODO(content)` 를 남긴다 (관리 화면이 만드는 새 작품도 한 줄 소개·본문에 넣어 둔다). 그러면 채우기 전에는 공개되지 않는다
- `sample-*` 파일은 뷰어 예시다. 실제 작품을 몇 개 등록한 뒤 지워도 된다 (출시는 검사가 막는다)

## 6. 출시 전 확인

```bash
grep -rn "TODO(" content web/src    # TODO(launch) 만 남을 때까지 채운다
```
