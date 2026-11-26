"use client";

/*
 * 설정 화면(/settings/)의 세 칸. 칸의 제목·차례는 빌드된 HTML(app/settings/page.tsx)에 있고, 내용은 브라우저에서 그린다
 * (로그인 상태·이 브라우저의 저장 값·운영자 현황은 빌드할 때 알 수 없다).
 *   UsersPanel     사용자 현황: 내 계정 요약, 운영자에게는 전체 현황(개수만, /api/site/admin/stats)
 *   AppPanel       앱 설정: 화면 테마, 로그인 이메일 기억, 운영자에게는 운영 설정(읽기 전용)
 *   GeneralPanel   일반 설정: 브라우저 캐시 지우기, 이 브라우저에 저장된 값 지우기
 */
import { ClipboardCheck, LoaderCircle, LogIn, Pencil, RefreshCw, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { loginHref, useSession } from "@/lib/auth";
import { useBookmarks, useIsClient } from "@/lib/bookmarks";
import { formatBytes } from "@/lib/format";
import { forgetRememberedEmail, useRememberedEmail } from "@/lib/remember-email";
import { SERVICE_STATUS_LABELS } from "@/lib/showroom";
import { type SiteStats, type StoredEntry, clearBrowserCache, removeStored, siteApi, useStoredEntries } from "@/lib/site";
import { APP_STATUS_LABELS, type Remote, type StoreMe, loadRemote, localDate, setRemote, storeApi, useRemote } from "@/lib/store";
import { useTheme } from "@/lib/theme";

import { ErrorBox, Loading, dialogClass, inputClass, panelClass } from "../store/store-ui";
import { ThemeChoice } from "../theme-toggle";
import { BarRows, type Range, RangePicker, SignupChart, StatusBar } from "./admin-charts";
import { ButtonLink, buttonClass, cx } from "../ui";

const MB = 1024 * 1024;
const STATS_KEY = "site:stats";
const subheading = "text-sm font-semibold text-fg";

/** 로그인 상태, 내 Store 정보(운영자인가), 운영자 현황. 불러오기는 UsersPanel 이 한 번만 한다 */
function useViewer() {
  const session = useSession();
  const signedIn = session.status === "signed-in";
  const me = useRemote<StoreMe>(signedIn ? "me" : null);
  const admin = me?.status === "ready" && me.data.admin;
  const stats = useRemote<SiteStats>(admin ? STATS_KEY : null);
  return { session, signedIn, me, admin, stats };
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm text-fg-subtle">{label}</dt>
          <dd className="min-w-0 break-words text-sm text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 통계 타일: 이름 · 값(쉼표 묶음) · 덧붙임 */
function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-canvas px-4 py-3">
      <dt className="text-xs font-medium text-fg-subtle">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg">{value.toLocaleString("ko-KR")}</dd>
      {note && <dd className="mt-0.5 text-xs text-fg-subtle">{note}</dd>}
    </div>
  );
}

// ── 사용자 현황 ──

/**
 * Store·Showroom 표시 이름 보기·바꾸기. 이미 정했으면 이름만 바꾸고(PATCH, 약관에 다시 동의하지 않는다),
 * 처음이면 이용약관 동의·만 14세 확인과 함께 정한다 (POST, 앱 올리기 화면의 PublisherForm 과 같은 API)
 */
