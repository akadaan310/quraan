"use client";

import { useEffect, useState } from "react";
import { unpackPage, type PackedPage } from "./unpack";
import type { PageAcoustics, PageMorphology, SurahSymmetry } from "./types";

/**
 * The deep-layer data for one printed page.
 *
 * Morphology is chunked per page, so turning a page fetches about 8 KB. The
 * phonetic and symmetry tables are small enough to load once for the whole
 * Muṣḥaf and keep; both are consulted constantly once a reader starts moving.
 */

const morphologyCache = new Map<number, PageMorphology>();
const rootsCache = new Map<number, Record<string, number[]>>();
let acousticsPromise: Promise<AcousticsFile> | null = null;
let symmetryPromise: Promise<Record<string, SurahSymmetry>> | null = null;

interface AcousticsFile {
  pages: Record<string, PageAcoustics>;
  verses: Record<string, { rhyme: string; madd: number; ghunnah: number }>;
}

function loadAcoustics() {
  acousticsPromise ??= fetch("/data/phonetics.json").then(
    (r) => r.json() as Promise<AcousticsFile>,
  );
  return acousticsPromise;
}

function loadSymmetry() {
  symmetryPromise ??= fetch("/data/symmetry.json").then(
    (r) => r.json() as Promise<Record<string, SurahSymmetry>>,
  );
  return symmetryPromise;
}

async function loadMorphology(page: number): Promise<PageMorphology> {
  const cached = morphologyCache.get(page);
  if (cached) return cached;

  const response = await fetch(`/data/morphology/p${page}.json`);
  if (!response.ok) throw new Error(`morphology ${page}: HTTP ${response.status}`);
  const unpacked = unpackPage((await response.json()) as PackedPage);
  morphologyCache.set(page, unpacked);
  // A reader moves through the Muṣḥaf; holding a wide window costs little.
  if (morphologyCache.size > 20) {
    const oldest = morphologyCache.keys().next().value;
    if (oldest !== undefined) morphologyCache.delete(oldest);
  }
  return unpacked;
}

async function loadVerseRoots(page: number): Promise<Record<string, number[]>> {
  const cached = rootsCache.get(page);
  if (cached) return cached;
  const response = await fetch("/data/semantic/verse-roots.json");
  const all = (await response.json()) as Record<string, Record<string, number[]>>;
  for (const [key, value] of Object.entries(all)) rootsCache.set(Number(key), value);
  return rootsCache.get(page) ?? {};
}

export interface PageLayers {
  morphology: PageMorphology | null;
  acoustics: PageAcoustics | null;
  verseRoots: Record<string, number[]>;
  symmetry: Record<string, SurahSymmetry>;
  ready: boolean;
}

export function usePageLayers(page: number, enabled: boolean): PageLayers {
  const [layers, setLayers] = useState<PageLayers>({
    morphology: null,
    acoustics: null,
    verseRoots: {},
    symmetry: {},
    ready: false,
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    void (async () => {
      try {
        const [morphology, acoustics, verseRoots, symmetry] = await Promise.all([
          loadMorphology(page),
          loadAcoustics(),
          loadVerseRoots(page),
          loadSymmetry(),
        ]);
        if (!active) return;
        setLayers({
          morphology,
          acoustics: acoustics.pages[String(page)] ?? null,
          verseRoots,
          symmetry,
          ready: true,
        });
      } catch {
        // The deep layers are additive. If they fail, the Muṣḥaf still reads.
        if (active) setLayers((l) => ({ ...l, ready: false }));
      }
    })();

    return () => {
      active = false;
    };
  }, [page, enabled]);

  return layers;
}

/** Warm the next page's morphology while the reader is still on this one. */
export function prefetchLayers(page: number) {
  if (page < 1 || page > 604 || morphologyCache.has(page)) return;
  void loadMorphology(page).catch(() => {});
}
