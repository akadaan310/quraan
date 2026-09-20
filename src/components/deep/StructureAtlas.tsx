"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import type { StructureAtlasData, SurahSymmetry } from "@/lib/deep/types";
import type { Surah } from "@/lib/quran/types";

/**
 * The macro view: the 30 ajzāʾ laid out by their own word-count weight, the
 * 29 muqaṭṭaʿāt sūrahs gathered in one place, and the sūrahs whose one real
 * mirrored pivot would otherwise be invisible next to a low overall symmetry
 * score. Three real, already-computed measurements shown at the scale they
 * were never shown at before — nothing here is a new claim about the text.
 */
export function StructureAtlas({
  open,
  onClose,
  data,
  symmetry,
  chapters,
  onOpenVerse,
  onOpenPage,
  verseToPage,
}: {
  open: boolean;
  onClose: () => void;
  data: StructureAtlasData | null;
  symmetry: Record<string, SurahSymmetry>;
  chapters: Map<number, Surah>;
  onOpenVerse: (page: number, verseKey: string) => void;
  onOpenPage: (page: number) => void;
  verseToPage: (verseKey: string) => number;
}) {
  const maxWords = useMemo(
    () => Math.max(1, ...(data?.juz.map((j) => j.wordCount) ?? [1])),
    [data],
  );

  const muqattaatSurahs = useMemo(
    () =>
      Object.entries(symmetry)
        .filter(([, s]) => s.muqattaat)
        .map(([id, s]) => ({ id: Number(id), muqattaat: s.muqattaat! }))
        .sort((a, b) => a.id - b.id),
    [symmetry],
  );

  const anomalies = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.anomalies)
      .filter(([, a]) => a.isAnomaly)
      .map(([id, a]) => ({ id: Number(id), ...a }))
      .sort((a, b) => b.peakScore - a.peakScore);
  }, [data]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-no-swipe
          role="dialog"
          aria-label="Structural atlas"
          className="fixed inset-0 z-50 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ background: "rgb(5 6 12 / 0.9)", backdropFilter: "blur(14px)" }}
        >
          <header
            className="flex items-start justify-between gap-3 px-5 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
          >
            <div className="min-w-0">
              <p className="text-[0.6rem] tracking-[0.2em] text-gold-300/55 uppercase">
                Structural atlas
              </p>
              <h2 className="truncate text-sm text-gold-100">
                The whole Muṣḥaf, zoomed out
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close structural atlas"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-gold-200/65 hover:bg-gold-400/12 hover:text-gold-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          {!data ? (
            <p className="px-6 py-12 text-center text-sm text-gold-300/45">
              Loading the structural data…
            </p>
          ) : (
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
              <section className="mb-5">
                <p className="mb-2 px-1 text-[0.6rem] tracking-[0.18em] text-gold-300/55 uppercase">
                  Thirty ajzāʾ, by word count
                </p>
                <ul className="space-y-1">
                  {data.juz.map((j) => (
                    <li key={j.juz}>
                      <button
                        type="button"
                        onClick={() => onOpenPage(j.pages[0])}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-gold-400/10"
                      >
                        <span className="w-6 shrink-0 text-[0.62rem] tabular-nums text-gold-300/45">
                          {j.juz}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-gold-400/8">
                          <span
                            className="block h-full rounded-full bg-gold-400/50"
                            style={{ width: `${Math.max(4, (j.wordCount / maxWords) * 100)}%` }}
                          />
                        </span>
                        <span className="w-16 shrink-0 text-right text-[0.6rem] tabular-nums text-gold-300/40">
                          {j.wordCount.toLocaleString()}w
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {muqattaatSurahs.length > 0 && (
                <section className="mb-5">
                  <p className="mb-2 px-1 text-[0.6rem] tracking-[0.18em] text-gold-300/55 uppercase">
                    The disconnected letters — {muqattaatSurahs.length} sūrahs
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {muqattaatSurahs.map(({ id, muqattaat }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpenPage(chapters.get(id)?.pages[0] ?? 1)}
                        className="glass flex items-center gap-2 px-2.5 py-1.5"
                      >
                        <span
                          lang="ar"
                          dir="rtl"
                          className="text-sm tracking-[0.15em] text-gold-100"
                          style={{ fontFamily: '"UthmanicHafs", serif' }}
                        >
                          {muqattaat}
                        </span>
                        <span className="text-[0.6rem] text-gold-300/45">
                          {chapters.get(id)?.nameSimple ?? id}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {anomalies.length > 0 && (
                <section>
                  <p className="mb-2 px-1 text-[0.6rem] tracking-[0.18em] text-gold-300/55 uppercase">
                    A lone strong pivot, despite a weak overall mirror
                  </p>
                  <ul className="space-y-1">
                    {anomalies.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => onOpenVerse(verseToPage(a.peakOpening), a.peakOpening)}
                          className="glass flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-ink">
                              {chapters.get(a.id)?.nameSimple ?? `Sūrah ${a.id}`}
                            </span>
                            <span className="block text-[0.64rem] tabular-nums text-gold-300/45">
                              {a.peakOpening} ↔ {a.peakClosing}
                            </span>
                          </span>
                          <span className="shrink-0 text-[0.62rem] tabular-nums text-gold-300/40">
                            {(a.peakScore * 100).toFixed(0)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="mt-5 px-1 text-[0.62rem] leading-relaxed text-gold-300/35">
                Word counts are a structural fact, not a claim about pacing or
                difficulty. The pivot list uses the same root-overlap measure
                and notability bar as the symmetry lens, applied across every
                sūrah rather than within one.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