function DisplayName({ me }: { me: Remote<StoreMe> | undefined }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const ids = { name: useId(), hint: useId(), terms: useId(), age: useId() };

  if (!me || me.status === "loading") return <>…</>;
  if (me.status === "error") return <span className="text-fg-muted">불러오지 못했습니다</span>;
  const data = me.data;
  const p = data.publisher;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("display_name") ?? "");
    setBusy(true);
    setError(null);
    const r = p
      ? await storeApi.renamePublisher(name)
      : await storeApi.setPublisher({ display_name: name, agree_terms: f.get("agree_terms") === "on", age_14: f.get("age_14") === "on" });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setRemote<StoreMe>("me", { ...data, publisher: r.data.publisher });
    setEditing(false);
    setSaved(true);
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          {p ? p.display_name : <span className="text-fg-muted">정하지 않음</span>}
          {p?.blocked && <span className="text-fg-muted"> (이용 제한 중이라 바꿀 수 없습니다)</span>}
        </span>
        {!p?.blocked && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSaved(false);
              setError(null);
            }}
            className={buttonClass("ghost", "sm")}
          >
            <Pencil aria-hidden="true" className="size-4" />
            {p ? "바꾸기" : "정하기"}
            <span className="sr-only">: 표시 이름</span>
          </button>
        )}
        {saved && (
          <span role="status" className="basis-full text-xs text-fg-subtle">
            표시 이름을 저장했습니다. 앱·서비스 화면에 바로 보입니다.
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor={ids.name} className="sr-only">
        표시 이름
      </label>
      <input
        id={ids.name}
        name="display_name"
        required
        minLength={2}
        maxLength={30}
        defaultValue={p?.display_name ?? ""}
        aria-describedby={ids.hint}
        className={cx(inputClass, "h-10 w-full max-w-xs")}
      />
      <p id={ids.hint} className="text-xs leading-relaxed text-fg-subtle">
        2~30자. 앱·서비스 화면에 &lsquo;올린 사람&rsquo;·&lsquo;소개한 사람&rsquo;으로 바로 보입니다. 운영자로 오해할 수 있는 이름은 쓸 수 없습니다.
      </p>
      {!p && (
        <div className="space-y-2 text-sm text-fg">
          <label htmlFor={ids.terms} className="flex items-start gap-3">
            <input id={ids.terms} name="agree_terms" type="checkbox" required className="mt-1 size-4 accent-accent" />
            <span>
              <Link href="/store/terms/" target="_blank" className="underline underline-offset-4">
                Store·Showroom 이용약관
              </Link>
              에 동의합니다.
            </span>
          </label>
          <label htmlFor={ids.age} className="flex items-start gap-3">
            <input id={ids.age} name="age_14" type="checkbox" required className="mt-1 size-4 accent-accent" />
            <span>만 14세 이상입니다.</span>
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={cx(buttonClass("primary", "sm"), "disabled:opacity-60")}>
          {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
          {p ? "저장" : "동의하고 저장"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
          취소
        </button>
      </div>
    </form>
  );
}

function AdminStats() {
  const { stats } = useViewer();
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    setBusy(true);
    await loadRemote(STATS_KEY, siteApi.stats);
    setBusy(false);
  };
  return (
    <div className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-fg">
          전체 현황 <span className="text-sm font-normal text-fg-subtle">(운영자에게만 보입니다)</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={reload} disabled={busy} className={cx(buttonClass("ghost", "sm"), "disabled:opacity-60")}>
            <RefreshCw aria-hidden="true" className={cx("size-4", busy && "animate-spin")} />
            새로 읽기
          </button>
          <ButtonLink href="/store/manage/" variant="ghost" size="sm">
            <ClipboardCheck aria-hidden="true" className="size-4" />
            검토 화면
          </ButtonLink>
        </div>
      </div>
      {!stats || stats.status === "loading" ? (
        <div className="mt-4">
          <Loading />
        </div>
      ) : stats.status === "error" ? (
        <div className="mt-4">
          <ErrorBox error={stats.error} title="현황을 불러오지 못했습니다" />
        </div>
      ) : (
        <AdminStatsBody s={stats.data} />
      )}
    </div>
  );
}

const RECENCY_LABELS = { today: "오늘", week: "1~6일 전", month: "7~29일 전", older: "30일 이상 전" } as const;
const STATUS_TONES = { published: "good", pending: "warn", rejected: "bad", hidden: "neutral" } as const;

/** 상태별 개수 → 상태 막대 칸 (공개 · 검토 대기 · 반려 · 숨김 순서, 색은 상태 색) */
function statusParts(counts: Record<string, number>, labels: Record<string, string>) {
  return (Object.keys(STATUS_TONES) as (keyof typeof STATUS_TONES)[]).map((key) => ({ key, label: labels[key] ?? key, value: counts[key] ?? 0, tone: STATUS_TONES[key] }));
}

const chartCard = "rounded-xl border border-line bg-canvas p-4 sm:p-5";

function AdminStatsBody({ s }: { s: SiteStats }) {
  const u = s.users;
  const t = s.trends;
  const [range, setRange] = useState<Range>(30);
  return (
    <div className="mt-5 space-y-8">
      <div className="space-y-4">
        <h4 className={subheading}>회원</h4>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="전체 회원" value={u.total} />
          <Stat label="최근 7일 가입" value={u.new_7d} />
          <Stat label="최근 30일 가입" value={u.new_30d} />
          <Stat label="최근 24시간에 들른 회원" value={u.active_24h} note="로그인한 채 들른 회원" />
        </dl>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="로그인이 유지된 회원" value={u.signed_in} note="기기가 여럿이면 한 번만 셉니다" />
          <Stat label="최근 7일 로그인" value={u.login_7d} />
          <Stat label="비밀번호를 정한 회원" value={u.with_password} note="나머지는 메일 링크로만 로그인" />
        </dl>
        {/* 기간은 아래 가입 추이에 걸린다 (나머지 차트는 '지금 기준') */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RangePicker value={range} onChange={setRange} />
          <span className="text-xs text-fg-subtle">날짜는 한국 시간 기준</span>
        </div>
        <div className={chartCard}>
          <SignupChart trends={t} range={range} />
        </div>
        <div className={chartCard}>
          <BarRows
            title="마지막 로그인"
            note="지금 기준 · 회원마다 가장 최근 로그인"
            unit="명"
            rows={t.login_recency.map((r) => ({ key: r.key, label: RECENCY_LABELS[r.key], value: r.count }))}
          />
        </div>
      </div>
      <div className="space-y-4">
        <h4 className={subheading}>Store (회원 Windows 앱)</h4>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="올리는 회원" value={s.store.publishers} note={`이용 제한 ${s.store.blocked.toLocaleString("ko-KR")}명`} />
          <Stat label="검토 대기 버전" value={s.store.releases_pending} />
          <Stat label="처리할 신고" value={s.store.reports_open} />
        </dl>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={chartCard}>
            <StatusBar title="앱 상태 (지금 기준)" parts={statusParts(s.store.apps, APP_STATUS_LABELS)} />
          </div>
          <div className={chartCard}>
            <BarRows title="내려받기가 많은 앱" note="공개된 앱 · 지금까지" unit="번" rows={t.top_downloads.map((a) => ({ key: a.code, label: a.name, value: a.count }))} />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <h4 className={subheading}>Showroom (회원 웹 서비스)</h4>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="처리할 신고" value={s.showroom.reports_open} />
        </dl>
        <div className={chartCard}>
          <StatusBar title="서비스 상태 (지금 기준)" parts={statusParts(s.showroom.services, SERVICE_STATUS_LABELS)} />
        </div>
      </div>
      <p className="text-xs text-fg-subtle">개수만 보여 줍니다 (회원 이메일은 보이지 않습니다). {localDate(s.generated_at, true)} 기준.</p>
    </div>
  );
}

export function UsersPanel() {
  const isClient = useIsClient();
  const { session, signedIn, me, admin } = useViewer();
  const { slugs } = useBookmarks();

  useEffect(() => {
    if (signedIn) void loadRemote("me", storeApi.me);
  }, [signedIn]);
  useEffect(() => {
    if (admin) void loadRemote(STATS_KEY, siteApi.stats);
  }, [admin]);

  if (!isClient || session.status === "loading") return <Loading>로그인 상태를 확인하는 중입니다…</Loading>;
  if (session.status === "unavailable") {
    return <ErrorBox error={{ ok: false, status: 0, code: "unavailable", message: "회원 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요." }} />;
  }
  if (session.status === "signed-out") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">로그인하지 않았습니다</p>
        <p className="mt-2 text-sm text-fg-muted">로그인하면 내 계정 현황을 봅니다. 이 브라우저의 즐겨찾기는 {slugs.length}개입니다.</p>
        <div className="mt-4">
          <ButtonLink href={loginHref("/settings/")} size="sm">
            <LogIn aria-hidden="true" className="size-4" />
            로그인
          </ButtonLink>
        </div>
      </div>
    );
  }

  const user = session.user;
  return (
    <div className="space-y-5">
      <div className={panelClass}>
        <h3 className="flex items-center gap-2 text-base font-semibold text-fg">
          <UserRound aria-hidden="true" className="size-4 text-fg-subtle" />내 계정
        </h3>
        <div className="mt-4">
          <Rows
            rows={[
              ["이메일", user.email],
              ["가입한 날", localDate(user.created_at)],
              ["마지막 로그인", localDate(user.last_login_at, true)],
              ["로그인 방법", user.has_password ? "이메일 + 비밀번호, 메일 링크" : "메일 링크 (비밀번호를 정하지 않았습니다)"],
              ["Store·Showroom 표시 이름", <DisplayName key="name" me={me} />],
              ["권한", me?.status === "ready" ? (admin ? "운영자" : "회원") : "…"],
              ["즐겨찾기 (이 브라우저)", `${slugs.length}개`],
            ]}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href="/account/" variant="secondary" size="sm">
            계정 관리
          </ButtonLink>
          <ButtonLink href="/studio/" variant="ghost" size="sm">
            My Studio
          </ButtonLink>
          <ButtonLink href="/store/mine/" variant="ghost" size="sm">
            내 앱
          </ButtonLink>
          <ButtonLink href="/showroom/mine/" variant="ghost" size="sm">
            내 서비스
          </ButtonLink>
        </div>
      </div>
      {me?.status === "error" && <ErrorBox error={me.error} title="Store 정보를 불러오지 못했습니다" />}
      {admin && <AdminStats />}
    </div>
  );
}

// ── 앱 설정 ──

function ServerSettings({ s }: { s: SiteStats["server"] }) {
  return (
    <div className={panelClass}>
      <h3 className="text-base font-semibold text-fg">
        운영 설정 <span className="text-sm font-normal text-fg-subtle">(운영자에게만 보입니다, 읽기 전용)</span>
      </h3>
      <div className="mt-4">
        <Rows
          rows={[
            ["실행 환경", s.env === "production" ? "운영 (production)" : `개발 (${s.env})`],
            ["사이트 주소", <span key="url" className="font-mono">{s.site_url}</span>],
            ["회원 DB", s.database],
            ["로그인 메일", s.mail_backend === "smtp" ? "SMTP 로 보냅니다" : "보내지 않고 API 터미널에 찍습니다 (개발용)"],
            ["로그인 유지", `${s.session_days}일`],
            ["운영자", `${s.admins}명`],
            ["새 앱·서비스 받기", s.uploads_open ? "받는 중" : "멈춤 (이미 공개된 것은 그대로)"],
            ["바이러스 검사", `${s.scanner ? "ClamAV 있음" : "ClamAV 없음 (검사하지 않음)"} · ${s.scan_required ? "탐지 없음이어야 승인" : "검사 없이도 승인할 수 있음"}`],
            ["올리기 한도", `파일 하나 ${formatBytes(s.file_max_mb * MB)} · 회원당 합계 ${formatBytes(s.user_quota_mb * MB)} · 24시간에 ${s.daily_uploads}번`],
            ["이용약관 판", <span key="terms" className="font-mono">{s.terms_version}</span>],
          ]}
        />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
        이 값은 서버의 환경 변수에서 정합니다 (운영 <code className="font-mono">/opt/johnnystudio/api.env</code>, 개발 <code className="font-mono">api/.env.local</code>). 바꾸려면 그 파일을 고치고 API 를 다시 시작합니다.
      </p>
    </div>
  );
}

export function AppPanel() {
  const isClient = useIsClient();
  const { theme } = useTheme();
  const remembered = useRememberedEmail();
  const { admin, stats } = useViewer();
  if (!isClient) return <Loading />;
  return (
    <div className="space-y-5">
      <div className={panelClass}>
        <Rows
          rows={[
            [
              "화면 테마",
              <div key="theme" className="space-y-2">
                <ThemeChoice />
                <p className="text-xs text-fg-subtle">지금 {theme === "dark" ? "어두운" : "밝은"} 테마입니다. 고른 값은 이 브라우저에만 저장합니다.</p>
              </div>,
            ],
            [
              "로그인 이메일 기억",
              remembered ? (
                <div key="email" className="flex flex-wrap items-center gap-3">
                  <span className="break-all">{remembered}</span>
                  <button type="button" onClick={() => forgetRememberedEmail(remembered)} className={buttonClass("ghost", "sm")}>
                    잊기
                  </button>
                </div>
              ) : (
                <span key="email" className="text-fg-muted">
                  기억한 이메일이 없습니다. 로그인 화면에서 &lsquo;아이디(이메일) 기억하기&rsquo;를 고르면 이 브라우저에 저장합니다.
                </span>
              ),
            ],
          ]}
        />
      </div>
      {admin && stats?.status === "ready" && <ServerSettings s={stats.data.server} />}
    </div>
  );
}

// ── 일반 설정 ──

function CacheBox() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secure = window.isSecureContext;

  async function run() {
    setBusy(true);
    setError(null);
    const r = await clearBrowserCache();
    if (!r.ok) {
      setBusy(false);
      return setError(r.message);
    }
    window.location.reload();
  }

  return (
    <div className={panelClass}>
      <h3 className="text-base font-semibold text-fg">캐시 지우기</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        이 브라우저에 남은 JohnnyStudio의 그림·스크립트 사본을 지우고 화면을 새로 불러옵니다. 로그인·즐겨찾기·테마는 그대로입니다.
      </p>
      {!secure && (
        <p className="mt-2 text-xs text-fg-subtle">
          지금 주소는 HTTPS 가 아니라서 브라우저가 캐시 지우기를 따르지 않을 수 있습니다. 그때는 Ctrl+Shift+R(맥은 ⌘+Shift+R)로 강력 새로 고침하세요.
        </p>
      )}
      <div className="mt-4">
        <button type="button" onClick={run} disabled={busy} className={cx(buttonClass("secondary", "sm"), "disabled:opacity-60")}>
          {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="size-4" />}
          캐시 지우고 새로 고침
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error} 강력 새로 고침(Ctrl+Shift+R)으로 대신할 수 있습니다.
        </p>
      )}
    </div>
  );
}

