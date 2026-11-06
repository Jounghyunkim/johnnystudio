"use client";

import { LoaderCircle } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { PASSWORD_MIN_LENGTH, setPassword } from "@/lib/auth";

import { buttonClass, cx } from "../ui";
import { FieldLabel, FormError, PasswordInput } from "./fields";

/**
 * 비밀번호 정하기·바꾸기. requireCurrent 이면 현재 비밀번호를 먼저 묻는다.
 * 여기서는 길이와 두 칸이 같은지만 본다. 나머지 규칙(흔한 비밀번호, 이메일과 비슷함)은 서버가 판단해 알려 준다.
 */
export function PasswordForm({
  email,
  requireCurrent,
  submitLabel,
  onDone,
}: {
  email: string;
  requireCurrent: boolean;
  submitLabel: string;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { current: useId(), next: useId(), confirm: useId(), hint: useId(), error: useId() };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (next.length < PASSWORD_MIN_LENGTH) return setError(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`);
    if (next !== confirm) return setError("새 비밀번호와 확인 칸이 서로 다릅니다.");
    setBusy(true);
    setError(null);
    const r = await setPassword(next, requireCurrent ? current : undefined);
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.message);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* 비밀번호 관리 프로그램이 어느 계정의 비밀번호인지 알 수 있게 아이디(이메일)를 함께 둔다 */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {requireCurrent && (
        <div>
          <FieldLabel htmlFor={ids.current}>현재 비밀번호</FieldLabel>
          <PasswordInput
            id={ids.current}
            name="current-password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-2"
          />
        </div>
      )}
      <div>
        <FieldLabel htmlFor={ids.next}>{requireCurrent ? "새 비밀번호" : "비밀번호"}</FieldLabel>
        <PasswordInput
          id={ids.next}
          name="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={128}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-describedby={error ? `${ids.hint} ${ids.error}` : ids.hint}
          aria-invalid={error !== null}
          className="mt-2"
        />
        <p id={ids.hint} className="mt-2 text-sm text-fg-subtle">
          {PASSWORD_MIN_LENGTH}자 이상. 기호를 섞지 않아도 됩니다. 짧은 문장처럼 길게 쓰는 편이 더 안전합니다.
        </p>
      </div>
      <div>
        <FieldLabel htmlFor={ids.confirm}>한 번 더</FieldLabel>
        <PasswordInput
          id={ids.confirm}
          name="confirm-password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-2"
        />
      </div>
      <FormError id={ids.error} message={error} />
      <button type="submit" disabled={busy} className={cx(buttonClass("primary"), "w-full disabled:opacity-60 sm:w-auto")}>
        {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {busy ? "저장하는 중…" : submitLabel}
      </button>
    </form>
  );
}
