# ADR: 결정 기록

> 되돌리기 어렵거나, 나중에 "왜 이렇게 했지?"라고 물을 만한 결정을 남긴다.

- 새 ADR 은 가장 큰 번호에 1 을 더한 번호로 만든다. 형식은 [../../templates/ADR_TEMPLATE.md](../../templates/ADR_TEMPLATE.md) 를 따른다. (Claude Code: `/adr <제목>`)
- 결정을 바꿀 때는 기존 ADR 을 고치지 않는다. 새 ADR 을 쓰고, 옛 ADR 의 상태만 `대체됨 (→ ADR-NNNN)` 으로 바꾼다.

| 번호 | 제목 | 상태 |
|---|---|---|
| [0001](0001-static-html-stack.md) | 포털은 빌드 없는 정적 HTML/CSS/JS 로 시작한다 | 대체됨 → 0004 |
| [0002](0002-deploy-home-server-nginx.md) | 홈 서버 M8 의 nginx 로 배포한다 (릴리스 폴더 + current 링크) | 일부 대체됨 → 0006 (릴리스 + current 는 유효) |
| [0003](0003-ai-collaboration-docs.md) | AI 협업 문서 체계 (AGENTS.md · docs · dev_history · ADR) | 채택됨 |
| [0004](0004-nextjs-static-export.md) | 프론트엔드는 Next.js + TypeScript + Tailwind, Phase 1 은 정적 내보내기 | 채택됨 (Phase 2 서버 모드 계획은 0007 이 대체) |
| [0005](0005-file-based-content.md) | 공개 콘텐츠는 저장소의 파일(content/)로 두고 스키마로 검증한다 | 채택됨 |
| [0006](0006-cloudflare-tunnel.md) | 외부 공개는 Cloudflare Tunnel, nginx 사이트는 127.0.0.1:8081 전용 | 채택됨 (도메인 확정 후 적용) |
| [0007](0007-magic-link-auth-api.md) | 회원은 매직 링크 + FastAPI(/api/), 웹은 정적 유지, CSP 는 해시로 조인다 | 일부 대체됨 → 0008 ("비밀번호 없음") |
| [0008](0008-password-login.md) | 가입은 이메일 인증, 그다음부터는 이메일 + 비밀번호로 로그인한다 | 채택됨 |
| [0009](0009-local-portfolio-manager.md) | 작품 등록·관리는 개발 서버 전용 관리 화면과 로컬 관리 서버로 한다 | 일부 대체됨 → 0010 (PUBLIC_URL 에서도 켬) |
| [0010](0010-admin-on-public-dev-server.md) | 인터넷에 연 개발 서버(PUBLIC_URL)에서도 작품 관리 화면을 켠다 (실행마다 새 토큰, 운영 다운로드 폴더 안 씀) | 채택됨 |
| [0011](0011-absorb-johnnystore.md) | JohnnyStore 를 JohnnyStudio 로 흡수하고, 파일을 올리는 사람은 운영자뿐이다 | 일부 대체됨 → 0012 (결정 2·6, 결정 4 의 신고·관리자·이용약관) |
| [0012](0012-member-store.md) | 회원 Store·Showroom: 회원이 올린 Windows 앱과 웹 서비스를 운영자 승인 후 공개한다 | 제안됨 |
| [0013](0013-listing-kit.md) | Store·Showroom 소개 자료: Microsoft Store 와 같은 한도의 공통 항목, AI 키트, md·zip 은 브라우저에서 읽는다 (서버는 회원 주소를 캡처하지 않는다) | 제안됨 |
| [0014](0014-official-apps-in-store-db.md) | 운영자의 공식 앱·서비스도 Store·Showroom DB 에서 관리한다 (설치 파일·버전은 DB, Library 소개 글은 작품 파일, 운영자 계정 = 공식) | 제안됨 (0012 결정 8 일부 대체), 결정 2 의 Library 상세 → 0015 |
| [0015](0015-library-as-official-view.md) | Library 는 Store·Showroom 의 공식 앱·서비스를 모아 보는 곳이다 (누르면 Store·Showroom 화면, 옛 상세 주소는 넘겨 주기만, 브라우저에서 공식 목록에 맞춤) | 제안됨 |
| [0016](0016-android-app-type.md) | 작품 유형에 '안드로이드 앱'(Google Play·APK)을 더하고, '데스크톱 툴'을 '데스크톱 앱'으로 부른다 | 제안됨 |
| [0017](0017-member-bookmarks.md) | 회원의 즐겨찾기는 계정(DB)에 두고, 비회원은 브라우저에 둔다 (로그인하면 브라우저 목록을 계정에 옮긴다) | 제안됨 |
| [0018](0018-story-menu.md) | 상단 메뉴에 'Story ▾'(Library·Life Log·Blog·영상·사진·글·하드웨어)를 두고, 영상·사진·글·하드웨어는 Story 의 유형별 페이지에 모은다. Story 아래 페이지에 현재 위치·탭 (결정 5, 2026-11-28) | 제안됨 (0012 결정 13 의 구분선 앞을 바꾼다) |
