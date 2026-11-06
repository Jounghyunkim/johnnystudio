"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { MouseEvent } from "react";

import { useTheme } from "@/lib/theme";
import type { ThemePref } from "@/lib/theme-script";

import { cx } from "./ui";

/** 헤더(넓은 화면): 밝게 ↔ 어둡게 한 번에 바꾸는 아이콘 버튼 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setPref } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? "밝은 테마로 바꾸기" : "어두운 테마로 바꾸기";
  return (
    <button
      type="button"
      onClick={() => setPref(next)}
      aria-label={label}
      title={label}
      className={cx(
        "size-9 shrink-0 items-center justify-center rounded-full border border-line text-fg-muted transition-colors hover:border-line-strong hover:text-fg",
        className,
      )}
    >
      {theme === "dark" ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
    </button>
  );
}

/** 휴대폰 메뉴(☰) 안의 한 줄 */
export function MenuThemeToggle() {
  const { theme, setPref } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    setPref(next);
    e.currentTarget.closest("details")?.removeAttribute("open");
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-line px-3.5 pb-2 pt-3 text-left text-sm font-medium text-fg-muted hover:bg-raised hover:text-fg"
    >
      {next === "light" ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
      {next === "light" ? "밝은 테마로 보기" : "어두운 테마로 보기"}
    </button>
  );
}

const CHOICES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "dark", label: "어둡게", icon: Moon },
  { value: "light", label: "밝게", icon: Sun },
  { value: "system", label: "시스템", icon: Monitor },
];

/** 바닥글: 어둡게(기본) · 밝게 · 시스템 설정 따르기 */
export function ThemeChoice() {
  const { pref, setPref } = useTheme();
  return (
    <div role="group" aria-label="화면 테마" className="inline-flex rounded-full border border-line p-0.5">
      {CHOICES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setPref(value)}
          aria-pressed={pref === value}
          title={value === "system" ? "운영체제 설정을 따릅니다" : undefined}
          className={cx(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
            pref === value ? "bg-raised text-fg" : "text-fg-subtle hover:text-fg",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
