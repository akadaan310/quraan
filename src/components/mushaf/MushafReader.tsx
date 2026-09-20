"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MushafPageView } from "./MushafPageView";
import { PageChrome } from "./PageChrome";
import { Starfield } from "@/components/celestial/Starfield";
import { AuroraVeil } from "@/components/celestial/AuroraVeil";
import { ContextPill, type PillAction } from "@/components/meta/ContextPill";
import { NavigatorPanel } from "@/components/meta/NavigatorPanel";
import { TranslationPanel } from "@/components/meta/TranslationPanel";
import { BookmarksPanel } from "@/components/meta/BookmarksPanel";
import { SettingsPanel } from "@/components/meta/SettingsPanel";
import { MetaDock } from "@/components/meta/MetaDock";
import {
  BookmarkIcon,
  PauseIcon,
  PlayIcon,
  TranslateIcon,
} from "@/components/meta/icons";
import {
  useGlyphFont,
  usePrefetchAdjacentFonts,
  useSurahNameFont,
} from "@/lib/quran/useGlyphFont";
import { useRecitation } from "@/lib/quran/useRecitation";
import { useMushafMetrics } from "@/lib/utils/useMushafMetrics";
import { useReader } from "@/lib/store/reader";
import { LAST_PAGE } from "@/lib/quran/layout";
import type {
  AyahAudio,
  MushafPage,
  MushafWord,
  Reciter,
  Surah,
  TranslationLine,
} from "@/lib/quran/types";

interface Props {
  page: MushafPage;
  chapters: Surah[];
  juzStarts: { id: number; page: number }[];
  translations: { id: number; name: string; authorName: string }[];
  reciters: Reciter[];
}

