"use client";

import type { MushafPage, Surah } from "@/lib/quran/types";

/**
 * The frame around the reading surface: the sūrah and juzʾ rails above, the
 * page number below, and the hairline rules that bound the text block.
 *
 * Everything here is deliberately quiet. It names where the reader is and
 * then gets out of the way.
 */
export function PageChrome({
  page,
  chapters,
  contentRef,
  children,
}: {
  page: MushafPage;
  chapters: Map<number, Surah>;
  /** The text block, measured to work out how much height the rails take. */
  contentRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const surahNames = page.surahIds
    .map((id) => chapters.get(id)?.nameSimple)
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative flex h-full w-full flex-col">
      <header className="flex items-baseline justify-between px-1 pb-3 text-[0.68rem] uppercase tracking-[0.22em] text-gold-300/55">
        <span className="truncate">{surahNames}</span>
        <span className="shrink-0 tabular-nums">
          Juz&apos; {page.juz} &middot; Ḥizb {page.hizb}
        </span>
      </header>

      <span className="gold-rule h-px w-full opacity-45" />

      <div ref={contentRef} className="relative min-h-0 flex-1 py-[1.4vh]">
        {children}
      </div>

      <span className="gold-rule h-px w-full opacity-45" />

      <footer className="flex items-center justify-center gap-3 pt-3">
        <span className="gold-rule h-px w-10 opacity-40" />
        <span className="text-[0.7rem] tabular-nums tracking-[0.3em] text-gold-300/60">
          {page.pageNumber}
        </span>
        <span className="gold-rule h-px w-10 opacity-40" />
      </footer>
    </div>
  );
}
