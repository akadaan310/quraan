"use client";

import { AnimatePresence, motion } from "motion/react";
import type { SurahSymmetry } from "@/lib/deep/types";

/**
 * The symmetry lens.
 *
 * Ring composition — an opening answered by its close, folding inward to a
 * pivot — is a real and much-argued feature of sūrah structure, but it is a
 * *reading*, and there is no authoritative machine-readable dataset of it.
 * So this shows a measurement and labels it as one: how much vocabulary each
 * mirrored pair shares, against the baseline of how much any two verses in
 * that sūrah share. Where the lift is small the panel says so plainly rather
 * than drawing a diagram that implies more than the numbers support.
 */

const STRENGTH_COPY: Record<SurahSymmetry["strength"], { label: string; note: string }> = {
  strong: {
    label: "Strong mirror signal",
    note: "Mirrored pairs share markedly more vocabulary than other pairs here.",
  },
  moderate: {
    label: "Moderate mirror signal",
    note: "Mirrored pairs share somewhat more vocabulary than other pairs here.",
  },
  weak: {
    label: "Weak mirror signal",
    note: "Only slightly above what any two verses in this sūrah share.",
  },
  none: {
    label: "No measurable mirror",
    note: "Mirrored pairs share no more vocabulary than any other pair here.",
  },
};

