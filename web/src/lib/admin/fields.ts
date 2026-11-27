/**
 * 작품 관리 도구가 쓰는 필드 정보. zod 없이 값만 둔다 (관리 화면 = 클라이언트 컴포넌트에서도 쓴다).
 * 형식의 정답은 schema.ts 다. 둘이 어긋나면 fields.test.ts 가 실패한다.
 */
import type { AssetType } from "../asset-types";

/** 모든 유형에 공통인 머리말 키 */
export const BASE_FIELDS = [
  "title",
  "type",
  "summary",
  "status",
  "date",
  "updated",
  "tags",
  "cover",
  "coverAlt",
  "icon",
  "featured",
  "draft",
  "links",
] as const;

/** 유형마다 더 받는 키 (schema.ts 의 AssetFrontmatter 와 같아야 한다) */
export const TYPE_FIELDS: Record<AssetType, readonly string[]> = {
  "web-app": ["url", "showroomService"],
  "desktop-app": ["downloads", "requirements", "microsoftStore", "storeApp"],
  "android-app": ["downloads", "requirements", "googlePlay"],
  "web-package": ["playUrl", "download"],
  video: ["youtubeId"],
  gallery: ["photos"],
  article: ["url", "source"],
  hardware: ["photos", "youtubeId"],
};

/** 머리말 키를 쓰는 순서. 새 파일을 만들거나 없던 키를 넣을 때 이 순서에 맞춰 끼워 넣는다 */
export const FIELD_ORDER = [
  "title",
  "type",
  "summary",
  "status",
  "date",
  "updated",
  "tags",
  "url",
  "source",
  "playUrl",
  "youtubeId",
  "cover",
  "coverAlt",
  "icon",
  "featured",
  "draft",
  "requirements",
  "microsoftStore",
  "googlePlay",
  "storeApp",
  "showroomService",
  "links",
  "photos",
  "download",
  "downloads",
] as const;

/** schema.ts 의 SLUG_PATTERN 과 같다 (테스트가 확인한다) */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SUMMARY_MAX = 140;
/** 카드용 이미지 기준 (CONTENT_GUIDE §3) */
export const IMAGE_SOFT_LIMIT = 300 * 1024;

/** 새 작품을 만들 때 채울 곳에 넣는 표시. 완성도 검사(missingFields)가 이 표시를 막는다 */
export const TODO_SUMMARY = "TODO(content): 한 줄 소개를 채워 주세요.";

/** 유형을 바꿀 때 새 유형에 없는 키를 뺀다 */
export function stripForeignFields(data: Record<string, unknown>, type: AssetType): Record<string, unknown> {
  const allowed = new Set<string>([...BASE_FIELDS, ...TYPE_FIELDS[type]]);
  return Object.fromEntries(Object.entries(data).filter(([k]) => allowed.has(k)));
}

/** 이름에서 주소(slug) 후보를 만든다. 영문·숫자만 남는다 (한글 이름이면 빈 문자열: 직접 쓴다) */
export function suggestSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** YouTube 주소나 ID 에서 11자 ID 를 꺼낸다. 알 수 없으면 입력을 그대로 돌려준다 (스키마가 판단한다) */
export function youtubeIdFrom(input: string): string {
  const v = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  try {
    const url = new URL(v);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return url.pathname.slice(1, 12) || v;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const id = url.searchParams.get("v") ?? /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/.exec(url.pathname)?.[1];
      if (id) return id;
    }
  } catch {
    // 주소가 아니다
  }
  return v;
}

/** 오늘 날짜 YYYY-MM-DD (이 컴퓨터의 시간대) */
export function today(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** "" · 공백 · null · undefined 를 지운다. 문자열 양끝 공백도 지운다 */
export function cleanValue(value: unknown): unknown {
  if (typeof value === "string") {
    const v = value.trim();
    return v === "" ? undefined : v;
  }
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(cleanValue).filter((v) => v !== undefined);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const c = cleanValue(v);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return value;
}

/** 파일 이름으로 이름표·OS·버전을 짐작한다 (사람이 고친다) */
export function guessDownload(fileName: string): { label: string; version: string; os: string[] } {
  const lower = fileName.toLowerCase();
  const os = /\.(exe|msi|msix|appx)$/.test(lower)
    ? ["windows"]
    : /\.(dmg|pkg)$/.test(lower)
      ? ["macos"]
      : /\.(appimage|deb|rpm|flatpak|snap)$/.test(lower) || lower.endsWith(".tar.gz")
        ? ["linux"]
        : lower.endsWith(".apk")
          ? ["android"]
          : [];
  const label =
    os[0] === "windows"
      ? "Windows 설치 파일"
      : os[0] === "macos"
        ? "macOS 설치 파일"
        : os[0] === "linux"
          ? "Linux 패키지"
          : os[0] === "android"
            ? "Android APK"
            : "";
  const version = /(\d+\.\d+(?:\.\d+)?(?:[-.][0-9A-Za-z]+)?)/.exec(fileName.replace(/\.(tar\.gz|[A-Za-z0-9]+)$/, ""))?.[1] ?? "";
  return { label, version, os };
}

/** 완성도 검사(missingFields) 결과의 필드 이름을 화면용으로 풀어 쓴다 */
const MISSING_LABELS: Record<string, string> = {
  date: "날짜 (date: 시작했거나 공개한 날)",
  url: "주소 (url)",
  youtubeId: "YouTube 영상 ID (youtubeId)",
  "playUrl 또는 download": "체험 주소(playUrl) 또는 내려받기 파일(download)",
  "downloads (1개 이상)": "다운로드 파일 1개 이상 (downloads)",
  "googlePlay 또는 downloads": "Google Play 주소(googlePlay) 또는 APK 파일(downloads)",
  "photos (1장 이상)": "사진 1장 이상 (photos)",
  "photos 또는 youtubeId": "사진(photos) 또는 YouTube 영상(youtubeId)",
  "TODO( 표시가 남아 있다": "머리말에 TODO( 표시가 남아 있다 (한 줄 소개 등)",
};

export function describeMissing(item: string): string {
  const m = /^downloads\.(\d+)\.(size|sha256)$/.exec(item);
  if (m) return `다운로드 ${Number(m[1]) + 1}번의 ${m[2] === "size" ? "크기(size)" : "SHA-256 (자리표시 값은 안 된다)"}`;
  return MISSING_LABELS[item] ?? item;
}
