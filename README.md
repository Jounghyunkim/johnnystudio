# JohnnyStudio

> 만든 것을 한곳에, 바로 쓸 수 있게.
>
> 소프트웨어·영상·사진·글·하드웨어 작업을 한곳에 모아 보여 주고, 바로 써 보게 하고, 함께 일하는 셀프 호스팅 스튜디오의 포털(허브).

**현재 단계**: Phase 1 (공개 허브) 구현 완료, Phase 2 회원 가입(이메일 인증)·로그인(이메일 + 비밀번호) 구현 → 콘텐츠 채우기·공개 준비 ([로드맵](docs/ROADMAP.md))

## 빠른 시작

```bash
./scripts/dev.sh        # 개발 미리보기 (초안·샘플 포함) → http://localhost:3000  + 회원 API
./scripts/preview.sh    # 출시 빌드 미리보기 (초안 제외) → http://127.0.0.1:8080  + 회원 API
./scripts/check.sh      # 검사: 타입·린트·테스트·API 테스트·출시 빌드·빌드 결과(CSP 해시)
```

필요한 것: Node.js 24 이상 (서버에는 `~/.local/bin/node` v26 LTS), Python 3.13 이상, [uv](https://docs.astral.sh/uv/), Bash. 처음 한 번 `npm --prefix web ci`.

가입을 시험하려면 `/signup/` 에서 이메일을 넣는다. 개발 중에는 메일을 보내지 않고 **`dev.sh` 를 띄운 터미널에 링크가 찍힌다** (`api/.env.local` 에 SMTP 를 적으면 진짜로 보낸다). 링크를 열어 비밀번호를 정하면, 그다음부터는 `/login/` 에서 이메일 + 비밀번호로 로그인한다.

## 무엇이 있나

| 구역 | 주소 | 내용 |
|---|---|---|
| Showcase | `/library/`, `/library/<작품>/`, `/log/`, `/about/` | 작품 검색·필터, 유형별 뷰어(실행·다운로드·영상·사진·원문), Life Log 타임라인, 원칙·로드맵 |
| Work with me | `/work/` | 서비스, GitHub 방식의 진행 과정, Client Room 미리보기, 연락 |
| My Studio | `/studio/` | 로그인 없이 브라우저에 저장하는 즐겨찾기 |
| 회원 | `/signup/`, `/login/`, `/login/reset/`, `/account/`, `/privacy/` | 이메일 인증으로 가입, 이메일 + 비밀번호 로그인, 비밀번호 재설정·변경, 로그아웃·탈퇴, 개인정보처리방침 |
| Client Room | — | Phase 3 |

작품을 추가하려면 [콘텐츠 작성 가이드](docs/02_planning/CONTENT_GUIDE.md)를 본다. 파일 하나(`content/assets/<slug>.md`)를 추가하면 된다.

## 폴더 구조

```
JohnnyStudio/
├── AGENTS.md / CLAUDE.md   AI 도구 작업 규칙 (AGENTS.md 가 단일 원본)
├── web/                    Next.js 앱 (정적 내보내기 → web/out)
├── api/                    회원 API: FastAPI + SQLAlchemy (운영 PostgreSQL, 개발 SQLite)
├── content/                콘텐츠 원본: 작품(assets/*.md), Life Log, 프로필 문구, 문서 페이지(pages/*.md)
├── docs/                   기획(ideation), 비전, 사이트맵·콘텐츠 가이드, 디자인, 아키텍처·ADR
├── dev_history/            세션별 작업 로그
├── deploy/                 배포·롤백, nginx·cloudflared·systemd 설정, 배포 가이드
└── scripts/                미리보기·검사·파일 메타 도구
```

## 기술 스택과 배포

- Next.js 16 + TypeScript + Tailwind CSS 4, Phase 1 은 정적 내보내기: [ADR-0004](docs/04_architecture/adr/0004-nextjs-static-export.md)
- 콘텐츠는 저장소의 파일, zod 스키마로 검증: [ADR-0005](docs/04_architecture/adr/0005-file-based-content.md)
- 홈 서버 M8 의 nginx(127.0.0.1:8081) + Cloudflare Tunnel, 릴리스 폴더 + `current` 링크: [ADR-0006](docs/04_architecture/adr/0006-cloudflare-tunnel.md), [배포 가이드](deploy/README.md)
- 회원: FastAPI(`/api/`, 127.0.0.1:8082) + 페이지별 해시 CSP: [ADR-0007](docs/04_architecture/adr/0007-magic-link-auth-api.md), 가입은 이메일 인증·로그인은 이메일 + 비밀번호(scrypt): [ADR-0008](docs/04_architecture/adr/0008-password-login.md)

## AI 도구로 개발할 때

규칙은 [AGENTS.md](AGENTS.md) 에 있다. 요약하면 다음과 같다.

1. **시작할 때**: `docs/ROADMAP.md` 와 가장 최근 `dev_history/` 를 읽는다
2. **결정할 때**: `docs/04_architecture/adr/` 에 ADR 을 쓴다 (Claude Code: `/adr`)
3. **끝낼 때**: `dev_history/` 에 작업 로그를 쓰고 ROADMAP 을 갱신한다 (Claude Code: `/worklog`)
