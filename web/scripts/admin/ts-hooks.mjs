/**
 * Node 로 web/src 의 TypeScript 를 빌드 없이 실행하기 위한 모듈 해석 훅 (작품 관리 CLI·서버용, ADR-0009).
 *
 *   node --import ./scripts/admin/ts-hooks.mjs scripts/admin/cli.ts …
 *
 * Node 26 은 .ts 파일의 타입을 지우고 바로 실행한다. 다만 import 에 확장자를 요구하는데, 이 저장소의 코드는
 * Next.js·tsc(moduleResolution: bundler) 관례대로 확장자 없이 쓴다 ("./schema"). 그래서 못 찾으면 .ts 를 붙여 다시 찾는다.
 * "@/…" 별칭(tsconfig paths)은 src/ 로 바꾼다. 새 의존성(tsx 등)을 들이지 않으려고 이렇게 한다.
 *
 * 타입 제거 실행은 enum·namespace·생성자 매개변수 속성(constructor(readonly x))을 지원하지 않는다. src/lib 에서 쓰지 않는다.
 */
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = pathToFileURL(path.resolve(import.meta.dirname, "../../src") + "/").href;
const RELATIVE = /^\.{1,2}\//;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
    try {
      return nextResolve(target, context);
    } catch (error) {
      const local = target.startsWith("file:") || RELATIVE.test(target);
      if (!local || /\.[cm]?[jt]sx?$/.test(target)) throw error;
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        try {
          return nextResolve(target + suffix, context);
        } catch {
          // 다음 후보
        }
      }
      throw error;
    }
  },
});
