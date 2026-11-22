"use client";

/**
 * 관리 화면의 입력 조각. 라벨·도움말·오류를 입력과 묶는다 (aria-describedby, aria-invalid).
 */
import { type ReactNode, useId } from "react";

import { cx } from "../ui";

export const inputClass =
  "w-full rounded-xl border border-line-strong bg-canvas px-3.5 text-sm text-fg placeholder:text-fg-subtle focus:border-fg-subtle focus:outline-none focus-visible:outline-2 focus-visible:outline-accent aria-[invalid=true]:border-danger";

export const panelClass = "rounded-card border border-line bg-surface p-5 sm:p-6";

export const smallButton =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50";

export const iconButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-raised hover:text-fg disabled:opacity-40";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}

function Frame({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-fg">
        {label}
        {required && (
          <span className="ml-1 font-normal text-fg-subtle" aria-hidden="true">
            (필수)
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function described(id: string, hint?: ReactNode, error?: string): string | undefined {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

export function TextField({
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  maxLength,
  counter,
  mono,
  ...frame
}: FieldProps & {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: "text" | "url" | "number";
  maxLength?: number;
  /** 글자 수 표시 (최대값) */
  counter?: number;
  mono?: boolean;
}) {
  const id = useId();
  const over = counter !== undefined && value.length > counter;
  return (
    <Frame id={id} {...frame} error={frame.error ?? (over ? `${counter}자를 넘었습니다` : undefined)}>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          required={frame.required}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(frame.error) || over}
          aria-describedby={described(id, frame.hint, frame.error ?? (over ? "over" : undefined))}
          spellCheck={mono ? false : undefined}
          className={cx(inputClass, "h-10", mono && "font-mono text-xs", counter !== undefined && "pr-16")}
        />
        {counter !== undefined && (
          <span aria-hidden="true" className={cx("absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums", over ? "text-danger" : "text-fg-subtle")}>
            {value.length}/{counter}
          </span>
        )}
      </div>
    </Frame>
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  mono,
  placeholder,
  ...frame
}: FieldProps & { value: string; onChange: (value: string) => void; rows?: number; mono?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <Frame id={id} {...frame}>
      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(frame.error)}
        aria-describedby={described(id, frame.hint, frame.error)}
        spellCheck={mono ? false : undefined}
        className={cx(inputClass, "py-2.5 leading-relaxed", mono && "font-mono text-xs")}
      />
    </Frame>
  );
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  ...frame
}: FieldProps & { value: T | ""; options: ReadonlyArray<{ value: T; label: string }>; onChange: (value: T) => void }) {
  const id = useId();
  return (
    <Frame id={id} {...frame}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-invalid={Boolean(frame.error)}
        aria-describedby={described(id, frame.hint, frame.error)}
        className={cx(inputClass, "h-10")}
      >
        {value === "" && <option value="">고르세요</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Frame>
  );
}

export function CheckboxField({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 size-4 shrink-0 accent-accent"
      />
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="mt-0.5 text-xs text-fg-subtle">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function Section({ id, title, description, action, children }: { id: string; title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={panelClass}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-base font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

/** 파일 고르기 버튼 (input[type=file] 을 라벨로 감싼다: 키보드로도 열린다) */
export function FilePicker({ label, accept, disabled, onFile }: { label: string; accept?: string; disabled?: boolean; onFile: (file: File) => void }) {
  return (
    <label className={cx(smallButton, "cursor-pointer focus-within:outline-2 focus-within:outline-accent", disabled && "pointer-events-none opacity-50")}>
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      {label}
    </label>
  );
}