const THEME_NAMES: Record<string, string> = { dark: "어둡게", light: "밝게", system: "시스템 설정 따르기" };

function useEntryText() {
  const { slugs } = useBookmarks();
  const remembered = useRememberedEmail();
  const { pref } = useTheme();
  return (e: StoredEntry): { title: string; detail: ReactNode } => {
    if (e.kind === "bookmarks") return { title: "즐겨찾기 (My Studio)", detail: `${slugs.length}개. 지우면 되돌릴 수 없습니다.` };
    if (e.kind === "remembered-email") return { title: "기억한 로그인 이메일", detail: remembered || "(형식이 맞지 않는 값)" };
    if (e.kind === "theme") return { title: "화면 테마 선택", detail: `${THEME_NAMES[pref] ?? pref}. 지우면 기본값(어둡게)으로 돌아갑니다.` };
    return { title: "그 밖의 값", detail: <span className="font-mono">{`${e.key} · ${formatBytes(e.bytes)}`}</span> };
  };
}

function ConfirmRemove({ titles, onConfirm, onClose }: { titles: string[]; onConfirm: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="stored-remove-title" className={dialogClass}>
      <h2 id="stored-remove-title" className="text-lg font-semibold">
        이 브라우저에서 지울까요?
      </h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-fg">
        {titles.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">바로 지워지고 되돌릴 수 없습니다. 다른 브라우저·기기에 저장된 값은 그대로입니다.</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" autoFocus onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
          취소
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            ref.current?.close();
          }}
          className={cx(buttonClass("primary"), "bg-danger text-danger-ink hover:bg-danger/90")}
        >
          지우기
        </button>
      </div>
    </dialog>
  );
}

