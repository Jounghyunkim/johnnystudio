/**
 * 화면 주소. 빌드(content.ts)·관리 서버(Node)·클라이언트가 함께 쓰므로 React·zod 를 가져오지 않는다.
 */

const enc = encodeURIComponent;

/** Store 앱 화면 (정적 내보내기라 앱마다 페이지가 없고, 이 페이지가 API 로 읽어 그린다, ADR-0012) */
export const appHref = (code: string) => `/store/app/?id=${enc(code)}`;

/** Showroom 서비스 화면 */
export const serviceHref = (code: string) => `/showroom/service/?id=${enc(code)}`;

/**
 * 작품을 누르면 갈 곳. Store·Showroom 으로 옮긴 작품(작품 파일의 storeApp·showroomService)은 그 화면이 설명 페이지다 (ADR-0015).
 * 코드가 없는 작품(영상·사진·글 등, 옮기지 않은 앱)만 Library 상세(`/library/<slug>/`)가 있다.
 */
export function assetHref(a: { slug: string; storeApp?: string; showroomService?: string }): string {
  if (a.storeApp) return appHref(a.storeApp);
  if (a.showroomService) return serviceHref(a.showroomService);
  return `/library/${a.slug}/`;
}
