"use client";

import { Check, Download, EyeOff, LoaderCircle, RotateCw, X } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { type ApiResult, loginHref, useSession } from "@/lib/auth";
import { useIsClient } from "@/lib/bookmarks";
import { formatBytes } from "@/lib/format";
import {
  APP_STATUS_LABELS,
  ARCH_LABELS,
  type AdminOverview,
  type StoreApp,
  appHref,
  loadRemote,
  localDate,
  storeApi,
  useRemote,
} from "@/lib/store";

import { SERVICE_STATUS_LABELS, type ShowroomOverview, type ShowroomService, serviceHref, showroomApi } from "@/lib/showroom";

import { OpenLink, ServiceIcon } from "../showroom/showroom-ui";
import { ButtonLink, buttonClass, cx } from "../ui";
import { AppIcon, ErrorBox, Loading, Pill, PlainText, ScanBadge, dialogClass, inputClass, panelClass, statusTone } from "./store-ui";

type Ask = { title: string; label: string; action: (reason: string) => Promise<ApiResult<unknown>> } | null;

// 승인·숨김 뒤에는 Store·Showroom 을 함께 새로 읽는다 (회원 차단은 둘 다에 걸린다)
const reload = () =>
  Promise.all([loadRemote("admin", storeApi.admin.overview), loadRemote("showroom:admin", showroomApi.admin.overview)]).then(() => undefined);