export function SymmetryLens({
  open,
  surahName,
  surahId,
  symmetry,
  onOpenVerse,
  onClose,
  onOpenAtlas,
  verseToPage,
}: {
  open: boolean;
  surahName: string;
  surahId: number;
  symmetry: SurahSymmetry | null;
  onOpenVerse: (page: number, verseKey: string) => void;
  onClose: () => void;
  onOpenAtlas: () => void;
  verseToPage: (verseKey: string) => number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-no-swipe
          role="dialog"
          aria-label={`Structure of ${surahName}`}
          className="fixed inset-0 z-50 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ background: "rgb(5 6 12 / 0.88)", backdropFilter: "blur(14px)" }}
        >
          <header
            className="flex items-start justify-between gap-3 px-5 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
          >
            <div className="min-w-0">
              <p className="text-[0.6rem] tracking-[0.2em] text-gold-300/55 uppercase">
                Symmetry lens
              </p>
              <h2 className="truncate text-sm text-gold-100">
                {surahName} · sūrah {surahId}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onOpenAtlas}
                className="rounded-lg px-2 py-1.5 text-[0.62rem] tracking-[0.1em] text-gold-300/55 uppercase transition-colors hover:bg-gold-400/12 hover:text-gold-100"
              >
                Zoom out
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close symmetry lens"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-gold-200/65 hover:bg-gold-400/12 hover:text-gold-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </header>

          {!symmetry ? (
            <p className="px-6 py-12 text-center text-sm text-gold-300/45">
              This sūrah is too short to measure a fold against.
            </p>
          ) : (
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
              {symmetry.muqattaat && (
                <div className="glass mb-3 px-4 py-3">
                  <p className="text-[0.6rem] tracking-[0.18em] text-gold-300/55 uppercase">
                    Opens with disconnected letters
                  </p>
                  <p
                    lang="ar"
                    dir="rtl"
                    className="mt-1 text-2xl tracking-[0.2em] text-gold-100"
                    style={{ fontFamily: '"UthmanicHafs", serif' }}
                  >
                    {symmetry.muqattaat}
                  </p>
                  <p className="mt-1 text-[0.68rem] leading-snug text-gold-300/50">
                    The muqaṭṭaʿāt carry no root, so they sit outside every
                    measurement on this screen.
                  </p>
                </div>
              )}

              <div className="glass mb-3 px-4 py-3">
                <p className="text-sm text-gold-100">
                  {STRENGTH_COPY[symmetry.strength].label}
                </p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-gold-300/55">
                  {STRENGTH_COPY[symmetry.strength].note}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Mirror" value={symmetry.mirrorMean.toFixed(3)} />
                  <Stat label="Baseline" value={symmetry.baseline.toFixed(3)} />
                  <Stat label="Lift" value={`${symmetry.lift.toFixed(2)}×`} />
                </dl>
              </div>

              <Fold symmetry={symmetry} onOpenVerse={onOpenVerse} verseToPage={verseToPage} />

              <p className="mt-4 px-1 text-[0.66rem] leading-relaxed text-gold-300/40">
                Measured as shared triliteral roots between the nth verse from
                the start and the nth from the end. It is a vocabulary
                measurement, not a reading of the sūrah&apos;s structure.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gold-400/12 py-2">
      <dt className="text-[0.56rem] tracking-[0.12em] text-gold-300/40 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/**
 * The fold itself: each mirrored pair as a rung, strongest first, with the
 * pivot the sūrah closes on at the bottom.
 */
function Fold({
  symmetry,
  onOpenVerse,
  verseToPage,
}: {
  symmetry: SurahSymmetry;
  onOpenVerse: (page: number, verseKey: string) => void;
  verseToPage: (verseKey: string) => number;
}) {
  const rungs = symmetry.notable.length > 0 ? symmetry.notable : symmetry.pairs.slice(0, 5);

  return (
    <ol className="space-y-1.5">
      {rungs.map((pair) => (
        <li key={`${pair.opening}-${pair.closing}`} className="glass px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-center text-[0.62rem] text-gold-300/40">
              {ringLabel(pair.depth)}
            </span>
            <VerseChip
              verseKey={pair.opening}
              onOpen={() => onOpenVerse(verseToPage(pair.opening), pair.opening)}
            />
            <span
              aria-hidden="true"
              className="h-px flex-1"
              style={{
                background: `linear-gradient(90deg, transparent, rgb(232 201 119 / ${
                  0.2 + pair.score * 0.6
                }), transparent)`,
              }}
            />
            <span className="shrink-0 text-[0.6rem] tabular-nums text-gold-300/45">
              {(pair.score * 100).toFixed(0)}
            </span>
            <span
              aria-hidden="true"
              className="h-px flex-1"
              style={{
                background: `linear-gradient(90deg, transparent, rgb(232 201 119 / ${
                  0.2 + pair.score * 0.6
                }), transparent)`,
              }}
            />
            <VerseChip
              verseKey={pair.closing}
              onOpen={() => onOpenVerse(verseToPage(pair.closing), pair.closing)}
            />
            <span className="w-6 shrink-0 text-[0.62rem] text-gold-300/40">
              {ringLabel(pair.depth)}′
            </span>
          </div>
          {pair.shared.length > 0 && (
            <p
              lang="ar"
              dir="rtl"
              className="mt-1.5 text-center text-[0.72rem] text-gold-300/55"
              style={{ fontFamily: '"UthmanicHafs", serif' }}
            >
              {pair.shared.slice(0, 5).join(" · ")}
            </p>
          )}
        </li>
      ))}

      <li className="pt-2 text-center">
        <p className="text-[0.58rem] tracking-[0.16em] text-gold-300/40 uppercase">
          Fold closes on
        </p>
        <button
          type="button"
          onClick={() => onOpenVerse(verseToPage(symmetry.pivot), symmetry.pivot)}
          className="mt-1 text-sm tabular-nums text-gold-100 underline decoration-gold-400/30 underline-offset-4"
        >
          {symmetry.pivot}
        </button>
      </li>
    </ol>
  );
}

/** A↔A′, B↔B′… — the chiastic ring a pair sits on, outermost first. */
function ringLabel(depth: number): string {
  return depth <= 26 ? String.fromCharCode(64 + depth) : String(depth);
}

function VerseChip({ verseKey, onOpen }: { verseKey: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 rounded-md bg-gold-400/10 px-2 py-1 text-[0.66rem] tabular-nums text-gold-100 transition-colors hover:bg-gold-400/20"
    >
      {verseKey}
    </button>
  );
}
