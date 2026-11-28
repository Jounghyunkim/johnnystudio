"use client";

import { LoaderCircle, Pencil } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useId, useState } from "react";

import { type Remote, type StoreMe, setRemote, storeApi } from "@/lib/store";

import { inputClass } from "./store/store-ui";
import { buttonClass, cx } from "./ui";

/**
 * 표시 이름 보기·바꾸기 (계정 화면의 '계정 정보'와 설정 화면의 '내 계정'이 함께 쓴다, 2026-11-28 사용자 요청으로 이름을 '표시 이름' 하나로).
 * 회원 한 사람에 하나이고 Store·Showroom 의 '올린 사람'·'소개한 사람'으로 공개된다 (store_publishers, /api/store/me).
 * 이미 정했으면 이름만 바꾸고(PATCH, 약관에 다시 동의하지 않는다),
 * 처음이면 이용약관 동의·만 14세 확인과 함께 정한다 (POST, 앱 올리기 화면의 PublisherForm 과 같은 API).
 * me: useRemote<StoreMe>("me") — 불러오기(loadRemote)는 쓰는 화면이 한다
 */
export function DisplayName({ me }: { me: Remote<StoreMe> | undefined }) {
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
    // -my-2: 버튼(36px)이 줄 높이를 늘려 이름 글자가 왼쪽 이름표(dt)보다 내려가지 않게 한다
    return (
      <div className="-my-2 flex flex-wrap items-center gap-x-3 gap-y-1">
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
            aria-label={`표시 이름 ${p ? "바꾸기" : "정하기"}`}
            className={buttonClass("ghost", "sm")}
          >
            <Pencil aria-hidden="true" className="size-4" />
            {p ? "바꾸기" : "정하기"}
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
