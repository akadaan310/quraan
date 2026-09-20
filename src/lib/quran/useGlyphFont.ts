"use client";

import { useEffect, useState } from "react";
import { glyphFontFamily, glyphFontUrl } from "./fonts";
import { padPage } from "./layout";

/**
 * Load the QCF glyph font for one printed page.
 *
 * The glyph codes are not characters. Every page's font maps the *same* run of
 * codepoints (starting at U+FC41) to a different set of pre-shaped words, so
 * rendering page N's codes in page M's font silently paints a different — and
 * wrong — Qurʾānic text. That is the one failure this module exists to
 * prevent: callers get `false` until the exact font for that page is resolved,
 * and must render the Unicode fallback until then.
 */

type FontState = "pending" | "loaded" | "failed";

/** Shared across every hook instance; fonts are global to the document. */
const registry = new Map<number, Promise<FontState>>();
const resolved = new Map<number, FontState>();

function loadGlyphFont(page: number): Promise<FontState> {
  const cached = registry.get(page);
  if (cached) return cached;

  const family = glyphFontFamily(page);
  // Probe for a locally installed KFGQPC face before reaching for the network.
  const source = `local(${family}), url(${glyphFontUrl(page)}) format("woff2")`;

  const promise = (async (): Promise<FontState> => {
    try {
      const face = new FontFace(family, source);
      // `block`, never `swap`: a swap period would paint the glyph codes
      // through a fallback family, which renders as unrelated Arabic.
      face.display = "block";
      await face.load();
      document.fonts.add(face);
      resolved.set(page, "loaded");
      return "loaded";
    } catch {
      resolved.set(page, "failed");
      // Let a later visit retry; a failure here is usually transient.
      registry.delete(page);
      return "failed";
    }
  })();

  registry.set(page, promise);
  return promise;
}

export function useGlyphFont(page: number): FontState {
  const [state, setState] = useState<FontState>(
    () => resolved.get(page) ?? "pending",
  );

  useEffect(() => {
    let active = true;
    const known = resolved.get(page);
    if (known) {
      setState(known);
      return;
    }
    setState("pending");
    loadGlyphFont(page).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [page]);

  return state;
}

/**
 * Warm the fonts for the pages either side of the one being read, so a turn
 * starts on the same frame as the input rather than waiting on the network.
 */
export function usePrefetchAdjacentFonts(page: number) {
  useEffect(() => {
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 400));

    const handle = idle(() => {
      for (const neighbour of [page + 1, page - 1]) {
        if (neighbour >= 1 && neighbour <= 604) void loadGlyphFont(neighbour);
      }
    });

    return () => {
      if (window.cancelIdleCallback && typeof handle === "number") {
        window.cancelIdleCallback(handle);
      }
    };
  }, [page]);
}

/** The ligature font that renders sūrah titles; one file for all 114. */
export function useSurahNameFont(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const face = new FontFace(
      "sura_names",
      'url(https://static.qurancdn.com/fonts/quran/surah-names/v2/sura_names.woff2) format("woff2")',
    );
    face.display = "block";
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setReady(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return ready;
}

/** Stable DOM id fragment for a page, e.g. `mushaf-page-007`. */
export function pageDomId(page: number): string {
  return `mushaf-page-${padPage(page)}`;
}
