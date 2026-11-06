"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * YouTube 라이트 임베드: 누르기 전에는 썸네일만 불러온다 (추적·무거운 스크립트 없음). (ideation R9)
 * JS 가 없으면 YouTube 페이지로 가는 일반 링크로 동작한다.
 */
export function YouTubeLite({ id, title }: { id?: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (!id) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-card border border-dashed border-line-strong text-sm text-fg-muted">
        영상을 준비하고 있습니다.
      </div>
    );
  }

  if (playing) {
    return (
      <div className="overflow-hidden rounded-card border border-line bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="aspect-video w-full"
        />
      </div>
    );
  }

  return (
    <a
      href={`https://www.youtube.com/watch?v=${id}`}
      onClick={(e) => {
        e.preventDefault();
        setPlaying(true);
      }}
      className="group relative block overflow-hidden rounded-card border border-line bg-black"
    >
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
        className="aspect-video w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-ink shadow-2xl shadow-black/60 transition-transform group-hover:scale-105">
          <Play aria-hidden="true" className="ml-1 size-7 fill-current" />
        </span>
      </span>
      <span className="sr-only">{title} 영상 재생</span>
    </a>
  );
}
