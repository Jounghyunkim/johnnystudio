"use client";

import { Pencil, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { loginHref, useSession } from "@/lib/auth";
import { useIsClient } from "@/lib/bookmarks";
import { formatBytes } from "@/lib/format";
import {
  APP_STATUS_LABELS,
  RELEASE_STATUS_LABELS,
  type StoreApp,
  type StoreMeta,
  appHref,
  loadRemote,
  localDate,
  storeApi,
  useRemote,
} from "@/lib/store";

import { ButtonLink, buttonClass } from "../ui";
import { AppEditDialog, type DeleteTarget, DeleteDialog, IconButton } from "./store-edit";
import { AppIcon, ErrorBox, Loading, Pill, ScanBadge, panelClass, statusTone } from "./store-ui";

const reloadMine = () => loadRemote("mine", storeApi.myApps);

type Mine = { apps: StoreApp[] };

function AppRow({ app, onEdit, onDelete }: { app: StoreApp; onEdit: () => void; onDelete: (p: DeleteTarget) => void }) {
  return (
    <article className={panelClass}>
      <div className="flex flex-wrap items-start gap-4">
        <AppIcon code={app.code} hasIcon={app.has_icon} name={app.name} version={app.updated_at} className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-fg">
            <Link href={appHref(app.code)} className="hover:underline">
              {app.name}
            </Link>
            {app.status && <Pill tone={statusTone(app.status)}>{APP_STATUS_LABELS[app.status]}</Pill>}
            {app.status === "published" && !app.public && <Pill tone="warn">목록에 안 보임</Pill>}
          </h2>
          <p className="mt-1 text-sm text-fg-subtle">
            {app.category_label} · 내려받기 {app.download_count ?? 0}번 · {localDate(app.created_at)} 등록
          </p>
          {app.status_reason && <p className="mt-2 text-sm text-danger">사유: {app.status_reason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {app.status !== "hidden" && (
            <ButtonLink href={`/store/new/?app=${app.code}`} variant="secondary" size="sm">
              <Upload aria-hidden="true" className="size-4" />새 버전
            </ButtonLink>
          )}
          <button type="button" onClick={onEdit} className={buttonClass("ghost", "sm")}>
            <Pencil aria-hidden="true" className="size-4" />
            고치기
          </button>
          <IconButton app={app} onSaved={reloadMine} />
          <button type="button" onClick={() => onDelete({ kind: "app", app })} className={buttonClass("danger", "sm")}>
            <Trash2 aria-hidden="true" className="size-4" />
            지우기
          </button>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-line border-t border-line">
        {app.releases.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
                <span className="font-mono font-semibold">{r.version}</span>
                {r.status && <Pill tone={statusTone(r.status)}>{RELEASE_STATUS_LABELS[r.status]}</Pill>}
                <ScanBadge scan={r.scan} />
              </p>
              <p className="mt-1 break-all text-xs text-fg-subtle">
                {r.file_name} · {formatBytes(r.size)} · 내려받기 {r.download_count ?? 0}번
              </p>
              {r.status_reason && <p className="mt-1 text-xs text-danger">사유: {r.status_reason}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDelete({ kind: "release", app, id: r.id, version: r.version })}
              className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-fg-subtle hover:bg-raised hover:text-danger"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />이 버전 지우기
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** /store/mine/: 내가 올린 앱 */
export function StoreMine() {
  const session = useSession();
  const isClient = useIsClient();
  const signedIn = session.status === "signed-in";
  const mine = useRemote<Mine>(signedIn ? "mine" : null);
  const meta = useRemote<StoreMeta>("meta");
  const [editing, setEditing] = useState<StoreApp | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    if (signedIn) void loadRemote("mine", storeApi.myApps);
  }, [signedIn]);
  useEffect(() => {
    void loadRemote("meta", storeApi.meta);
  }, []);

  if (!isClient || session.status === "loading") return <Loading>로그인 상태를 확인하는 중입니다…</Loading>;
  if (session.status !== "signed-in") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">로그인이 필요합니다</p>
        <div className="mt-5">
          <ButtonLink href={loginHref("/store/mine/")}>로그인</ButtonLink>
        </div>
      </div>
    );
  }
  if (!mine || mine.status === "loading") return <Loading />;
  if (mine.status === "error") return <ErrorBox error={mine.error} />;

  const apps = mine.data.apps;
  return (
    <div className="space-y-5">
      {apps.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="font-semibold text-fg">아직 올린 앱이 없습니다</p>
          <div className="mt-6">
            <ButtonLink href="/store/new/">
              <Upload aria-hidden="true" className="size-4" />첫 앱 올리기
            </ButtonLink>
          </div>
        </div>
      ) : (
        apps.map((a) => <AppRow key={a.code} app={a} onEdit={() => setEditing(a)} onDelete={setDeleting} />)
      )}
      {editing && meta?.status === "ready" && <AppEditDialog app={editing} meta={meta.data} onSaved={reloadMine} onClose={() => setEditing(null)} />}
      {deleting && <DeleteDialog target={deleting} onDone={reloadMine} onClose={() => setDeleting(null)} />}
    </div>
  );
}
