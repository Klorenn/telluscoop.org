"use client";

import { useState } from "react";

export default function VideoPlayer({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const embed = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

  if (play) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-[16px] bg-ink">
        <iframe
          src={embed}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlay(true)}
      className="group relative block aspect-video w-full overflow-hidden rounded-[16px] bg-ink text-left"
      aria-label={`Reproducir: ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb} alt="" width={480} height={360} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      <span className="absolute inset-0 bg-ink/20 transition-colors group-hover:bg-ink/10" />
      <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-mint-btn shadow-sm">
        <span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[12px] border-y-transparent border-l-ink" aria-hidden="true" />
      </span>
    </button>
  );
}
