"use client";

import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { cx } from "../ui";

/** 회원 화면의 입력 칸 (클라이언트 컴포넌트끼리만 쓴다) */
export const inputClass =
  "h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-fg placeholder:text-fg-subtle focus:border-fg-subtle focus:outline-none focus-visible:outline-2 focus-visible:outline-accent";

export const panelClass = "rounded-card border border-line bg-surface p-6 sm:p-8";

export const linkClass = "text-fg-muted underline underline-offset-4 hover:text-fg";

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-fg">
      {children}
    </label>
  );
}

/**
 * 비밀번호 입력 + 보기 버튼. 붙여 넣기와 비밀번호 관리 프로그램을 막지 않는다 (autoComplete 를 정확히 준다).
 * 보기 버튼은 휴대폰에서 잘못 친 글자를 확인하는 데 쓴다.
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={cx("relative", className)}>
      <input {...props} type={visible ? "text" : "password"} spellCheck={false} autoCapitalize="none" className={cx(inputClass, "pr-12")} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-fg-subtle hover:bg-raised hover:text-fg"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
      </button>
    </div>
  );
}

export function FormError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-3 text-sm text-danger">
      {message}
    </p>
  );
}
