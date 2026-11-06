# ADR-0004: 프론트엔드는 Next.js + TypeScript + Tailwind CSS, Phase 1 은 정적 내보내기

- **상태**: 채택됨. 단, "Phase 2 에서 서버 모드 + nonce CSP 로 바꾼다"는 계획은 [ADR-0007](0007-magic-link-auth-api.md) 이 대체했다 (정적 유지 + 해시 CSP)
- **날짜**: 2026-11-05
- **대체**: [ADR-0001](0001-static-html-stack.md)
- **관련**: [ideation.md](../../ideation.md) §5, [ADR-0005](0005-file-based-content.md), [ADR-0006](0006-cloudflare-tunnel.md)

## 맥락

- 기획안 v2 에서 포털이 네 구역(Showcase · Work with me · My Studio · Client Room)으로 커졌다.
  Phase 2 부터는 로그인·개인화가, Phase 3 에서는 의뢰인 대시보드가 들어간다. 정적 HTML 로는 감당할 수 없다 (ADR-0001 재검토 조건).
- 사용자의 기획안이 React/Next.js + Tailwind 를 지정했다.
- Phase 1 자체는 공개 콘텐츠뿐이라 서버가 필요 없다. 지금의 배포 방식(릴리스 + current, ADR-0002)을 그대로 쓰고 싶다.
- 서버(M8)에는 Node.js 가 없었고, 비대화형 sudo 를 쓸 수 없다.

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| 정적 HTML 유지 (ADR-0001) | 의존성 없음 | 개인화·대시보드·유형별 뷰어를 손으로 만들어야 하고, Phase 2 에서 다시 짜야 한다 |
| **Next.js (App Router)** | 기획안과 일치. 정적 내보내기 → 서버 모드로 같은 코드를 이어 간다. 컴포넌트로 유형별 뷰어를 나누기 좋다 | Node 도구 체인, 의존성 관리 |
| Astro | 정적 콘텐츠에 강함 | Phase 2~3 의 대시보드에서 결국 React 가 필요하다 |
| PHP + Tailwind (Arkurator 방식) | 익숙함 | 기획안과 다르고, 대시보드 상태 관리가 어렵다 |

## 결정

1. **Next.js 16 (App Router) + TypeScript(strict) + Tailwind CSS 4** 로 `web/` 에 만든다.
2. **Phase 1 은 정적 내보내기**(`output: "export"`, `trailingSlash: true`)다. `next build` 결과(`web/out`)를 nginx 가 그대로 내준다.
   API 라우트·미들웨어·ISR·이미지 최적화는 쓰지 않는다. Phase 2 에서 서버 모드로 바꿀 때 새 ADR 을 쓴다.
3. **렌더링 원칙**: 서버 컴포넌트가 기본이다. 상호작용이 필요한 곳(검색·필터, 즐겨찾기, 영상, 사진 확대, 복사, 메뉴 표시)만 클라이언트 컴포넌트로 만든다.
   콘텐츠는 빌드된 HTML 에 들어 있어야 한다 (검색엔진, JS 를 끈 환경).
4. **외부 의존 최소화**: 글꼴(Pretendard)은 npm 패키지로 자체 호스팅한다. 아이콘은 lucide-react 를 번들한다. CDN 은 쓰지 않는다.
   Next.js 사용 통계 전송은 끈다(`NEXT_TELEMETRY_DISABLED=1`, 추적 없음 원칙).
5. **도구 체인**
   - Node.js **v26 LTS** 를 `~/.local/opt` 에 설치하고 `~/.local/bin` 에 링크했다 (2026-11-05, nodejs.org 공식 배포본, SHA-256 확인, sudo 불필요).
   - 의존성은 **정확한 버전으로 고정**하고, 새로 고를 때는 **나온 지 2주 이상 된 버전 중 최신**을 쓴다 (공급망 위험 완화). `package-lock.json` 을 커밋하고 `npm ci` 로 설치한다.
   - **TypeScript 6.0** 을 쓴다. 7.0 은 Go 로 새로 작성된 버전이라, Next.js·typescript-eslint 가 쓰는 JS API 호환을 확인하지 못했다 `[확인 필요]`.
   - **ESLint 9** 를 쓴다. ESLint 10 은 eslint-config-next 16.4 안의 플러그인(import · jsx-a11y · react)이 아직 받아 주지 않는다 (peer `^9`).
     ESLint 9 는 지원 종료 경고가 뜨지만 개발 도구라서 감수한다.
   - `npm audit`: 운영 의존성 0건. 개발 의존성 중간 8건(typescript-eslint → minimatch 의 ReDoS)은 우리 소스 파일만 처리해서 감수한다.

## 결과

- **좋아지는 점**: 유형별 뷰어, 검색·필터, 즐겨찾기를 컴포넌트로 깔끔하게 나눴다. Phase 2 로 넘어갈 때 다시 짜지 않아도 된다.
  배포는 여전히 파일 복사다.
- **감수할 점**:
  - **CSP 에 `script-src 'unsafe-inline'` 이 필요하다.** 정적 내보내기는 페이지마다 인라인 `<script>`(RSC 데이터)를 넣고, 정적 파일에는 nonce 를 쓸 수 없다.
    Phase 1 은 로그인·사용자 입력이 없어 XSS 영향이 작다. 인라인 스타일은 없으므로 `style-src 'self'` 는 엄격하게 유지한다.
    **Phase 2 에서 로그인을 도입하기 전에 서버 모드 + nonce 기반 CSP 로 바꾼다.**
  - Node 도구 체인과 의존성을 관리해야 한다 (버전 고정, 정기 점검).

## 재검토 조건

- Phase 2 착수 (서버 모드, nonce CSP, Docker)
- Next.js·React 의 주요 보안 공지, 또는 ESLint 10 · TypeScript 7 지원이 생태계에 자리 잡았을 때
