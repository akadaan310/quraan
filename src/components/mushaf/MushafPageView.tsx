"use client";

import { useMemo } from "react";
import { BismillahLine } from "./BismillahLine";
import { MushafLineView } from "./MushafLineView";
import { SurahBanner } from "./SurahBanner";
import type { MushafPage, MushafWord, Surah } from "@/lib/quran/types";

interface Props {
  page: MushafPage;
  chapters: Map<number, Surah>;
  fontReady: boolean;
  surahFontReady: boolean;
  unicodeMode: boolean;
  activeVerseKey: string | null;
  playingVerseKey: string | null;
  playingWordPosition: number | null;
  onWordActivate: (word: MushafWord, element: HTMLElement) => void;
}

/**
 * One page of the Muṣḥaf.
 *
 * The 15 lines share the height equally, so the grid holds whatever the
 * viewport is — the printed page's proportions are preserved rather than the
 * text being allowed to reflow. The opening spread (pages 1–2) is the one
 * exception: its lines are set in a smaller framed panel.
 */
export function MushafPageView({
  page,
  chapters,
  fontReady,
  surahFontReady,
  unicodeMode,
  activeVerseKey,
  playingVerseKey,
  playingWordPosition,
  onWordActivate,
}: Props) {
  /**
   * The glyph layer is private-use codepoints and carries no readable text, so
   * a parallel Uthmani transcript is kept in the accessibility tree for screen
   * readers, in-page search and copy.
   */
  const transcript = useMemo(
    () =>
      page.verses
        .map((v) => `${v.textUthmani} ۝${v.ayahNumber}`)
        .join(" "),
    [page.verses],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <h2 className="sr-only-text">
        Page {page.pageNumber}, Juz {page.juz}
      </h2>

      <div
        aria-hidden="true"
        dir="rtl"
        lang="ar"
        className="grid h-full w-full select-none"
        style={{
          gridTemplateRows: `repeat(${page.lines.length}, minmax(0, 1fr))`,
        }}
      >
        {page.lines.map((line) => {
          const key = `${page.pageNumber}-${line.lineNumber}`;

          if (line.kind === "surah-header") {
            return (
              <div key={key} className="flex items-center justify-center">
                <SurahBanner
                  surahId={line.surahId ?? 1}
                  name={chapters.get(line.surahId ?? 1)?.nameArabic ?? ""}
                  fontReady={surahFontReady}
                />
              </div>
            );
          }

          if (line.kind === "bismillah") {
            return (
              <div key={key} className="flex items-center justify-center">
                <BismillahLine />
              </div>
            );
          }

          return (
            <div key={key} className="flex items-center">
              <MushafLineView
                line={line}
                page={page.pageNumber}
                fontReady={fontReady}
                unicodeMode={unicodeMode}
                activeVerseKey={activeVerseKey}
                playingVerseKey={playingVerseKey}
                playingWordPosition={playingWordPosition}
                onWordActivate={onWordActivate}
              />
            </div>
          );
        })}
      </div>

      <p className="sr-only-text" lang="ar" dir="rtl">
        {transcript}
      </p>
    </div>
  );
}
