/**
 * 로그인 화면의 "아이디(이메일) 기억하기". 이메일만 이 브라우저(localStorage)에 둔다. 서버로 보내지 않는다.
 * 비밀번호는 저장하지 않는다 (그건 브라우저·비밀번호 관리 프로그램이 할 일이다).
 *
 * - 로그인에 성공했을 때만 저장하거나 지운다 (로그인 폼의 체크 상태대로)
 * - 회원 탈퇴하면 그 이메일을 지운다
 * localStorage 는 사생활 보호 모드나 차단 설정에서 실패할 수 있어서 모든 접근을 try/catch 로 감싼다 (bookmarks.ts 와 같다).
 */
import { useSyncExternalStore } from "react";

const KEY = "johnnystudio:remembered-email:v1";
const EVENT = "johnnystudio:remembered-email";

/** 저장된 값이 이메일처럼 생겼을 때만 쓴다 (손으로 고친 값·옛 형식은 무시) */
export function parseRememberedEmail(raw: string | null): string {
  if (!raw) return "";
  const value = raw.trim();
  // 서버의 이메일 검사(api/app/security.py)와 같은 글자 범위: ASCII, 로컬 파트 64자
  return value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value) ? value : "";
}

function read(): string {
  try {
    return parseRememberedEmail(window.localStorage.getItem(KEY));
  } catch {
    return "";
  }
}

function write(value: string | null): void {
  try {
    if (value) window.localStorage.setItem(KEY, value);
    else window.localStorage.removeItem(KEY);
  } catch {
    return; // 저장할 수 없는 환경: 기억하지 못할 뿐 로그인은 된다
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange); // 다른 탭에서 바뀐 경우
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** 기억한 이메일 (없으면 ""). 빌드된 HTML(서버 스냅숏)에는 늘 "" 이다 */
export function useRememberedEmail(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}

/** 로그인에 성공했을 때 부른다: remember 이면 저장, 아니면 지운다 */
export function updateRememberedEmail(email: string, remember: boolean): void {
  write(remember ? parseRememberedEmail(email) || null : null);
}

/** 이 이메일을 기억하고 있으면 지운다 (회원 탈퇴) */
export function forgetRememberedEmail(email: string): void {
  if (read().toLowerCase() === email.toLowerCase()) write(null);
}
