"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clampPage } from "@/lib/quran/layout";

/** Which floating meta-surface is currently summoned, if any. */
export type PanelId =
  | "navigator"
  | "translation"
  | "bookmarks"
  | "settings"
  | null;

export interface Bookmark {
  verseKey: string;
  page: number;
  label: string;
  createdAt: number;
}

/** Where the context pill should appear, in viewport coordinates. */
export interface ContextAnchor {
  verseKey: string;
  wordId: number | null;
  x: number;
  y: number;
}

interface ReaderState {
  /* --- Reading position --------------------------------------------- */
  page: number;
  /** +1 when moving toward the end of the Muṣḥaf, -1 back toward al-Fātiḥah. */
  direction: 1 | -1;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;

  /* --- Transient interaction ---------------------------------------- */
  anchor: ContextAnchor | null;
  setAnchor: (anchor: ContextAnchor | null) => void;
  panel: PanelId;
  openPanel: (panel: PanelId) => void;
  togglePanel: (panel: NonNullable<PanelId>) => void;

  /* --- Recitation ---------------------------------------------------- */
  isPlaying: boolean;
  playingVerseKey: string | null;
  playingWordPosition: number | null;
  setPlayback: (
    next: Partial<
      Pick<
        ReaderState,
        "isPlaying" | "playingVerseKey" | "playingWordPosition"
      >
    >,
  ) => void;

  /* --- Persisted preferences ----------------------------------------- */
  translationId: number;
  reciterId: number;
  /** Multiplier on the computed glyph size, 0.85–1.3. */
  glyphScale: number;
  ambience: boolean;
  showTranslation: boolean;
  unicodeMode: boolean;
  setPreference: <K extends keyof ReaderPreferences>(
    key: K,
    value: ReaderPreferences[K],
  ) => void;

  /* --- Bookmarks ------------------------------------------------------ */
  bookmarks: Bookmark[];
  toggleBookmark: (bookmark: Bookmark) => void;
  isBookmarked: (verseKey: string) => boolean;
}

type ReaderPreferences = Pick<
  ReaderState,
  | "translationId"
  | "reciterId"
  | "glyphScale"
  | "ambience"
  | "showTranslation"
  | "unicodeMode"
>;

/** Saheeh International — the most widely recognised English rendering. */
const DEFAULT_TRANSLATION = 20;
/** Mishari Rashid al-ʿAfasy. */
const DEFAULT_RECITER = 7;

export const useReader = create<ReaderState>()(
  persist(
    (set, get) => ({
      page: 1,
      direction: 1,

      goToPage: (page) => {
        const next = clampPage(page);
        const current = get().page;
        if (next === current) return;
        set({
          page: next,
          direction: next > current ? 1 : -1,
          anchor: null,
        });
      },

      nextPage: () => get().goToPage(get().page + 1),
      previousPage: () => get().goToPage(get().page - 1),

      anchor: null,
      setAnchor: (anchor) => set({ anchor }),

      panel: null,
      openPanel: (panel) => set({ panel, anchor: null }),
      togglePanel: (panel) =>
        set((s) => ({ panel: s.panel === panel ? null : panel, anchor: null })),

      isPlaying: false,
      playingVerseKey: null,
      playingWordPosition: null,
      setPlayback: (next) => set(next),

      translationId: DEFAULT_TRANSLATION,
      reciterId: DEFAULT_RECITER,
      glyphScale: 1,
      ambience: true,
      showTranslation: false,
      unicodeMode: false,
      setPreference: (key, value) => set({ [key]: value } as never),

      bookmarks: [],

      toggleBookmark: (bookmark) =>
        set((s) => {
          const exists = s.bookmarks.some(
            (b) => b.verseKey === bookmark.verseKey,
          );
          return {
            bookmarks: exists
              ? s.bookmarks.filter((b) => b.verseKey !== bookmark.verseKey)
              : [bookmark, ...s.bookmarks].slice(0, 200),
          };
        }),

      isBookmarked: (verseKey) =>
        get().bookmarks.some((b) => b.verseKey === verseKey),
    }),
    {
      name: "celestial-mushaf",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Transient UI state (open panels, playback, anchors) must never be
      // restored — only where the reader was and how they like to read.
      partialize: (s) => ({
        page: s.page,
        translationId: s.translationId,
        reciterId: s.reciterId,
        glyphScale: s.glyphScale,
        ambience: s.ambience,
        showTranslation: s.showTranslation,
        unicodeMode: s.unicodeMode,
        bookmarks: s.bookmarks,
      }),
    },
  ),
);
