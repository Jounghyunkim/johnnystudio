import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// 정적 내보내기. `next build` 결과가 out/ 에 HTML·CSS·JS 파일로 나오고, nginx 가 그대로 내준다.
// 서버가 필요한 기능(API 라우트, 미들웨어, ISR, 이미지 최적화)은 쓸 수 없다. (ADR-0004)
// 회원 기능은 따로 도는 FastAPI(api/)가 /api/ 에서 맡는다. 운영에서는 nginx 가 /api/ 를 넘겨준다. (ADR-0007)
const base: NextConfig = {
  output: "export",
  trailingSlash: true, // /library/arkurator/ → out/library/arkurator/index.html (nginx try_files 와 맞춘다)
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default function config(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return base;

  // 개발 서버에서만: /api/ 를 로컬 API(scripts/dev.sh 가 띄운다)로 넘긴다. 운영과 같은 출처라서 쿠키·CSRF 검사가 똑같이 동작한다.
  const api = process.env.JOHNNYSTUDIO_API_ORIGIN ?? "http://127.0.0.1:3001";
  // 개발 서버는 localhost 가 아닌 주소(127.0.0.1, 192.168.x.x, 외부 주소)로 열면 HMR 연결을 막는다.
  // 그러면 화면이 하이드레이션되지 않아 버튼이 동작하지 않고, 로그인 폼은 API 를 부르지 못한 채 새로고침만 된다.
  // dev.sh 가 이 PC 의 주소들(과 PUBLIC_URL)을 쉼표로 넘긴다. 호스트 이름만 쓴다 (포트·http 없이).
  const devHosts = (process.env.JOHNNYSTUDIO_DEV_HOSTS ?? "127.0.0.1")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return {
    ...base,
    allowedDevOrigins: devHosts,
    // trailingSlash 때문에 /api/auth/me → /api/auth/me/ 로 308 리다이렉트되면, FastAPI 가 다시 / 를 떼며 되돌려 보내 무한 반복된다.
    // 개발 서버에서만 끈다 (페이지 링크는 모두 / 로 끝나고, 운영에서는 nginx 가 리다이렉트를 맡는다).
    skipTrailingSlashRedirect: true,
    async rewrites() {
      return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
    },
  };
}
