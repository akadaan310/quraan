"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Constellation, SemanticMeta } from "./types";

/**
 * Bridge to the semantic worker.
 *
 * The atlas is 561 KB of int8 vectors plus a root vocabulary; it loads once,
 * in the background, after the page is readable. Until it is ready the
 * constellation view simply is not offered — a half-loaded knowledge web is
 * worse than none.
 */

interface Atlas {
  ready: boolean;
  meta: SemanticMeta | null;
  /** Verses nearest the given one, with the roots that explain each link. */
  neighbours: (verseKey: string) => Promise<Constellation[]>;
  /** Verses nearest the centre of what this reader keeps returning to. */
  resonance: (verseKeys: string[]) => Promise<Constellation[]>;
  gloss: (root: string) => string | undefined;
}

export function useSemanticAtlas(enabled: boolean): Atlas {
  const workerRef = useRef<Worker | null>(null);
  const metaRef = useRef<SemanticMeta | null>(null);
  const pageOfVerse = useRef<Map<string, number>>(new Map());
  const pending = useRef(new Map<string, (value: never) => void>());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || typeof Worker === "undefined") return;

    const worker = new Worker(
      new URL("../../workers/semantic.worker.ts", import.meta.url),
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ type: string } & Record<string, unknown>>) => {
      const message = event.data;
      if (message.type === "ready") {
        setReady(true);
        return;
      }
      const resolve = pending.current.get(message.type);
      if (resolve) {
        pending.current.delete(message.type);
        resolve(message as never);
      }
    };

    void (async () => {
      // Meta is needed on this side too, for glosses and root names.
      const response = await fetch("/data/semantic/meta.json");
      if (response.ok) metaRef.current = (await response.json()) as SemanticMeta;
      worker.postMessage({
        type: "init",
        metaUrl: "/data/semantic/meta.json",
        vectorUrl: "/data/semantic/verse-vectors.i8",
      });
    })();

    // Verse → page, so a constellation thread knows where it is going.
    void fetch("/data/page-verses.json")
      .then((r) => r.json() as Promise<Record<string, string[]>>)
      .then((pages) => {
        const map = new Map<string, number>();
        for (const [page, keys] of Object.entries(pages)) {
          for (const key of keys) if (!map.has(key)) map.set(key, Number(page));
        }
        pageOfVerse.current = map;
      })
      .catch(() => {});

    return () => {
      worker.terminate();
      workerRef.current = null;
      setReady(false);
    };
  }, [enabled]);

  const ask = useCallback(<T,>(type: string, message: object): Promise<T> => {
    const worker = workerRef.current;
    if (!worker) return Promise.resolve(undefined as T);
    return new Promise<T>((resolve) => {
      pending.current.set(type, resolve as (value: never) => void);
      worker.postMessage(message);
    });
  }, []);

  const decorate = useCallback(
    (results: { verseKey: string; similarity: number; sharedRoots?: number[] }[]) => {
      const meta = metaRef.current;
      return results.map<Constellation>((result) => ({
        verseKey: result.verseKey,
        page: pageOfVerse.current.get(result.verseKey) ?? 1,
        similarity: result.similarity,
        sharedRoots: (result.sharedRoots ?? [])
          .map((id) => meta?.vocabulary[id])
          .filter((root): root is string => Boolean(root)),
      }));
    },
    [],
  );

  const neighbours = useCallback(
    async (verseKey: string) => {
      const response = await ask<{
        results: { verseKey: string; similarity: number; sharedRoots: number[] }[];
      }>("neighbours", { type: "neighbours", verseKey, limit: 12 });
      return decorate(response?.results ?? []);
    },
    [ask, decorate],
  );

  const resonance = useCallback(
    async (verseKeys: string[]) => {
      if (verseKeys.length === 0) return [];
      const centroid = await ask<{ vector: number[] }>("centroid", {
        type: "accumulate",
        verseKeys,
      });
      if (!centroid?.vector) return [];
      const response = await ask<{ results: { verseKey: string; similarity: number }[] }>(
        "resonance",
        { type: "resonance", centroid: centroid.vector, limit: 9 },
      );
      return decorate(response?.results ?? []);
    },
    [ask, decorate],
  );

  const gloss = useCallback(
    (root: string) => metaRef.current?.gloss[root],
    [],
  );

  return { ready, meta: metaRef.current, neighbours, resonance, gloss };
}
