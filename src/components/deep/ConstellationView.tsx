"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { juzForPage } from "@/lib/quran/layout";
import type { Constellation } from "@/lib/deep/types";
import type { Surah } from "@/lib/quran/types";

/**
 * The thematic constellation.
 *
 * Verses near the one being read are placed on a ring around it and joined by
 * threads whose brightness is the similarity. Each thread names the roots the
 * two verses actually share, because a link a reader cannot check is a link
 * they have to take on faith — and the model behind this is a distributional
 * one over roots, not a claim about meaning.
 */

export function ConstellationView({
  open,
  origin,
  originLabel,
  links,
  loading,
  onOpenVerse,
  onClose,
  gloss,
  chapters,
}: {
  open: boolean;
  origin: string;
  originLabel: string;
  links: Constellation[];
  loading: boolean;
  onOpenVerse: (page: number, verseKey: string) => void;
  onClose: () => void;
  gloss: (root: string) => string | undefined;
  /** For the Meccan/Medinan · juzʾ badge on each link — omit to hide it. */
  chapters?: Map<number, Surah>;
}) {
  const nodes = useMemo(() => layout(links), [links]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-no-swipe
          role="dialog"
          aria-label={`Verses related to ${origin}`}
          className="fixed inset-0 z-50 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ background: "rgb(5 6 12 / 0.86)", backdropFilter: "blur(14px)" }}
        >
          <header
            className="flex items-start justify-between gap-3 px-5 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
          >
            <div className="min-w-0">
              <p className="text-[0.6rem] tracking-[0.2em] text-gold-300/55 uppercase">
                Constellation
              </p>
              <h2 className="truncate text-sm text-gold-100">{originLabel}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close constellation"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-gold-200/65 hover:bg-gold-400/12 hover:text-gold-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          {loading && (
            <p className="px-5 py-10 text-center text-sm text-gold-300/45">
              Tracing threads…
            </p>
          )}

          {!loading && links.length === 0 && (
            <p className="mx-auto max-w-sm px-5 py-10 text-center text-sm leading-relaxed text-gold-300/50">
              This verse has no triliteral roots to trace — the disconnected
              letters that open a sūrah sit outside the semantic map.
            </p>
          )}

          {!loading && links.length > 0 && (
            <>
              <div className="relative mx-auto aspect-square w-full max-w-[26rem] shrink-0 px-4">
                <svg viewBox="-110 -110 220 220" className="h-full w-full">
                  <defs>
                    <radialGradient id="coreGlow">
                      <stop offset="0%" stopColor="#fdf3d7" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#d4ac4e" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {nodes.map((node) => (
                    <line
                      key={`thread-${node.link.verseKey}`}
                      x1="0"
                      y1="0"
                      x2={node.x}
                      y2={node.y}
                      stroke="#e8c977"
                      strokeWidth={0.4 + node.link.similarity * 1.1}
                      strokeOpacity={0.18 + node.link.similarity * 0.5}
                    />
                  ))}

                  <circle cx="0" cy="0" r="26" fill="url(#coreGlow)" />
                  <circle cx="0" cy="0" r="4.4" fill="#fdf3d7" />

                  {nodes.map((node) => (
                    <g key={node.link.verseKey}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={2 + node.link.similarity * 2.4}
                        fill="#f5e0a8"
                        fillOpacity={0.5 + node.link.similarity * 0.5}
                      />
                      <text
                        x={node.x}
                        y={node.y + (node.y > 0 ? 9 : -6)}
                        textAnchor="middle"
                        className="fill-gold-200/70"
                        style={{ fontSize: 5.4, letterSpacing: 0.3 }}
                      >
                        {node.link.verseKey}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              <ul className="thin-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-4 pb-6">
                {links.map((link) => (
                  <li key={link.verseKey}>
                    <button
                      type="button"
                      onClick={() => onOpenVerse(link.page, link.verseKey)}
                      className="glass flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full bg-gold-200"
                        style={{ opacity: 0.35 + link.similarity * 0.65 }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm tabular-nums text-ink">
                          {link.verseKey}
                          <span className="ml-2 text-[0.64rem] text-gold-300/45">
                            page {link.page}
                          </span>
                          {chapters && (
                            <span className="ml-2 text-[0.64rem] text-gold-300/40">
                              {chronologyBadge(link, chapters)}
                            </span>
                          )}
                        </span>
                        {link.sharedRoots.length > 0 ? (
                          <span className="mt-0.5 block truncate text-[0.68rem] text-gold-300/60">
                            shares{" "}
                            {link.sharedRoots
                              .slice(0, 3)
                              .map((root) => gloss(root) ?? root)
                              .join(" · ")}
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-[0.68rem] text-gold-300/35">
                            thematic proximity only
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[0.62rem] tabular-nums text-gold-300/40">
                        {(link.similarity * 100).toFixed(0)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Meccan/Medinan and juzʾ, so a thread that crosses either is visible rather
 * than implied. Both are real, already-sourced fields — `revelationPlace`
 * from the chapter catalogue, juzʾ from the printed edition's own juzʾ-start
 * pages — not a new inference.
 */
function chronologyBadge(link: Constellation, chapters: Map<number, Surah>): string {
  const surahId = Number(link.verseKey.split(":")[0]);
  const place = chapters.get(surahId)?.revelationPlace;
  const juz = juzForPage(link.page);
  const placeLabel = place === "makkah" ? "Makkah" : place === "madinah" ? "Madīnah" : null;
  return placeLabel ? `· ${placeLabel} · juzʾ ${juz}` : `· juzʾ ${juz}`;
}

/** Place links on a ring, nearest verses closest to the centre. */
function layout(links: Constellation[]) {
  return links.map((link, index) => {
    const angle = (index / Math.max(links.length, 1)) * Math.PI * 2 - Math.PI / 2;
    // Similarity pulls a node inward, so the ring reads as distance.
    const radius = 96 - Math.max(0, Math.min(1, link.similarity)) * 36;
    return {
      link,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}
