"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { type ShowroomService, showroomApi } from "@/lib/showroom";

import { dialogClass } from "../store/store-ui";
import { buttonClass, cx } from "../ui";

/*
 * 서비스 소개 지우기. 소개한 사람('내 서비스', 서비스 상세)과 운영자(검토 화면, 서비스 상세)가 함께 쓴다.
 * 권한은 API 가 판단한다 (소개한 사람 또는 JOHNNYSTUDIO_STORE_ADMINS). 끝나면 onDone 으로 화면을 새로 읽거나 옮긴다.
 * 고치기는 소개 꾸미기 화면(/showroom/listing/?id=)이 맡는다 (기본 정보·주소·아이콘·소개 자료).
 */
export function ServiceDeleteDialog({
  svc,
  asAdmin = false,
  onDone,
  onClose,
}: {
  svc: Pick<ShowroomService, "code" | "name" | "publisher">;
  asAdmin?: boolean;
  onDone: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function run() {
    setBusy(true);
    setError(null);
    const r = await showroomApi.remove(svc.code);
    if (r.ok) await onDone();
    setBusy(false);
    if (!r.ok) return setError(r.message);
    ref.current?.close();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="svc-delete-title" className={dialogClass}>
      <h2 id="svc-delete-title" className="text-lg font-semibold">
        서비스 소개를 지울까요?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        <strong className="font-semibold text-fg">{svc.name}</strong>의 소개·아이콘·화면 그림이 바로 지워지고 되돌릴 수 없습니다. 서비스 자체에는 영향이 없습니다.
      </p>
      {asAdmin && (
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          운영자로 지웁니다. 소개한 사람({svc.publisher})의 &lsquo;내 서비스&rsquo;에서도 사라집니다. 잠시 내리기만 하려면 &lsquo;숨기기&rsquo;를 쓰세요.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" autoFocus onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
          취소
        </button>
        <button type="button" disabled={busy} onClick={run} className={cx(buttonClass("primary"), "bg-danger text-danger-ink hover:bg-danger/90 disabled:opacity-60")}>
          {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
          지우기
        </button>
      </div>
    </dialog>
  );
}
