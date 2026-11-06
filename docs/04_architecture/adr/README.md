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
