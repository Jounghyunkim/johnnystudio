"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";

import { loginHref, useSession } from "@/lib/auth";
import { useIsClient } from "@/lib/bookmarks";
import { formatBytes } from "@/lib/format";
import { IMAGE_ACCEPT, type ShowroomMeta, type ShowroomService, looksLikeServiceUrl, serviceHref, showroomApi } from "@/lib/showroom";
import { ICON_ACCEPT, type StoreMe, loadRemote, setRemote, storeApi, useRemote } from "@/lib/store";

import { PublisherForm } from "../store/store-upload";
import { ErrorBox, Loading, inputClass, panelClass } from "../store/store-ui";
import { ButtonLink, buttonClass, cx } from "../ui";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-fg">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

function SubmitForm({ meta }: { meta: ShowroomMeta }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ service: ShowroomService; warning: string | null } | null>(null);
  const ids = { name: useId(), url: useId(), summary: useId(), description: useId(), category: useId(), icon: useId(), shot: useId() };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    const icon = f.get("icon");
    const shot = f.get("screenshot");
    const iconFile = icon instanceof File && icon.size > 0 ? icon : null;
    const shotFile = shot instanceof File && shot.size > 0 ? shot : null;
    if (!looksLikeServiceUrl(text("url"))) return setError("서비스 주소는 https:// 로 시작하는 도메인 주소여야 합니다.");
    if (iconFile && iconFile.size > meta.limits.icon_max_bytes) return setError(`아이콘 그림은 ${formatBytes(meta.limits.icon_max_bytes)}까지 올릴 수 있습니다.`);
    if (shotFile && shotFile.size > meta.limits.screenshot_max_bytes) return setError(`화면 그림은 ${formatBytes(meta.limits.screenshot_max_bytes)}까지 올릴 수 있습니다.`);
    setError(null);
    setBusy("등록하는 중");
    const r = await showroomApi.create({ name: text("name"), url: text("url"), summary: text("summary"), description: text("description"), category: text("category") });
    if (!r.ok) {
      setBusy(null);
      return setError(r.message);
    }
    let service = r.data;
    const failed: string[] = [];
    for (const [kind, file, label] of [["icon", iconFile, "아이콘"], ["screenshot", shotFile, "화면 그림"]] as const) {
      if (!file) continue;
      setBusy(`${label}을(를) 올리는 중`);
      const up = await showroomApi.uploadImage(service.code, kind, file);
      if (up.ok) service = up.data;
      else failed.push(`${label}: ${up.message}`);
    }
    setBusy(null);
    setRemote(`showroom:service:${service.code}`, service);
    setDone({ service, warning: failed.length ? `${failed.join(" / ")} (내 서비스에서 다시 올릴 수 있습니다)` : null });
  }

  if (done) {
    return (
      <div role="status" className={panelClass}>
        <p className="flex items-center gap-2 text-lg font-semibold text-fg">
          <CheckCircle2 aria-hidden="true" className="size-5 text-accent" />
          접수했습니다
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          운영자가 주소와 내용을 확인한 뒤 공개합니다. 결과는{" "}
          <Link href="/showroom/mine/" className="underline underline-offset-4">
            내 서비스
          </Link>
          에서 볼 수 있습니다.
        </p>
        {done.warning && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {done.warning}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={serviceHref(done.service.code)}>소개 화면 보기</ButtonLink>
          <ButtonLink href="/showroom/mine/" variant="secondary">
            내 서비스
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className={cx(panelClass, "space-y-5")}>
        <Field id={ids.name} label="서비스 이름">
          <input id={ids.name} name="name" required maxLength={80} className={cx(inputClass, "h-12")} />
        </Field>
        <Field id={ids.url} label="서비스 주소" hint="https:// 로 시작하는 주소. 공개한 뒤 주소를 바꾸면 다시 검토합니다.">
          <input id={ids.url} name="url" type="url" required maxLength={500} placeholder="https://" className={cx(inputClass, "h-12 font-mono")} />
        </Field>
        <Field id={ids.summary} label="한 줄 소개" hint="160자까지. 목록 카드에 보입니다.">
          <input id={ids.summary} name="summary" maxLength={160} className={cx(inputClass, "h-12")} />
        </Field>
        <Field id={ids.description} label="설명" hint="무엇을 하는 서비스인지, 누가 쓰면 좋은지, 가입·요금이 필요한지 적어 주세요. 5000자까지.">
          <textarea id={ids.description} name="description" maxLength={5000} rows={7} className={cx(inputClass, "py-3")} />
        </Field>
        <Field id={ids.category} label="분류">
          <select id={ids.category} name="category" defaultValue="productivity" className={cx(inputClass, "h-12")}>
            {Object.entries(meta.categories).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={ids.icon} label="아이콘 (선택)" hint={`PNG·JPEG·WebP·ICO, ${formatBytes(meta.limits.icon_max_bytes)}까지. 256px 로 다시 그립니다.`}>
            <input id={ids.icon} name="icon" type="file" accept={ICON_ACCEPT} className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-full file:border-0 file:bg-raised file:px-4 file:py-2 file:text-sm file:font-semibold file:text-fg" />
          </Field>
          <Field id={ids.shot} label="화면 그림 (선택)" hint={`PNG·JPEG·WebP, ${formatBytes(meta.limits.screenshot_max_bytes)}까지. 긴 변 1600px 로 줄입니다.`}>
            <input id={ids.shot} name="screenshot" type="file" accept={IMAGE_ACCEPT} className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-full file:border-0 file:bg-raised file:px-4 file:py-2 file:text-sm file:font-semibold file:text-fg" />
          </Field>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy !== null} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
        {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {busy ?? "검토 요청하기"}
      </button>
    </form>
  );
}

/** /showroom/new/: 서비스 소개하기 (로그인 → 표시 이름·약관 → 양식) */
export function ShowroomSubmit() {
  const session = useSession();
  const isClient = useIsClient();
  const signedIn = session.status === "signed-in";
  const me = useRemote<StoreMe>(signedIn ? "me" : null);
  const meta = useRemote<ShowroomMeta>("showroom:meta");

  useEffect(() => {
    void loadRemote("showroom:meta", showroomApi.meta);
  }, []);
  useEffect(() => {
    if (signedIn) void loadRemote("me", storeApi.me);
  }, [signedIn]);

  if (!isClient || session.status === "loading") return <Loading>로그인 상태를 확인하는 중입니다…</Loading>;
  if (session.status === "unavailable") return <ErrorBox error={{ ok: false, status: 0, code: "unavailable", message: "회원 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요." }} />;
  if (session.status === "signed-out") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">로그인이 필요합니다</p>
        <p className="mt-2 text-sm text-fg-muted">서비스를 소개하려면 로그인하세요. 처음이면 이메일 인증으로 가입합니다.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={loginHref("/showroom/new/")}>로그인</ButtonLink>
          <ButtonLink href="/signup/" variant="secondary">
            가입하기
          </ButtonLink>
        </div>
      </div>
    );
  }
  if (!me || me.status === "loading" || !meta || meta.status === "loading") return <Loading />;
  if (me.status === "error") return <ErrorBox error={me.error} />;
  if (meta.status === "error") return <ErrorBox error={meta.error} />;
  const m = me.data;
  if (m.publisher?.blocked) {
    return (
      <div role="alert" className={panelClass}>
        <p className="font-semibold text-danger">이 계정은 서비스를 소개할 수 없습니다</p>
        {m.publisher.blocked_reason && <p className="mt-2 text-sm text-fg-muted">사유: {m.publisher.blocked_reason}</p>}
      </div>
    );
  }
  if (!meta.data.submissions_open && !m.admin) {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">지금은 새 서비스를 받지 않습니다</p>
        <p className="mt-2 text-sm text-fg-muted">잠시 뒤 다시 확인해 주세요.</p>
      </div>
    );
  }
  if (!m.publisher || !m.publisher.terms_current) return <PublisherForm me={m} />;
  return <SubmitForm meta={meta.data} />;
}
