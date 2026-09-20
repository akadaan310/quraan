"use client";

import { MetaPanel } from "./MetaPanel";
import type { ConceptGroup } from "@/lib/deep/types";

/**
 * The concept lens picker. A curated table (see scripts/lib/concepts.mjs),
 * not a model's own categories — each row is a real root-group and the exact
 * number of verses that carry it, so what the reader sees before opening one
 * is a fact about the text rather than a promise about what they will find.
 */
export function ConceptsPanel({
  open,
  onClose,
  concepts,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  concepts: ConceptGroup[];
  onSelect: (conceptId: string) => void;
}) {
  return (
    <MetaPanel
      open={open}
      title="Concepts"
      subtitle="A curated lens, not a model's own categories"
      onClose={onClose}
    >
      {concepts.length === 0 ? (
        <p className="py-10 text-center text-sm leading-relaxed text-gold-300/45">
          Loading the concept table…
        </p>
      ) : (
        <ul className="space-y-1">
          {concepts.map((concept) => (
            <li key={concept.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(concept.id);
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-gold-400/10"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-ink">{concept.label}</span>
                  <span
                    lang="ar"
                    dir="rtl"
                    className="mt-0.5 block text-[0.72rem] text-gold-300/50"
                    style={{ fontFamily: '"UthmanicHafs", serif' }}
                  >
                    {concept.labelArabic}
                  </span>
                </span>
                <span className="shrink-0 text-[0.64rem] tabular-nums text-gold-300/40">
                  {concept.verseKeys.length} verses
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </MetaPanel>
  );
}