export function MushafReader({
  page,
  chapters,
  juzStarts,
  translations,
  reciters,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const store = useReader();
  const [hydrated, setHydrated] = useState(false);

  const chapterMap = useMemo(
    () => new Map(chapters.map((c) => [c.id, c])),
    [chapters],
  );

  const fontState = useGlyphFont(page.pageNumber);
  const surahFontReady = useSurahNameFont();
  usePrefetchAdjacentFonts(page.pageNumber);

  useMushafMetrics({
    frameRef,
    cardRef,
    contentRef,
    scale: store.glyphScale,
    lineCount: page.lines.length,
  });

  /**
   * The store rehydrates from localStorage after the first paint. Until it
   * has, render the server's preferences so the markup matches and the
   * reader does not flash a different text size.
   */
  useEffect(() => setHydrated(true), []);

  /* ---------------- Page-level meta data, fetched on demand -------------- */
  const [translationLines, setTranslationLines] = useState<TranslationLine[]>([]);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [audio, setAudio] = useState<AyahAudio[]>([]);

  useEffect(() => {
    if (store.panel !== "translation") return;
    let active = true;
    setTranslationLoading(true);
    fetch(`/api/translation/${page.pageNumber}?id=${store.translationId}`)
      .then((r) => (r.ok ? r.json() : { lines: [] }))
      .then((body) => active && setTranslationLines(body.lines ?? []))
      .catch(() => active && setTranslationLines([]))
      .finally(() => active && setTranslationLoading(false));
    return () => {
      active = false;
    };
  }, [page.pageNumber, store.panel, store.translationId]);

  useEffect(() => {
    let active = true;
    setAudio([]);
    fetch(`/api/audio/${page.pageNumber}?reciter=${store.reciterId}`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((body) => active && setAudio(body.files ?? []))
      .catch(() => active && setAudio([]));
    return () => {
      active = false;
    };
  }, [page.pageNumber, store.reciterId]);

  const recitation = useRecitation(audio);

  /* ---------------- Navigation ------------------------------------------ */
  const turn = useCallback(
    (delta: 1 | -1) => {
      recitation.stop();
      store.goToPage(page.pageNumber + delta);
    },
    [page.pageNumber, recitation, store],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;

      // The Muṣḥaf reads right to left, so the right arrow moves backwards.
      if (event.key === "ArrowLeft" || event.key === "PageDown") turn(1);
      else if (event.key === "ArrowRight" || event.key === "PageUp") turn(-1);
      else if (event.key === "Escape") store.setAnchor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, turn]);

  /* ---------------- Word interaction ------------------------------------ */
  const onWordActivate = useCallback(
    (word: MushafWord, element: HTMLElement) => {
      if (word.charType === "end") return;
      const box = element.getBoundingClientRect();
      store.setAnchor({
        verseKey: word.verseKey,
        wordId: word.id,
        x: box.left + box.width / 2,
        y: box.bottom,
      });
    },
    [store],
  );

  const anchorVerse = store.anchor?.verseKey ?? null;
  const bookmarked = anchorVerse ? store.isBookmarked(anchorVerse) : false;

  const pillActions: PillAction[] = useMemo(() => {
    if (!anchorVerse) return [];
    const isThisVerse = recitation.verseKey === anchorVerse;
    return [
      {
        id: "play",
        label: isThisVerse && recitation.isPlaying ? "Pause" : "Recite",
        icon: isThisVerse && recitation.isPlaying ? <PauseIcon /> : <PlayIcon />,
        active: isThisVerse,
        onSelect: () => recitation.toggle(anchorVerse),
      },
      {
        id: "translate",
        label: "Translation",
        icon: <TranslateIcon />,
        onSelect: () => store.openPanel("translation"),
      },
      {
        id: "bookmark",
        label: bookmarked ? "Remove bookmark" : "Bookmark",
        icon: <BookmarkIcon filled={bookmarked} />,
        active: bookmarked,
        onSelect: () => {
          const surahId = Number(anchorVerse.split(":")[0]);
          store.toggleBookmark({
            verseKey: anchorVerse,
            page: page.pageNumber,
            label: `${chapterMap.get(surahId)?.nameSimple ?? "Sūrah"} ${anchorVerse.split(":")[1]}`,
            createdAt: Date.now(),
          });
          store.setAnchor(null);
        },
      },
    ];
  }, [anchorVerse, bookmarked, chapterMap, page.pageNumber, recitation, store]);

  /**
   * Reading pace nudges the warmth of the halo: a reader who lingers gets a
   * slightly deeper glow, one moving quickly gets a cooler, crisper page.
   */
  useEffect(() => {
    const started = performance.now();
    return () => {
      const dwellSeconds = (performance.now() - started) / 1000;
      const warmth = Math.min(1, Math.max(0.35, dwellSeconds / 90));
      document.documentElement.style.setProperty(
        "--halo-warmth",
        warmth.toFixed(2),
      );
    };
  }, [page.pageNumber]);

  const ambience = hydrated ? store.ambience : true;
  const scale = hydrated ? store.glyphScale : 1;

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden">
      <AuroraVeil enabled={ambience} />
      <Starfield enabled={ambience} />

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-[3.5vw] py-[2.5vh] sm:px-[6vw]">
        {/* The frame is the space the page may occupy; the page sizes itself
            to the printed proportion inside it. */}
        <div ref={frameRef} className="relative flex h-full w-full justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={page.pageNumber}
              className="absolute inset-y-0"
              // Only opacity and transform move — both run on the compositor,
              // so a page turn cannot be stalled by the font or data work
              // happening on the main thread at the same moment.
              initial={{
                opacity: 0,
                // A right-to-left book: the next page arrives from the left.
                x: store.direction === 1 ? -18 : 18,
                scale: 1.012,
              }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{
                opacity: 0,
                x: store.direction === 1 ? 18 : -18,
                scale: 0.988,
              }}
              transition={{ duration: 0.46, ease: [0.32, 0.72, 0, 1] }}
              style={{
                contain: "layout paint style",
                width: "var(--page-width, 100%)",
                maxWidth: "100%",
              }}
            >
              <div ref={cardRef} className="h-full w-full">
                <PageChrome
                  page={page}
                  chapters={chapterMap}
                  contentRef={contentRef}
                >
                  <MushafPageView
                    page={page}
                    chapters={chapterMap}
                    fontReady={fontState === "loaded"}
                    surahFontReady={surahFontReady}
                    unicodeMode={hydrated ? store.unicodeMode : false}
                    activeVerseKey={anchorVerse}
                    playingVerseKey={recitation.verseKey}
                    playingWordPosition={recitation.position}
                    onWordActivate={onWordActivate}
                  />
                </PageChrome>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <MetaDock
        page={page.pageNumber}
        lastPage={LAST_PAGE}
        onTurn={turn}
        onJump={(n) => store.goToPage(n)}
        activePanel={store.panel}
        onPanel={(panel) => store.togglePanel(panel)}
        playing={recitation.isPlaying}
        onPlayPage={() => {
          if (recitation.isPlaying) recitation.pause();
          else if (recitation.verseKey) recitation.resume();
          else if (page.verses[0]) recitation.play(page.verses[0].verseKey);
        }}
        canPlay={audio.length > 0}
      />

      <ContextPill
        anchor={store.anchor}
        actions={pillActions}
        caption={anchorVerse ?? ""}
        onDismiss={() => store.setAnchor(null)}
      />

      <NavigatorPanel
        open={store.panel === "navigator"}
        onClose={() => store.openPanel(null)}
        chapters={chapters}
        juzStarts={juzStarts}
        currentPage={page.pageNumber}
        onNavigate={(n) => store.goToPage(n)}
      />

      <TranslationPanel
        open={store.panel === "translation"}
        onClose={() => store.openPanel(null)}
        lines={translationLines}
        loading={translationLoading}
        resourceName={translationLines[0]?.resourceName ?? ""}
        activeVerseKey={anchorVerse ?? recitation.verseKey}
        onSelectVerse={(verseKey) => recitation.toggle(verseKey)}
      />

      <BookmarksPanel
        open={store.panel === "bookmarks"}
        onClose={() => store.openPanel(null)}
        bookmarks={hydrated ? store.bookmarks : []}
        onNavigate={(target) => store.goToPage(target)}
        onRemove={(verseKey) =>
          store.toggleBookmark({
            verseKey,
            page: page.pageNumber,
            label: "",
            createdAt: 0,
          })
        }
      />

      <SettingsPanel
        open={store.panel === "settings"}
        onClose={() => store.openPanel(null)}
        translations={translations}
        reciters={reciters}
        translationId={store.translationId}
        reciterId={store.reciterId}
        glyphScale={scale}
        ambience={ambience}
        unicodeMode={store.unicodeMode}
        onChange={{
          translationId: (v) => store.setPreference("translationId", v),
          reciterId: (v) => store.setPreference("reciterId", v),
          glyphScale: (v) => store.setPreference("glyphScale", v),
          ambience: (v) => store.setPreference("ambience", v),
          unicodeMode: (v) => store.setPreference("unicodeMode", v),
        }}
      />
    </div>
  );
}
