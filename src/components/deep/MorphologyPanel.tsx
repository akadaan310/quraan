"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { describeAgreement, VERB_FORM_NUMERALS } from "@/lib/deep/unpack";
import { waznFor } from "@/lib/deep/wazn";
import { conjugate, isSoundRoot } from "@/lib/deep/conjugate";
import type { Segment, WordMorphology } from "@/lib/deep/types";

/**
 * The grammar of one word.
 *
 * A note on what is and is not drawn on the script itself. In glyph mode each
 * word is a *single* glyph — that is the whole mechanism that makes the page
 * page-faithful — so there is no sub-word geometry to anchor an arc to. The
 * segment arcs are therefore drawn here, over text this component lays out
 * and can measure, while the page itself carries only what can honestly be
 * positioned: a case ribbon under each whole word.
 *
 * The corpus behind this is morphological, not syntactic: it gives root,
 * lemma, pattern, case and agreement, and does not give head-dependent links.
 * So roles are named from the case ending — the same inference a student
 * makes reading I‘rāb — and the panel says that rather than implying a parse.
 */

const CASE_ROLE: Record<string, { role: string; hint: string; tone: string }> = {
  nominative: {
    role: "Nominative · مرفوع",
    hint: "typically the subject, or the predicate of a nominal sentence",
    tone: "#8fd0c4",
  },
  accusative: {
    role: "Accusative · منصوب",
    hint: "typically the object, or an adverbial complement",
    tone: "#e8b06a",
  },
  genitive: {
    role: "Genitive · مجرور",
    hint: "after a preposition, or the second term of a construct",
    tone: "#b49ae0",
  },
};

/**
 * What each particle's presence does to a clause's logic — the honest scope
 * of rhetorical (balāghah) marking this panel offers: the corpus tags these
 * roles explicitly, so naming their force is a fact about the tagging, not a
 * detected figure of speech. Word-order inversion, ellipsis and the rest of
 * classical balāghah are not claimed here.
 */
const PARTICLE_FORCE: Record<string, { label: string; force: string }> = {
  negation: { label: "Negation", force: "denies the clause that follows" },
  emphasis: { label: "Emphasis", force: "intensifies the assertion that follows" },
  resumptive: {
    label: "Resumptive",
    force: "opens a new clause, not grammatically bound to what precedes",
  },
  relative: { label: "Relative", force: "introduces a clause describing what precedes" },
  conjunction: { label: "Conjunction", force: "joins this to what precedes, level in force" },
};

