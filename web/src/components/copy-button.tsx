"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** 값 복사 버튼. 클립보드를 쓸 수 없는 환경에서는 실패를 알린다 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("done");
    } catch {
      setState("fail");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      {state === "done" ? <Check aria-hidden="true" className="size-3.5 text-accent" /> : <Copy aria-hidden="true" className="size-3.5" />}
      <span>{state === "done" ? "복사됨" : state === "fail" ? "복사 실패" : "복사"}</span>
      <span className="sr-only">: {label}</span>
      <span aria-live="polite" className="sr-only">
        {state === "done" ? `${label}를 복사했습니다` : ""}
      </span>
    </button>
  );
}
