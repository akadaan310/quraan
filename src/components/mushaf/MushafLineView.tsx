"use client";

import { memo } from "react";
import type { MushafLine, MushafWord } from "@/lib/quran/types";
import { glyphFontFamily } from "@/lib/quran/fonts";

interface Props {
  line: MushafLine;
  page: number;
  fontReady: boolean;
  unicodeMode: boolean;
  activeVerseKey: string | null;
  playingVerseKey: string | null;
  playingWordPosition: number | null;
  onWordActivate: (word: MushafWord, element: HTMLElement) => void;
}

/**
 * One printed line.
 *
 * Justification is done by flexbox rather than `text-align: justify`. The QCF
 * glyphs carry no real spaces to justify against — each word is a single
 * pre-shaped glyph — so the line is a flex row and the browser distributes the
 * slack between the words. That also gives every word its own hit target for
 * free, which the meta layer needs.
 */
function MushafLineViewImpl({
  line,
  page,
  fontReady,
  unicodeMode,
  activeVerseKey,
  playingVerseKey,
  playingWordPosition,
  onWordActivate,
}: Props) {
  const useGlyphs = fontReady && !unicodeMode;

  return (
    <div
      className="mushaf-line"
      data-centered={line.centered || undefined}
      data-line={line.lineNumber}
      style={
        useGlyphs
          ? { fontFamily: `"${glyphFontFamily(page)}"` }
          : {
              fontFamily: '"UthmanicHafs", "Times New Roman", serif',
              // The Unicode fallback needs real shaping, which the glyph
              // fonts deliberately do without.
              fontVariantLigatures: "common-ligatures contextual",
              fontFeatureSettings: '"rlig" 1, "calt" 1, "mark" 1, "mkmk" 1',
              lineHeight: 2,
              gap: line.centered ? undefined : "0.18em",
            }
      }
    >
      {line.words.map((word) => {
        const isPlayingVerse = word.verseKey === playingVerseKey;
        return (
          <span
            key={`${word.verseKey}:${word.position}`}
            className="mushaf-word"
            data-kind={word.charType}
            data-verse={word.verseKey}
            data-position={word.position}
            data-active-verse={
              word.verseKey === activeVerseKey || isPlayingVerse || undefined
            }
            data-active-word={
              (isPlayingVerse && word.position === playingWordPosition) ||
              undefined
            }
            role={word.charType === "end" ? undefined : "button"}
            tabIndex={word.charType === "end" ? undefined : -1}
            onPointerUp={(event) =>
              onWordActivate(word, event.currentTarget as HTMLElement)
            }
          >
            {useGlyphs ? word.code : word.textFallback}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Word arrays are rebuilt on every page fetch, so a reference check would
 * re-render every line on every render. Compare what actually shows.
 */
export const MushafLineView = memo(MushafLineViewImpl, (prev, next) => {
  if (prev.line !== next.line) return false;
  if (
    prev.fontReady !== next.fontReady ||
    prev.unicodeMode !== next.unicodeMode ||
    prev.page !== next.page
  ) {
    return false;
  }

  const verseKeys = new Set(next.line.words.map((w) => w.verseKey));
  const touchesLine = (key: string | null) => key !== null && verseKeys.has(key);

  if (
    touchesLine(prev.activeVerseKey) !== touchesLine(next.activeVerseKey) ||
    prev.activeVerseKey !== next.activeVerseKey
  ) {
    // Only matters if this line holds either the old or the new selection.
    if (touchesLine(prev.activeVerseKey) || touchesLine(next.activeVerseKey)) {
      return false;
    }
  }
  if (
    touchesLine(prev.playingVerseKey) ||
    touchesLine(next.playingVerseKey)
  ) {
    return (
      prev.playingVerseKey === next.playingVerseKey &&
      prev.playingWordPosition === next.playingWordPosition
    );
  }
  return true;
});
