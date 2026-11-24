import { cx } from "./ui";

/**
 * Microsoft Store 아이콘 (그림: public/brand/microsoft-store.svg). Microsoft Store 링크 옆에만 쓴다.
 * 링크 글자("MS Store", "Microsoft Store에서 받기")와 함께 쓰는 꾸밈이라 alt 를 비운다. 서버·클라이언트 어디서나 쓴다.
 */
export function MsStoreIcon({ className }: { className?: string }) {
  return <img src="/brand/microsoft-store.svg" width={48} height={48} alt="" decoding="async" className={cx("size-4 shrink-0", className)} />;
}
