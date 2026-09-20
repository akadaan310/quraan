"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePageLayers, prefetchLayers } from "./usePageLayers";
import { useSemanticAtlas } from "./useSemanticAtlas";
import { useConcepts } from "./useConcepts";
import { useLedger } from "@/lib/ledger/useLedger";
import { useAmbience } from "@/components/celestial/CelestialCanvas";
import { stemOf } from "./unpack";
import type { Constellation, MushafPageLike, WordMorphology } from "./types";

export type DeepOverlay = "none" | "morphology" | "constellation" | "symmetry" | "prism";

/**
 * Everything the deep layers need to follow the reader around.
 *
 * It exists to keep `MushafReader` legible: the reader component decides what
 * is on screen, and this decides what the layers know. The one rule it
 * enforces is the important one — signals flow into the local ledger and the
 * atmosphere, and never anywhere else.
 */
export function useDeepReader({
  page,
  verseKeys,
  enabled,
}: {
  page: number;
  verseKeys: string[];
  enabled: boolean;
}) {
  const layers = usePageLayers(page, enabled);
  const atlas = useSemanticAtlas(enabled);
  const concepts = useConcepts(enabled);
  const ledger = useLedger(enabled);
  const ambience = useAmbience();

  const [overlay, setOverlay] = useState<DeepOverlay>("none");
  const [focusWord, setFocusWord] = useState<{
    verseKey: string;
    word: WordMorphology;
  } | null>(null);
  const [links, setLinks] = useState<Constellation[]>([]);
  const [linksFor, setLinksFor] = useState("");
  const [tracing, setTracing] = useState(false);

  /* -- The page's measured acoustics drive the atmosphere ---------------- */
  useEffect(() => {
    if (!layers.acoustics) return;
    ambience.setTexture({
      flow: layers.acoustics.flow,
      grain: layers.acoustics.grain,
      brightness: layers.acoustics.brightness,
      rhymeRun: layers.acoustics.rhymeRun,
      density: layers.acoustics.density,
    });
  }, [layers.acoustics, ambience]);

  /* -- Warm the next page's grammar while this one is being read --------- */
  useEffect(() => {
    if (!enabled) return;
    const idle =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 700));
    idle(() => {
      prefetchLayers(page + 1);
      prefetchLayers(page - 1);
    });
  }, [page, enabled]);

  useEffect(() => {
    if (enabled) ledger.notePage(page);
    // A page change closes any overlay anchored to the page left behind.
    setOverlay("none");
    setFocusWord(null);
    // notePage is stable; page is the only signal that should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, enabled]);

  /* -- Interactions ------------------------------------------------------ */

  /**
   * A word was touched. Ripple the atmosphere at the point of contact, start
   * attributing attention to its verse, and remember the shape of the word in
   * case the reader asks for its grammar.
   */
  const touchWord = useCallback(
    (verseKey: string, position: number, x: number, y: number) => {
      ambience.ripple(x, y, 0.85);
      ambience.noteActivity();
      ledger.attendTo(verseKey, page);

      const word = layers.morphology?.[verseKey]?.[position - 1] ?? null;
      if (word) setFocusWord({ verseKey, word });
    },
    [ambience, ledger, layers.morphology, page],
  );

  const openMorphology = useCallback(() => {
    if (!focusWord) return;
    const root = stemOf(focusWord.word)?.root;
    ledger.record("word-lookup", { page, verseKey: focusWord.verseKey, root });
    setOverlay("morphology");
  }, [focusWord, ledger, page]);

  const trace = useCallback(
    async (verseKey: string) => {
      setOverlay("constellation");
      setLinksFor(verseKey);
      setTracing(true);
      ledger.record("constellation", { page, verseKey });
      try {
        setLinks(await atlas.neighbours(verseKey));
      } finally {
        setTracing(false);
      }
    },
    [atlas, ledger, page],
  );

  /**
   * Trace by root rather than by verse: every verse carrying this root, most
   * semantically similar to the current one first.
   */
  const traceRoot = useCallback(
    async (root: string, fromVerse: string) => {
      setOverlay("constellation");
      setLinksFor(`${root} · ${fromVerse}`);
      setTracing(true);
      ledger.record("word-lookup", { page, verseKey: fromVerse, root });
      try {
        const all = await atlas.neighbours(fromVerse);
        const carrying = all.filter((link) => link.sharedRoots.includes(root));
        setLinks(carrying.length > 0 ? carrying : all);
      } finally {
        setTracing(false);
      }
    },
    [atlas, ledger, page],
  );

  /**
   * A concept lens is opened by centroid, not by a single verse: the concept's
   * seed verses (every verse carrying one of its roots, resolved at bake time)
   * go into the same centroid/resonance calls the personal-resonance feature
   * already uses, so "verses near this theme" is the real embedding space
   * answering, not a second similarity notion invented for concepts.
   */
  const openConcept = useCallback(
    async (conceptId: string) => {
      const concept = concepts.find((c) => c.id === conceptId);
      if (!concept) return;
      setOverlay("constellation");
      setLinksFor(concept.label);
      setTracing(true);
      ledger.record("constellation", { page, note: `concept:${conceptId}` });
      try {
        setLinks(await atlas.resonance(concept.verseKeys));
      } finally {
        setTracing(false);
      }
    },
    [atlas, concepts, ledger, page],
  );

  const openSymmetry = useCallback(
    (surahId: number) => {
      ambience.noteActivity();
      ledger.record("reflection", { page, note: `symmetry:${surahId}` });
      setOverlay("symmetry");
    },
    [ambience, ledger, page],
  );

  /* -- Personal resonance ------------------------------------------------ */
  const [resonance, setResonance] = useState<Constellation[]>([]);
  const resonanceKey = ledger.insights.attentionSet.join(",");
  const lastResonance = useRef("");

  useEffect(() => {
    if (!enabled || !atlas.ready) return;
    if (resonanceKey === lastResonance.current) return;
    if (ledger.insights.attentionSet.length < 3) return;
    lastResonance.current = resonanceKey;
    void atlas.resonance(ledger.insights.attentionSet).then(setResonance);
  }, [enabled, atlas, resonanceKey, ledger.insights.attentionSet]);

  const currentSurah = useMemo(
    () => (verseKeys[0] ? Number(verseKeys[0].split(":")[0]) : 1),
    [verseKeys],
  );

  return {
    layers,
    atlas,
    concepts,
    ledger,
    overlay,
    setOverlay,
    focusWord,
    clearFocus: () => setFocusWord(null),
    links,
    linksFor,
    tracing,
    resonance,
    currentSurah,
    touchWord,
    openMorphology,
    trace,
    traceRoot,
    openConcept,
    openSymmetry,
  };
}

export type { MushafPageLike };
