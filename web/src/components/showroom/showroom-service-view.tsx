"use client";

import { Flag, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { useIsClient } from "@/lib/bookmarks";
import { SERVICE_STATUS_LABELS, type ShowroomMeta, type ShowroomService, serviceShotSrc, showroomApi } from "@/lib/showroom";
import { loadRemote, localDate, parseAppCode, useRemote } from "@/lib/store";
import { useLocationSearch } from "@/lib/use-location-search";

import { CopyButton } from "../copy-button";
import { ReportDialog } from "../store/store-app-view";
import { ErrorBox, Loading, Pill, PlainText, panelClass, statusTone } from "../store/store-ui";
import { ButtonLink, buttonClass, cx } from "../ui";
import { OpenLink, ServiceIcon } from "./showroom-ui";

/** 서비스 상세 (/showroom/service/?id=코드) */
export function ShowroomServiceView() {
  const [search] = useLocationSearch();
  const isClient = useIsClient();
  const code = parseAppCode(new URLSearchParams(search).get("id"));
  const svc = useRemote<ShowroomService>(code ? `showroom:service:${code}` : null);
  const meta = useRemote<ShowroomMeta>("showroom:meta");
  const reportDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (code) void loadRemote(`showroom:service:${code}`, () => showroomApi.service(code));
  }, [code]);
  useEffect(() => {
    void loadRemote("showroom:meta", showroomApi.meta);
  }, []);

  if (!isClient) return <Loading />;
  if (!code || svc?.status === "error") {
    if (svc?.status === "error" && svc.error.status !== 404) return <ErrorBox error={svc.error} />;
    return (
      <div className={panelClass}>
        <h1 className="text-xl font-semibold text-fg">서비스를 찾을 수 없습니다</h1>
        <p className="mt-2 text-sm text-fg-muted">
          지워졌거나 아직 공개되지 않은 서비스입니다.{" "}
          <Link href="/showroom/" className="underline underline-offset-4">
            Showroom 목록으로
          </Link>
        </p>
      </div>
    );
  }
  if (!svc || svc.status === "loading") return <Loading />;

  const s = svc.data;
  const review = Boolean(s.viewer?.owner || s.viewer?.admin) && s.status !== undefined;
  const link = `${window.location.origin}/showroom/service/?id=${s.code}`;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ServiceIcon code={s.code} hasIcon={s.has_icon} name={s.name} version={s.updated_at} className="size-20 shrink-0 sm:size-24" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg-subtle">
            {s.category_label} · 소개한 사람 <span className="text-fg-muted">{s.publisher}</span>
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold tracking-tight text-fg sm:text-4xl">{s.name}</h1>
          {s.summary && <p className="mt-2 text-base text-fg-muted">{s.summary}</p>}
        </div>
      </header>

      {review && s.status && s.status !== "published" && (
        <div role="status" className={cx(panelClass, "border-line-strong")}>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
            <Pill tone={statusTone(s.status)}>{SERVICE_STATUS_LABELS[s.status]}</Pill>
            {s.status === "pending" && "운영자가 검토한 뒤 공개됩니다. 이 화면은 소개한 사람과 운영자에게만 보입니다."}
            {s.status === "rejected" && "공개하지 않기로 했습니다. 고쳐서 저장하면 다시 검토합니다."}
            {s.status === "hidden" && "운영자가 공개를 멈췄습니다."}
          </p>
          {s.status_reason && <p className="mt-2 text-sm text-fg-muted">사유: {s.status_reason}</p>}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <section aria-label="서비스 열기" className={cx(panelClass, "flex flex-wrap items-center justify-between gap-4")}>
            <div className="min-w-0">
              <p className="font-semibold text-fg">바로 써 보기</p>
              <p className="mt-1 break-all font-mono text-sm text-fg-subtle">{s.url}</p>
            </div>
            <OpenLink href={s.url} name={s.name} ugc className={buttonClass("primary")}>
              서비스 열기
            </OpenLink>
          </section>

          {s.has_screenshot && (
            <img
              src={serviceShotSrc(s.code, s.updated_at)}
              alt={`${s.name} 화면`}
              loading="lazy"
              decoding="async"
              className="w-full rounded-card border border-line bg-raised"
            />
          )}

          {s.description && (
            <section aria-labelledby="about-service">
              <h2 id="about-service" className="text-lg font-semibold text-fg">
                소개
              </h2>
              <PlainText text={s.description} className="mt-3 text-fg-muted" />
            </section>
          )}
          {s.published_at && <p className="text-xs text-fg-subtle">{localDate(s.published_at)} 공개</p>}
        </div>

        <aside className="space-y-5">
          <div className={panelClass}>
            <p className="text-sm font-semibold text-fg">회원이 소개한 서비스입니다</p>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              운영자가 주소와 내용을 보고 공개했지만, 바깥 사이트의 내용과 개인정보 처리는 그 서비스를 만든 사람이 책임집니다. 로그인 정보나 결제 정보를 넣기 전에 주소({s.host})를 꼭 확인하세요.
            </p>
            <p className="mt-3 text-xs text-fg-subtle">
              JohnnyStudio가 직접 만든 서비스는{" "}
              <Link href="/library/?type=web-app" className="underline underline-offset-4">
                Library
              </Link>
              에 있습니다.
            </p>
          </div>
          <div className={panelClass}>
            <p className="text-sm font-semibold text-fg">공유</p>
            <p className="mt-2 break-all font-mono text-xs text-fg-muted">{link}</p>
            <div className="mt-3">
              <CopyButton value={link} label="서비스 소개 주소" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.viewer?.owner && (
              <ButtonLink href="/showroom/mine/" variant="secondary" size="sm">
                <Pencil aria-hidden="true" className="size-4" />
                고치기
              </ButtonLink>
            )}
            {!s.viewer?.owner && s.status === undefined && meta?.status === "ready" && (
              <button type="button" onClick={() => reportDialog.current?.showModal()} className={buttonClass("ghost", "sm")}>
                <Flag aria-hidden="true" className="size-4" />
                신고
              </button>
            )}
          </div>
        </aside>
      </div>

      {meta?.status === "ready" && (
        <ReportDialog name={s.name} reasons={meta.data.report_reasons} dialog={reportDialog} send={(body) => showroomApi.report(s.code, body)} />
      )}
    </div>
  );
}
