# ADR: 결정 기록

> 되돌리기 어렵거나, 나중에 "왜 이렇게 했지?"라고 물을 만한 결정을 남긴다.

- 새 ADR 은 가장 큰 번호에 1 을 더한 번호로 만든다. 형식은 [../../templates/ADR_TEMPLATE.md](../../templates/ADR_TEMPLATE.md) 를 따른다. (Claude Code: `/adr <제목>`)
- 결정을 바꿀 때는 기존 ADR 을 고치지 않는다. 새 ADR 을 쓰고, 옛 ADR 의 상태만 `대체됨 (→ ADR-NNNN)` 으로 바꾼다.

| 번호 | 제목 | 상태 |
|---|---|---|
| [0001](0001-static-html-stack.md) | 포털은 빌드 없는 정적 HTML/CSS/JS 로 시작한다 | 채택됨 |
| [0002](0002-deploy-home-server-nginx.md) | 홈 서버 M8 의 nginx 로 배포한다 (릴리스 폴더 + current 링크) | 채택됨 (도메인 미결정) |
| [0003](0003-ai-collaboration-docs.md) | AI 협업 문서 체계 (AGENTS.md · docs · dev_history · ADR) | 채택됨 |
