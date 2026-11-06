"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { Photo } from "@/lib/schema";

/**
 * 사진 그리드 + 확대 보기. 확대 보기는 기본 <dialog> 라서 포커스 가두기·Esc 닫기를 브라우저가 해 준다.
 * JS 가 없으면 사진 파일로 가는 일반 링크로 동작한다.
 */
export function PhotoGallery({ photos, title }: { photos: readonly Photo[]; title: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal();
    if (index === null && d.open) d.close();
  }, [index]);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/7] items-center justify-center rounded-card border border-dashed border-line-strong text-sm text-fg-muted">
        사진을 준비하고 있습니다.
      </div>
    );
  }

  const count = photos.length;
  const move = (step: number) => setIndex((i) => (i === null ? i : (i + step + count) % count));
  const current = index === null ? undefined : photos[index];

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "ArrowRight") move(1);
    if (e.key === "ArrowLeft") move(-1);
  };

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <li key={p.src}>
            <a
              href={p.src}
              onClick={(e) => {
                e.preventDefault();
                setIndex(i);
              }}
              className="group block overflow-hidden rounded-xl border border-line bg-canvas"
            >
              <img
                src={p.src}
                alt={p.alt}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </a>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label={`${title} 사진 확대 보기`}
        onClose={() => setIndex(null)}
        onKeyDown={onKeyDown}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIndex(null); // 바깥(배경)을 누르면 닫는다
        }}
        className="m-auto max-h-[92dvh] w-[min(92vw,72rem)] bg-transparent p-0 text-fg"
      >
        {current && (
          <figure className="flex flex-col gap-3">
            <img src={current.src} alt={current.alt} className="max-h-[78dvh] w-full rounded-xl object-contain" />
            <figcaption className="flex items-center justify-between gap-4 text-sm text-fg-muted">
              <span>{current.caption ?? current.alt}</span>
              <span className="tabular-nums text-fg-subtle">
                {(index ?? 0) + 1} / {count}
              </span>
            </figcaption>
          </figure>
        )}
        <div className="mt-3 flex justify-center gap-2">
          {count > 1 && (
            <button type="button" onClick={() => move(-1)} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:bg-raised">
              <ChevronLeft aria-hidden="true" className="size-5" />
              <span className="sr-only">이전 사진</span>
            </button>
          )}
          <button type="button" onClick={() => setIndex(null)} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:bg-raised">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">닫기</span>
          </button>
          {count > 1 && (
            <button type="button" onClick={() => move(1)} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:bg-raised">
              <ChevronRight aria-hidden="true" className="size-5" />
              <span className="sr-only">다음 사진</span>
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
