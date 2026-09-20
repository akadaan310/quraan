"use client";

import { useEffect, useState } from "react";
import type { ConceptGroup } from "./types";

/**
 * The curated concept table (scripts/lib/concepts.mjs), loaded once. At
 * under 10 entries with a few hundred verse keys each, this is small enough
 * to hold in full rather than chunk.
 */

let conceptsPromise: Promise<ConceptGroup[]> | null = null;

function loadConcepts(): Promise<ConceptGroup[]> {
  conceptsPromise ??= fetch("/data/concepts.json").then((r) =>
    r.ok ? (r.json() as Promise<ConceptGroup[]>) : [],
  );
  return conceptsPromise;
}

export function useConcepts(enabled: boolean): ConceptGroup[] {
  const [concepts, setConcepts] = useState<ConceptGroup[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadConcepts().then((list) => {
      if (active) setConcepts(list);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  return concepts;
}
