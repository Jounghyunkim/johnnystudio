/**
 * 주소의 ?쿼리를 상태처럼 쓴다. 정적 내보내기에서 useSearchParams 를 쓰면 빌드된 HTML 에 목록 대신
 * Suspense 대체 화면이 들어가므로(검색엔진·JS 꺼진 환경에서 빈 화면), 브라우저에서 직접 읽는다.
 */
import { useCallback, useSyncExternalStore } from "react";

const EVENT = "johnnystudio:locationchange";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useLocationSearch(): [string, (search: string) => void] {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const setSearch = useCallback((next: string) => {
    const url = `${window.location.pathname}${next}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [search, setSearch];
}