function StoredBox() {
  const entries = useStoredEntries();
  const text = useEntryText();
  const [picked, setPicked] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // 다른 탭에서 지워진 키는 고른 목록에서 뺀다 (상태를 따로 고치지 않고 그릴 때 거른다)
  const chosen = picked.filter((k) => entries.some((e) => e.key === k));
  const all = entries.length > 0 && chosen.length === entries.length;
  const toggle = (key: string) => {
    setDone(null);
    setPicked(chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key]);
  };

  return (
    <div className={panelClass}>
      <h3 className="text-base font-semibold text-fg">이 브라우저에 저장된 값</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">JohnnyStudio는 아래 값만 이 브라우저(localStorage)에 둡니다. 서버로 보내지 않습니다.</p>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-fg-subtle">저장된 값이 없습니다.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {entries.map((e) => {
            const t = text(e);
            return (
              <li key={e.key}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-raised">
                  <input type="checkbox" checked={chosen.includes(e.key)} onChange={() => toggle(e.key)} className="mt-0.5 size-4 shrink-0 accent-accent" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{t.title}</span>
                    <span className="mt-0.5 block break-all text-xs text-fg-subtle">{t.detail}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {entries.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setPicked(all ? [] : entries.map((e) => e.key));
            }}
            className={buttonClass("ghost", "sm")}
          >
            {all ? "모두 풀기" : "모두 고르기"}
          </button>
          <button type="button" disabled={chosen.length === 0} onClick={() => setAsking(true)} className={cx(buttonClass("danger", "sm"), "disabled:opacity-50")}>
            <Trash2 aria-hidden="true" className="size-4" />
            고른 값 지우기{chosen.length > 0 && ` (${chosen.length})`}
          </button>
        </div>
      )}
      {done && (
        <p role="status" className="mt-3 text-sm text-fg-muted">
          {done}
        </p>
      )}
      <p className="mt-4 text-xs text-fg-subtle">로그인 상태(쿠키)는 여기서 지우지 않습니다. 로그아웃은 계정 화면에서 합니다.</p>
      {asking && (
        <ConfirmRemove
          titles={entries.filter((e) => chosen.includes(e.key)).map((e) => text(e).title + (e.kind === "other" ? ` (${e.key})` : ""))}
          onConfirm={() => {
            const n = removeStored(chosen);
            setPicked([]);
            setDone(`${n}개를 지웠습니다.`);
          }}
          onClose={() => setAsking(false)}
        />
      )}
    </div>
  );
}

export function GeneralPanel() {
  const isClient = useIsClient();
  if (!isClient) return <Loading />;
  return (
    <div className="space-y-5">
      <CacheBox />
      <StoredBox />
    </div>
  );
}
