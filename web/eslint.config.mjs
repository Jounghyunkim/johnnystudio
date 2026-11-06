import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
  {
    rules: {
      // 정적 내보내기라 next/image 최적화를 쓸 수 없다. 일반 <img> 를 쓴다. (ADR-0004)
      "@next/next/no-img-element": "off",
    },
  },
]);
