"use client";

import { MetaPanel } from "./MetaPanel";
import type { TranslationLine } from "@/lib/quran/types";

export function TranslationPanel({
  open,
  onClose,
  lines,
  loading,
  resourceName,
  activeVerseKey,
  onSelectVerse,
}: {
  open: boolean;
  onClose: () => void;
  lines: TranslationLine[];
  loading: boolean;
  resourceName: string;
  activeVerseKey: string | null;
  onSelectVerse: (verseKey: string) => void;
}) {
  return (
    <MetaPanel
      open={open}
      title="Translation"
      subtitle={resourceName || undefined}
      onClose={onClose}
    >
      {loading && (
        <p className="py-8 text-center text-sm text-gold-300/45">
          Gathering the meaning…
        </p>
      )}

      {!loading && lines.length === 0 && (
        <p className="py-8 text-center text-sm text-gold-300/45">
          No translation available for this page.
        </p>
      )}

      <ol className="space-y-4">
        {lines.map((line) => {
          const isActive = line.verseKey === activeVerseKey;
          return (
            <li key={line.verseKey}>
              <button
                type="button"
                onClick={() => onSelectVerse(line.verseKey)}
                className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
                  isActive ? "bg-gold-400/12" : "hover:bg-gold-400/7"
                }`}
              >
                <span className="mb-1 block text-[0.64rem] tabular-nums tracking-[0.16em] text-gold-300/60">
                  {line.verseKey}
                </span>
                <span className="block text-[0.86rem] leading-relaxed text-ink/85">
                  {line.text}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </MetaPanel>
  );
}
