"use client";

import { useEffect, useRef, useState } from "react";
import { MushafReader } from "@/components/mushaf/MushafReader";
import { useReader } from "@/lib/store/reader";
import { LAST_PAGE } from "@/lib/quran/layout";
import type { MushafPage, Reciter, Surah } from "@/lib/quran/types";

interface Props {
  chapters: Surah[];
  juzStarts: { id: number; page: number }[];
  translations: { id: number; name: string; authorName: string }[];
  reciters: Reciter[];
}

/**
 * Owns page loading.
 *
 * Two rules keep the turn feeling weightless:
 *
 *  - The previous page stays mounted until the next one has arrived, so a slow
 *    network shows the page you were reading rather than a blank frame.
 *  - The page either side of the current one is fetched during idle time, so
 *    the common case — turning forward — has nothing to wait for.
 */
export function ReaderShell({
  chapters,
  juzStarts,
  translations,
  reciters,
}: Props) {
  const page = useReader((s) => s.page);
  const [current, setCurrent] = useState<MushafPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<number, MushafPage>());

  useEffect(() => {
    let active = true;

    const cached = cache.current.get(page);
    if (cached) {
      setCurrent(cached);
      setError(null);
    }

    void (async () => {
      try {
        const data = cached ?? (await loadPage(page, cache.current));
        if (!active) return;
        setCurrent(data);
        setError(null);
      } catch {
        if (active && !cached) {
          setError(`Page ${page} could not be loaded. Check your connection.`);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [page]);

  /** Warm the neighbours once the current page is on screen. */
  useEffect(() => {
    if (!current) return;
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 600));

    const handle = idle(() => {
      for (const neighbour of [page + 1, page - 1]) {
        if (
          neighbour >= 1 &&
          neighbour <= LAST_PAGE &&
          !cache.current.has(neighbour)
        ) {
          void loadPage(neighbour, cache.current).catch(() => {});
        }
      }
    });

    return () => {
      if (window.cancelIdleCallback && typeof handle === "number") {
        window.cancelIdleCallback(handle);
      }
    };
  }, [current, page]);

  if (error && !current) {
    return (
      <div className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-sm text-gold-200/80">{error}</p>
          <button
            type="button"
            onClick={() => useReader.getState().goToPage(page)}
            className="mt-4 rounded-lg border border-gold-400/30 px-4 py-2 text-sm text-gold-100 transition-colors hover:bg-gold-400/12"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!current) return <OpeningVeil />;

  return (
    <MushafReader
      page={current}
      chapters={chapters}
      juzStarts={juzStarts}
      translations={translations}
      reciters={reciters}
    />
  );
}

async function loadPage(page: number, cache: Map<number, MushafPage>) {
  const response = await fetch(`/api/page/${page}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as MushafPage;
  cache.set(page, data);
  // Hold a generous window; a page is a few tens of kilobytes.
  if (cache.size > 24) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return data;
}

/** The quiet the reader arrives into, rather than a spinner. */
function OpeningVeil() {
  return (
    <div className="grid h-dvh place-items-center">
      <div
        className="size-24 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgb(212 172 78 / 0.22) 0%, transparent 68%)",
          animation: "veil-pulse 2.6s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes veil-pulse{0%,100%{opacity:.35;transform:scale(.9)}50%{opacity:1;transform:scale(1.08)}}`}</style>
    </div>
  );
}