function ReasonDialog({ ask, onClose }: { ask: NonNullable<Ask>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await ask.action(String(new FormData(e.currentTarget).get("reason") ?? ""));
    setBusy(false);
    if (!r.ok) return setError(r.message);
    await reload();
    ref.current?.close();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="ask-title" className={dialogClass}>
      <h2 id="ask-title" className="text-lg font-semibold">
        {ask.title}
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor={id} className="block text-sm font-semibold">
            {ask.label}
          </label>
          <input id={id} name="reason" required maxLength={300} className={cx(inputClass, "mt-2 h-11")} />
          <p className="mt-1 text-xs text-fg-subtle">올린 사람에게 그대로 보입니다.</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
            취소
          </button>
          <button type="submit" disabled={busy} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
            {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            확인
          </button>
        </div>
      </form>
    </dialog>
  );
}

function useAction(): [string | null, string | null, (key: string, run: () => Promise<ApiResult<unknown>>) => Promise<void>] {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = async (key: string, run: () => Promise<ApiResult<unknown>>) => {
    setBusy(key);
    setError(null);
    const r = await run();
    if (!r.ok) setError(r.message);
    await reload();
    setBusy(null);
  };
  return [busy, error, act];
}

function PendingApp({ app, setAsk }: { app: StoreApp; setAsk: (a: Ask) => void }) {
  const [busy, error, act] = useAction();
  const pending = app.releases.filter((r) => r.status === "pending");
  const owner = app.owner;
  return (
    <article className={panelClass}>
      <div className="flex flex-wrap items-start gap-4">
        <AppIcon code={app.code} hasIcon={app.has_icon} name={app.name} className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-fg">
            <Link href={appHref(app.code)} className="hover:underline">
              {app.name}
            </Link>
            {app.status && <Pill tone={statusTone(app.status)}>{APP_STATUS_LABELS[app.status]}</Pill>}
          </h3>
          <p className="mt-1 break-all text-sm text-fg-subtle">
            {app.publisher} ({app.owner?.email}) · {app.category_label} · {localDate(app.created_at, true)}
          </p>
          {app.summary && <p className="mt-2 text-sm text-fg-muted">{app.summary}</p>}
          {app.description && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-fg-muted hover:text-fg">설명 보기</summary>
              <PlainText text={app.description} className="mt-2 rounded-xl bg-canvas p-3 text-fg-muted" />
            </details>
          )}
        </div>
      </div>

      <ul className="mt-5 space-y-4 border-t border-line pt-5">
        {pending.map((r) => (
          <li key={r.id} className="space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
              <span className="font-mono font-semibold">{r.version}</span>
              <ScanBadge scan={r.scan} />
            </p>
            {r.scan.detail && <p className="text-xs text-fg-subtle">{r.scan.detail}</p>}
            <p className="break-all text-xs text-fg-subtle">
              {r.file_name} · {formatBytes(r.size)} · {r.file_type.toUpperCase()} · {ARCH_LABELS[r.arch] ?? r.arch} · {r.signed ? "서명 블록 있음" : "서명 없음"}
              {r.company_name && ` · 개발사 ${r.company_name}`}
              {r.inner_path && ` · 압축 안 ${r.inner_path}`}
            </p>
            <p className="break-all font-mono text-xs text-fg-subtle">SHA-256 {r.sha256}</p>
            {r.notes && <PlainText text={r.notes} className="text-xs text-fg-muted" />}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" disabled={busy !== null} onClick={() => act(`ok${r.id}`, () => storeApi.admin.approve(r.id))} className={cx(buttonClass("primary", "sm"), "disabled:opacity-60")}>
                {busy === `ok${r.id}` ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
                승인하고 공개
              </button>
              <button
                type="button"
                onClick={() => setAsk({ title: `${app.name} ${r.version} 반려`, label: "반려 사유", action: (reason) => storeApi.admin.reject(r.id, reason) })}
                className={buttonClass("secondary", "sm")}
              >
                <X aria-hidden="true" className="size-4" />
                반려
              </button>
              <button type="button" disabled={busy !== null} onClick={() => act(`scan${r.id}`, () => storeApi.admin.rescan(r.id))} className={cx(buttonClass("ghost", "sm"), "disabled:opacity-60")}>
                <RotateCw aria-hidden="true" className={cx("size-4", busy === `scan${r.id}` && "animate-spin")} />
                다시 검사
              </button>
              <a href={r.download_url} download className={buttonClass("ghost", "sm")}>
                <Download aria-hidden="true" className="size-4" />
                내려받기
              </a>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {owner && !owner.blocked && (
        <button
          type="button"
          onClick={() => setAsk({ title: `${app.publisher} 회원 차단`, label: "차단 사유", action: (reason) => storeApi.admin.block(owner.id, reason) })}
          className="mt-4 text-xs text-fg-subtle underline underline-offset-4 hover:text-danger"
        >
          이 회원 차단하기 (올린 앱이 모두 목록에서 빠지고 새로 올릴 수 없습니다)
        </button>
      )}
    </article>
  );
}

function AppLine({ app, children }: { app: StoreApp; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
          <Link href={appHref(app.code)} className="hover:underline">
            {app.name}
          </Link>
          {app.status && <Pill tone={statusTone(app.status)}>{APP_STATUS_LABELS[app.status]}</Pill>}
        </p>
        <p className="mt-0.5 break-all text-xs text-fg-subtle">
          {app.publisher} ({app.owner?.email}) · 내려받기 {app.download_count ?? 0}번{app.status_reason && ` · 사유: ${app.status_reason}`}
        </p>
      </div>
      <div className="flex gap-2">{children}</div>
    </li>
  );
}

function Overview({ data, setAsk }: { data: AdminOverview; setAsk: (a: Ask) => void }) {
  const [busy, error, act] = useAction();
  const section = "space-y-4";
  const heading = "text-xl font-bold tracking-tight text-fg";
  return (
    <div className="space-y-12">
      <p className="text-sm font-semibold text-accent">Store (회원 Windows 앱)</p>
      {!data.scanner && (
        <p role="status" className={cx(panelClass, "text-sm text-amber-300 light:text-amber-800")}>
          서버에 ClamAV(clamscan)가 없어 바이러스 검사를 하지 않습니다.
          {data.scan_required ? " 검사 결과가 '탐지 없음'이어야 승인할 수 있으므로 지금은 승인할 수 없습니다." : " 검사 없이도 승인할 수 있는 설정입니다 (개발용)."}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <section aria-labelledby="pending-title" className={section}>
        <h2 id="pending-title" className={heading}>
          검토 대기 <span className="text-fg-subtle">{data.pending.length}</span>
        </h2>
        {data.pending.length === 0 ? <p className="text-sm text-fg-muted">검토할 앱이 없습니다.</p> : data.pending.map((a) => <PendingApp key={a.code} app={a} setAsk={setAsk} />)}
      </section>

      <section aria-labelledby="reports-title" className={section}>
        <h2 id="reports-title" className={heading}>
          신고 <span className="text-fg-subtle">{data.reports.length}</span>
        </h2>
        {data.reports.length === 0 ? (
          <p className="text-sm text-fg-muted">처리할 신고가 없습니다.</p>
        ) : (
          <ul className="space-y-4">
            {data.reports.map((r) => (
              <li key={r.id} className={panelClass}>
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                  {r.app_exists ? (
                    <Link href={appHref(r.app_code)} className="hover:underline">
                      {r.app_name}
                    </Link>
                  ) : (
                    <span>{r.app_name} (지워진 앱)</span>
                  )}
                  <Pill tone="warn">{r.reason_label}</Pill>
                </p>
                <PlainText text={r.detail} className="mt-2 text-sm text-fg-muted" />
                <p className="mt-2 break-all text-xs text-fg-subtle">
                  {localDate(r.created_at, true)} · {r.signed_in ? "회원" : "비회원"}
                  {r.contact && ` · 연락처 ${r.contact}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.app_exists && (
                    <button
                      type="button"
                      onClick={() => setAsk({ title: `${r.app_name} 숨기기`, label: "숨기는 사유", action: (reason) => storeApi.admin.hide(r.app_code, reason) })}
                      className={buttonClass("secondary", "sm")}
                    >
                      <EyeOff aria-hidden="true" className="size-4" />앱 숨기기
                    </button>
                  )}
                  <button type="button" disabled={busy !== null} onClick={() => act(`a${r.id}`, () => storeApi.admin.resolve(r.id, "actioned", ""))} className={cx(buttonClass("ghost", "sm"), "disabled:opacity-60")}>
                    조치함
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => act(`d${r.id}`, () => storeApi.admin.resolve(r.id, "dismissed", ""))} className={cx(buttonClass("ghost", "sm"), "disabled:opacity-60")}>
                    기각
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-title" className={section}>
        <h2 id="recent-title" className={heading}>
          최근 공개한 앱
        </h2>
        <ul className="divide-y divide-line rounded-card border border-line px-5">
          {data.recent.length === 0 && <li className="py-3 text-sm text-fg-muted">없음</li>}
          {data.recent.map((a) => (
            <AppLine key={a.code} app={a}>
              <button
                type="button"
                onClick={() => setAsk({ title: `${a.name} 숨기기`, label: "숨기는 사유", action: (reason) => storeApi.admin.hide(a.code, reason) })}
                className={buttonClass("ghost", "sm")}
              >
                <EyeOff aria-hidden="true" className="size-4" />
                숨기기
              </button>
            </AppLine>
          ))}
        </ul>
      </section>

      <section aria-labelledby="hidden-title" className={section}>
        <h2 id="hidden-title" className={heading}>
          숨긴 앱
        </h2>
        <ul className="divide-y divide-line rounded-card border border-line px-5">
          {data.hidden.length === 0 && <li className="py-3 text-sm text-fg-muted">없음</li>}
          {data.hidden.map((a) => (
            <AppLine key={a.code} app={a}>
              <button type="button" disabled={busy !== null} onClick={() => act(`u${a.code}`, () => storeApi.admin.unhide(a.code))} className={cx(buttonClass("ghost", "sm"), "disabled:opacity-60")}>
                다시 공개
              </button>
            </AppLine>
          ))}
        </ul>
      </section>

      <section aria-labelledby="blocked-title" className={section}>
        <h2 id="blocked-title" className={heading}>
          차단한 회원
        </h2>
        <ul className="divide-y divide-line rounded-card border border-line px-5">
          {data.blocked.length === 0 && <li className="py-3 text-sm text-fg-muted">없음</li>}
          {data.blocked.map((p) => (
            <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <p className="min-w-0 break-all text-sm text-fg">
                {p.display_name} ({p.email}) <span className="text-xs text-fg-subtle">· {localDate(p.blocked_at)} · {p.reason}</span>
              </p>
              <button type="button" disabled={busy !== null} onClick={() => act(`b${p.user_id}`, () => storeApi.admin.unblock(p.user_id))} className={cx(buttonClass("ghost", "sm"), "disabled:opacity-60")}>
                차단 풀기
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** /store/manage/: 운영자 검토 화면. 권한은 API 가 판단한다 (JOHNNYSTUDIO_STORE_ADMINS) */
function ServiceLine({ svc, children }: { svc: ShowroomService; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
          <Link href={serviceHref(svc.code)} className="hover:underline">
            {svc.name}
          </Link>
          {svc.status && <Pill tone={statusTone(svc.status)}>{SERVICE_STATUS_LABELS[svc.status]}</Pill>}
        </p>
        <p className="mt-0.5 break-all text-xs text-fg-subtle">
          {svc.publisher} ({svc.owner?.email}) · {svc.host}
          {svc.status_reason && ` · 사유: ${svc.status_reason}`}
        </p>
      </div>
      <div className="flex gap-2">{children}</div>
    </li>
  );
}

/** Showroom 검토: 주소를 직접 열어 보고 승인한다 */
function ShowroomSections({ data, setAsk }: { data: ShowroomOverview; setAsk: (a: Ask) => void }) {
  const [busy, error, act] = useAction();
  const heading = "text-xl font-bold tracking-tight text-fg";
  return (
    <div className="mt-16 space-y-12 border-t border-line pt-12">
      <p className="text-sm font-semibold text-accent">Showroom (회원 웹 서비스)</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <section aria-labelledby="sr-pending-title" className="space-y-4">
        <h2 id="sr-pending-title" className={heading}>
          검토 대기 <span className="text-fg-subtle">{data.pending.length}</span>
        </h2>
        {data.pending.length === 0 ? (
          <p className="text-sm text-fg-muted">검토할 서비스가 없습니다.</p>
        ) : (
          data.pending.map((s) => (
            <article key={s.code} className={panelClass}>
              <div className="flex flex-wrap items-start gap-4">
                <ServiceIcon code={s.code} hasIcon={s.has_icon} name={s.name} version={s.updated_at} className="size-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-fg">
                    <Link href={serviceHref(s.code)} className="hover:underline">
                      {s.name}
                    </Link>
                  </h3>
                  <p className="mt-1 break-all text-sm text-fg-subtle">
                    {s.publisher} ({s.owner?.email}) · {s.category_label} · {localDate(s.created_at, true)}
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-fg">{s.url}</p>
                  {s.status_reason && <p className="mt-1 text-xs text-fg-subtle">{s.status_reason}</p>}
                  {s.summary && <p className="mt-2 text-sm text-fg-muted">{s.summary}</p>}
                  {s.description && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-fg-muted hover:text-fg">설명 보기</summary>
                      <PlainText text={s.description} className="mt-2 rounded-xl bg-canvas p-3 text-fg-muted" />
                    </details>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busy !== null} onClick={() => act(`sa${s.code}`, () => showroomApi.admin.approve(s.code))} className={cx(buttonClass("primary", "sm"), "disabled:opacity-60")}>
                  {busy === `sa${s.code}` ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
                  승인하고 공개
                </button>
                <button
                  type="button"
                  onClick={() => setAsk({ title: `${s.name} 반려`, label: "반려 사유", action: (reason) => showroomApi.admin.reject(s.code, reason) })}
                  className={buttonClass("secondary", "sm")}
                >
                  <X aria-hidden="true" className="size-4" />
                  반려
                </button>
                <OpenLink href={s.url} name={s.name} ugc className={buttonClass("ghost", "sm")}>
                  주소 열어 보기
                </OpenLink>
              </div>
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="sr-reports-title" className="space-y-4">
        <h2 id="sr-reports-title" className={heading}>
          신고 <span className="text-fg-subtle">{data.reports.length}</span>
        </h2>
        {data.reports.length === 0 ? (
          <p className="text-sm text-fg-muted">처리할 신고가 없습니다.</p>
        ) : (
          <ul className="space-y-4">
            {data.reports.map((r) => (
              <li key={r.id} className={panelClass}>
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                  {r.service_exists ? (
                    <Link href={serviceHref(r.service_code)} className="hover:underline">
                      {r.service_name}
                    </Link>
                  ) : (
                    <span>{r.service_name} (지워진 서비스)</span>
                  )}
                  <Pill tone="warn">{r.reason_label}</Pill>
                </p>
                <PlainText text={r.detail} className="mt-2 text-sm text-fg-muted" />
                <p className="mt-2 break-all text-xs text-fg-subtle">
                  {localDate(r.created_at, true)} · {r.signed_in ? "회원" : "비회원"}
                  {r.contact && ` · 연락처 ${r.contact}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.service_exists && (
                    <button
                      type="button"
                      onClick={() => setAsk({ title: `${r.service_name} 숨기기`, label: "숨기는 사유", action: (reason) => showroomApi.admin.hide(r.service_code, reason) })}
                      className={buttonClass("secondary", "sm")}
                    >
                      <EyeOff aria-hidden="true" className="size-4" />
                      서비스 숨기기
                    </button>
                  )}
                  <button type="button" disabled={busy !== null} onClick={() => act(`ra${r.id}`, () => showroomApi.admin.resolve(r.id, "actioned", ""))} className={cx(buttonClass("ghost", "sm"), "disabled:opacity-60")}>
                    조치함
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => act(`rd${r.id}`, () => showroomApi.admin.resolve(r.id, "dismissed", ""))} className={cx(buttonClass("ghost", "sm"), "disabled:opacity-60")}>
                    기각
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sr-recent-title" className="space-y-4">
        <h2 id="sr-recent-title" className={heading}>
          최근 공개한 서비스
        </h2>
        <ul className="divide-y divide-line rounded-card border border-line px-5">
          {data.recent.length === 0 && <li className="py-3 text-sm text-fg-muted">없음</li>}
          {data.recent.map((s) => (
            <ServiceLine key={s.code} svc={s}>
              <button
                type="button"
                onClick={() => setAsk({ title: `${s.name} 숨기기`, label: "숨기는 사유", action: (reason) => showroomApi.admin.hide(s.code, reason) })}
                className={buttonClass("ghost", "sm")}
              >
                <EyeOff aria-hidden="true" className="size-4" />
                숨기기
              </button>
            </ServiceLine>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sr-hidden-title" className="space-y-4">
        <h2 id="sr-hidden-title" className={heading}>
          숨긴 서비스
        </h2>
        <ul className="divide-y divide-line rounded-card border border-line px-5">
          {data.hidden.length === 0 && <li className="py-3 text-sm text-fg-muted">없음</li>}
          {data.hidden.map((s) => (
            <ServiceLine key={s.code} svc={s}>
              <button type="button" disabled={busy !== null} onClick={() => act(`su${s.code}`, () => showroomApi.admin.unhide(s.code))} className={cx(buttonClass("ghost", "sm"), "disabled:opacity-60")}>
                검토 대기로 되돌리기
              </button>
            </ServiceLine>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function StoreManage() {
  const session = useSession();
  const isClient = useIsClient();
  const signedIn = session.status === "signed-in";
  const overview = useRemote<AdminOverview>(signedIn ? "admin" : null);
  const showroom = useRemote<ShowroomOverview>(signedIn ? "showroom:admin" : null);
  const [ask, setAsk] = useState<Ask>(null);

  useEffect(() => {
    if (!signedIn) return;
    void reload();
    // 검사가 뒤에서 도므로 30초마다 새로 읽는다
    const t = setInterval(() => void reload(), 30_000);
    return () => clearInterval(t);
  }, [signedIn]);

  if (!isClient || session.status === "loading") return <Loading>로그인 상태를 확인하는 중입니다…</Loading>;
  if (session.status !== "signed-in") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">운영자 계정으로 로그인하세요</p>
        <div className="mt-5">
          <ButtonLink href={loginHref("/store/manage/")}>로그인</ButtonLink>
        </div>
      </div>
    );
  }
  if (!overview || overview.status === "loading") return <Loading />;
  if (overview.status === "error") {
    return overview.error.code === "not_admin" ? (
      <div className={panelClass}>
        <p className="font-semibold text-fg">운영자만 볼 수 있습니다</p>
        <p className="mt-2 text-sm text-fg-muted">운영자 이메일은 서버 설정 JOHNNYSTUDIO_STORE_ADMINS 에 적습니다.</p>
      </div>
    ) : (
      <ErrorBox error={overview.error} />
    );
  }
  return (
    <>
      <Overview data={overview.data} setAsk={setAsk} />
      {showroom?.status === "ready" && <ShowroomSections data={showroom.data} setAsk={setAsk} />}
      {showroom?.status === "error" && <ErrorBox error={showroom.error} title="Showroom 검토 목록을 불러오지 못했습니다" />}
      {ask && <ReasonDialog ask={ask} onClose={() => setAsk(null)} />}
    </>
  );
}
