"use client";

import { useEffect, useState } from "react";
import type { StructureAtlasData } from "./types";

/** Per-juzʾ word/verse balance and cross-sūrah symmetry anomalies (structure.json). */

let promise: Promise<StructureAtlasData | null> | null = null;

function load(): Promise<StructureAtlasData | null> {
  promise ??= fetch("/data/structure.json").then((r) =>
    r.ok ? (r.json() as Promise<StructureAtlasData>) : null,
  );
  return promise;
}

export function useStructureAtlas(enabled: boolean): StructureAtlasData | null {
  const [data, setData] = useState<StructureAtlasData | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void load().then((result) => {
      if (active) setData(result);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  return data;
}
