"use client";

import { useMemo, useState } from "react";
import { MetaPanel } from "./MetaPanel";
import type { Surah } from "@/lib/quran/types";

/**
 * Structural navigation: jump by sūrah, by juzʾ, or straight to a page.
 * Filtering runs over the Latin name, the Arabic name and the number, so
 * "36", "yasin" and "يس" all find the same place.
 */
export function NavigatorPanel({
  open,
  onClose,
  chapters,
  juzStarts,
  currentPage,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  chapters: Surah[];
  juzStarts: { id: number; page: number }[];
  currentPage: number;
  onNavigate: (page: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"surah" | "juz">("surah");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter(
      (c) =>
        String(c.id) === q ||
        c.nameSimple.toLowerCase().includes(q) ||
        c.translatedName.toLowerCase().includes(q) ||
        c.nameArabic.includes(query.trim()),
    );
  }, [chapters, query]);

  const go = (page: number) => {
    onNavigate(page);
    onClose();
  };

  return (
    <MetaPanel
      open={open}
      title="Navigate"
      subtitle={`Page ${currentPage} of 604`}
      onClose={onClose}
      side="start"
    >
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-veil/60 p-1">
        {(["surah", "juz"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs tracking-[0.14em] uppercase transition-colors ${
              tab === id
                ? "bg-gold-400/18 text-gold-100"
                : "text-gold-300/55 hover:text-gold-200"
            }`}
          >
            {id === "surah" ? "Sūrah" : "Juz’"}
          </button>
        ))}
      </div>

      {tab === "surah" && (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sūrah…"
            aria-label="Search sūrah"
            className="mb-3 w-full rounded-lg border border-gold-400/18 bg-obsidian/60 px-3 py-2 text-sm text-ink outline-none placeholder:text-gold-300/35 focus:border-gold-400/45"
          />
          <ul className="space-y-0.5">
            {filtered.map((chapter) => (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() => go(chapter.pages[0])}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gold-400/10"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md border border-gold-400/22 text-[0.64rem] tabular-nums text-gold-300/75">
                    {chapter.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">
                      {chapter.nameSimple}
                    </span>
                    <span className="block truncate text-[0.68rem] text-gold-300/45">
                      {chapter.translatedName} · {chapter.versesCount} āyāt
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.66rem] tabular-nums text-gold-300/40">
                    p{chapter.pages[0]}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-2.5 py-6 text-center text-sm text-gold-300/40">
                Nothing matches “{query}”.
              </li>
            )}
          </ul>
        </>
      )}

      {tab === "juz" && (
        <ul className="grid grid-cols-2 gap-1.5">
          {juzStarts.map((juz) => (
            <li key={juz.id}>
              <button
                type="button"
                onClick={() => go(juz.page)}
                className="w-full rounded-lg border border-gold-400/14 px-3 py-2.5 text-left transition-colors hover:border-gold-400/35 hover:bg-gold-400/10"
              >
                <span className="block text-sm text-ink">Juz’ {juz.id}</span>
                <span className="block text-[0.66rem] tabular-nums text-gold-300/45">
                  page {juz.page}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </MetaPanel>
  );
}