export function MorphologyPanel({
  word,
  verseKey,
  gloss,
  /** Recency-weighted root lookup counts from the reader's own ledger. */
  familiarity,
  onExploreRoot,
  onDismiss,
}: {
  word: WordMorphology | null;
  verseKey: string;
  gloss: (root: string) => string | undefined;
  familiarity?: Map<string, number>;
  onExploreRoot: (root: string) => void;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {word && (
        <motion.div
          data-no-swipe
          role="dialog"
          aria-label="Word grammar"
          className="glass fixed inset-x-3 bottom-3 z-50 max-h-[62dvh] overflow-hidden sm:inset-x-auto sm:right-3 sm:w-[23rem]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5">
            <div className="min-w-0">
              <p className="text-[0.6rem] tracking-[0.2em] text-gold-300/55 uppercase">
                Morphology · {verseKey}
              </p>
              <p
                lang="ar"
                dir="rtl"
                className="mt-0.5 truncate text-xl text-ink"
                style={{ fontFamily: '"UthmanicHafs", serif' }}
              >
                {word.segments.map((s) => s.text).join("")}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close grammar"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-gold-200/60 hover:bg-gold-400/12 hover:text-gold-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          <span className="gold-rule mx-4 block h-px opacity-40" />

          <div className="thin-scroll max-h-[44dvh] overflow-y-auto overscroll-contain px-4 py-3">
            <SegmentArcs segments={word.segments} />

            <ul className="mt-3 space-y-2.5">
              {word.segments.map((segment, index) => (
                <li key={index}>
                  <SegmentRow
                    segment={segment}
                    gloss={segment.root ? gloss(segment.root) : undefined}
                    familiarity={segment.root ? familiarity?.get(segment.root) : undefined}
                    onExploreRoot={onExploreRoot}
                  />
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The word's internal shape: prefixes and suffixes bracketed onto the stem.
 * Arabic fuses these into one orthographic word, and seeing them separated is
 * most of what makes a form legible to a learner.
 */
function SegmentArcs({ segments }: { segments: Segment[] }) {
  const stemIndex = Math.max(
    0,
    segments.findIndex((s) => s.root),
  );

  return (
    <div dir="rtl" className="relative">
      <div className="flex items-end justify-center gap-1.5 pb-5">
        {segments.map((segment, index) => {
          const isStem = index === stemIndex;
          return (
            <span
              key={index}
              className="relative rounded-md px-1.5 py-1 text-center"
              style={{
                background: isStem ? "rgb(212 172 78 / 0.16)" : "rgb(37 45 74 / 0.5)",
                boxShadow: isStem ? "0 0 0 1px rgb(212 172 78 / 0.3)" : undefined,
              }}
            >
              <span
                lang="ar"
                className="block text-base text-ink"
                style={{ fontFamily: '"UthmanicHafs", serif' }}
              >
                {segment.text}
              </span>
              <span className="mt-0.5 block text-[0.54rem] tracking-[0.12em] text-gold-300/60 uppercase">
                {isStem ? "stem" : (segment.tags[0] ?? segment.pos)}
              </span>
            </span>
          );
        })}
      </div>

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-5 w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 20"
      >
        <path
          d="M6 2 Q 50 20 94 2"
          fill="none"
          stroke="rgb(212 172 78 / 0.38)"
          strokeWidth="0.6"
        />
      </svg>
    </div>
  );
}

function SegmentRow({
  segment,
  gloss,
  familiarity,
  onExploreRoot,
}: {
  segment: Segment;
  gloss?: string;
  /** Recency-weighted lookups of this root, from the reader's own ledger. */
  familiarity?: number;
  onExploreRoot: (root: string) => void;
}) {
  const role = segment.grammaticalCase ? CASE_ROLE[segment.grammaticalCase] : null;
  const agreement = describeAgreement(segment.agreement);
  const wazn = waznFor(segment);
  const particleForce = PARTICLE_FORCE[segment.tags[0]] ?? null;
  // Unlooked-up roots (familiarity undefined) get the full pedagogical
  // accent; it fades toward nothing as lookups accumulate.
  const unfamiliar = segment.root ? Math.max(0, 1 - (familiarity ?? 0) / 6) : 0;

  const facts = [
    segment.lemma && { label: "Lemma", value: segment.lemma, arabic: true },
    segment.verbForm && {
      label: "Form",
      value: `${VERB_FORM_NUMERALS[segment.verbForm] ?? segment.verbForm}${
        segment.aspect ? ` · ${segment.aspect}` : ""
      }`,
    },
    !segment.verbForm && segment.aspect && { label: "Aspect", value: segment.aspect },
    segment.mood && { label: "Mood", value: segment.mood },
    agreement && { label: "Agreement", value: agreement },
    wazn && { label: "Measure · وزن", value: `${wazn.template} · ${wazn.translit}`, arabic: true },
    segment.tags.length > 0 && { label: "Tags", value: segment.tags.join(", ") },
  ].filter(Boolean) as { label: string; value: string; arabic?: boolean }[];

  return (
    <div
      className="rounded-lg border px-3 py-2.5 transition-colors"
      style={{
        borderColor:
          unfamiliar > 0.05 ? `rgb(212 172 78 / ${0.12 + unfamiliar * 0.28})` : "rgb(212 172 78 / 0.12)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          lang="ar"
          dir="rtl"
          className="text-lg text-ink"
          style={{ fontFamily: '"UthmanicHafs", serif' }}
        >
          {segment.text}
        </span>
        <span className="text-[0.6rem] tracking-[0.14em] text-gold-300/50 uppercase">
          {segment.pos}
        </span>
      </div>

      {segment.root && (
        <button
          type="button"
          onClick={() => onExploreRoot(segment.root!)}
          className="mt-2 flex w-full items-center justify-between gap-2 rounded-md bg-gold-400/10 px-2.5 py-1.5 text-left transition-colors hover:bg-gold-400/18"
        >
          <span className="min-w-0">
            <span
              lang="ar"
              dir="rtl"
              className="block text-sm tracking-[0.3em] text-gold-100"
              style={{ fontFamily: '"UthmanicHafs", serif' }}
            >
              {[...segment.root].join(" ")}
            </span>
            {gloss && (
              <span className="block truncate text-[0.68rem] text-gold-300/60">
                {gloss}
              </span>
            )}
          </span>
          <span className="shrink-0 text-[0.58rem] tracking-[0.14em] text-gold-300/60 uppercase">
            Trace
          </span>
        </button>
      )}

      {role && (
        <p className="mt-2 text-[0.68rem] leading-snug">
          <span style={{ color: role.tone }}>{role.role}</span>
          <span className="text-gold-300/45"> — {role.hint}</span>
        </p>
      )}

      {particleForce && (
        <p className="mt-2 text-[0.68rem] leading-snug">
          <span className="text-gold-200/85">{particleForce.label}</span>
          <span className="text-gold-300/45"> — {particleForce.force}</span>
        </p>
      )}

      {facts.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-[0.6rem] tracking-[0.1em] text-gold-300/40 uppercase">
                {fact.label}
              </dt>
              <dd
                className="text-[0.72rem] text-ink/80"
                lang={fact.arabic ? "ar" : undefined}
                dir={fact.arabic ? "rtl" : undefined}
                style={fact.arabic ? { fontFamily: '"UthmanicHafs", serif' } : undefined}
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {segment.pos === "verbal" && segment.root && isSoundRoot(segment.root) && (
        <ConjugationDisclosure root={segment.root} form={segment.verbForm ?? 1} />
      )}
    </div>
  );
}

/**
 * The full paradigm is a lot of text for a panel this narrow, so it stays
 * collapsed until asked for — most taps want the one form in front of them,
 * not all thirteen persons of it.
 */
function ConjugationDisclosure({ root, form }: { root: string; form: number }) {
  const [open, setOpen] = useState(false);
  const result = open ? conjugate(root, form) : null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[0.62rem] tracking-[0.12em] text-gold-300/55 uppercase underline decoration-gold-400/25 underline-offset-4 hover:text-gold-200"
      >
        {open ? "Hide full conjugation" : "Show full conjugation"}
      </button>

      {result && result.supported && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <ConjugationColumn title="Perfect · الماضي" forms={result.perfect} />
          <ConjugationColumn title="Imperfect · المضارع" forms={result.imperfect} />
          {result.notes.length > 0 && (
            <p className="col-span-2 text-[0.62rem] leading-relaxed text-gold-300/40">
              {result.notes.join(" ")}
            </p>
          )}
        </div>
      )}
      {result && !result.supported && (
        <p className="mt-2 text-[0.62rem] leading-relaxed text-gold-300/40">
          {result.reason}
        </p>
      )}
    </div>
  );
}

function ConjugationColumn({
  title,
  forms,
}: {
  title: string;
  forms: { person: string; label: string; word: string }[];
}) {
  return (
    <div>
      <p className="text-[0.56rem] tracking-[0.1em] text-gold-300/40 uppercase">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {forms.map((f) => (
          <li key={f.person} className="flex items-baseline justify-between gap-2">
            <span className="text-[0.6rem] text-gold-300/45">{f.label}</span>
            <span
              lang="ar"
              dir="rtl"
              className="text-[0.78rem] text-ink"
              style={{ fontFamily: '"UthmanicHafs", serif' }}
            >
              {f.word}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The colours the case ribbons use on the page itself. */
export const CASE_TONE: Record<string, string> = {
  nominative: "#8fd0c4",
  accusative: "#e8b06a",
  genitive: "#b49ae0",
};
