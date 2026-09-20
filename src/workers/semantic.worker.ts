/// <reference lib="webworker" />

import type { SemanticMeta } from "@/lib/deep/types";

/**
 * On-device semantic search over the verse embeddings.
 *
 * Everything here runs off the main thread, because a 6,236 × 90 scan is
 * cheap but not free, and the one thing this reader will not do is drop a
 * frame mid page-turn to answer a question about a verse. The vectors arrive
 * as int8 and stay that way: dequantising 561 KB into floats would cost four
 * times the memory for precision the model does not have.
 *
 * No query, result or reading signal ever leaves the device — this worker is
 * the whole retrieval stack.
 */

interface Ready {
  type: "ready";
  verses: number;
  dimensions: number;
}

type Request =
  | { type: "init"; metaUrl: string; vectorUrl: string }
  | { type: "neighbours"; verseKey: string; limit?: number; roots?: number[] }
  | { type: "resonance"; centroid: number[]; limit?: number }
  | { type: "accumulate"; verseKeys: string[] };

type Response =
  | Ready
  | { type: "error"; message: string }
  | {
      type: "neighbours";
      verseKey: string;
      results: { verseKey: string; similarity: number; sharedRoots: number[] }[];
    }
  | { type: "resonance"; results: { verseKey: string; similarity: number }[] }
  | { type: "centroid"; vector: number[] };

let meta: SemanticMeta | null = null;
let vectors: Int8Array | null = null;
let dimensions = 0;
let positionOf = new Map<string, number>();
/** Root ids per verse, for explaining a link rather than asserting it. */
let verseRoots: number[][] = [];

const post = (message: Response) => (self as DedicatedWorkerGlobalScope).postMessage(message);

self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    await handle(event.data);
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};

async function handle(request: Request) {
  switch (request.type) {
    case "init":
      return init(request.metaUrl, request.vectorUrl);
    case "neighbours":
      return neighbours(request.verseKey, request.limit ?? 12);
    case "resonance":
      return resonance(request.centroid, request.limit ?? 9);
    case "accumulate":
      return accumulate(request.verseKeys);
  }
}

async function init(metaUrl: string, vectorUrl: string) {
  const [metaResponse, vectorResponse] = await Promise.all([
    fetch(metaUrl),
    fetch(vectorUrl),
  ]);
  if (!metaResponse.ok || !vectorResponse.ok) {
    throw new Error("semantic atlas unavailable");
  }

  meta = (await metaResponse.json()) as SemanticMeta;
  vectors = new Int8Array(await vectorResponse.arrayBuffer());
  dimensions = meta.dimensions;
  positionOf = new Map(meta.verseKeys.map((key, i) => [key, i]));

  // Root membership arrives separately and lazily; links still work without
  // it, they just cannot name what they share.
  post({ type: "ready", verses: meta.verseKeys.length, dimensions });
}

export function setVerseRoots(next: number[][]) {
  verseRoots = next;
}

/**
 * Cosine similarity over unit vectors reduces to a dot product, and both
 * operands are int8 — so the whole scan is integer multiply-accumulate with
 * one division at the end.
 */
function similarityTo(a: number, b: number): number {
  if (!vectors) return 0;
  const baseA = a * dimensions;
  const baseB = b * dimensions;
  let dot = 0;
  for (let c = 0; c < dimensions; c += 1) {
    dot += vectors[baseA + c] * vectors[baseB + c];
  }
  // Both were quantised from unit vectors at the same scale.
  return dot / (meta!.scale * meta!.scale);
}

function neighbours(verseKey: string, limit: number) {
  if (!meta || !vectors) throw new Error("atlas not initialised");
  const index = positionOf.get(verseKey);
  if (index === undefined || !meta.placed[index]) {
    // The muqaṭṭaʿāt have no roots and therefore no position in this space.
    post({ type: "neighbours", verseKey, results: [] });
    return;
  }

  const total = meta.verseKeys.length;
  const best: { verseKey: string; similarity: number; sharedRoots: number[] }[] = [];
  let floor = -1;

  for (let other = 0; other < total; other += 1) {
    if (other === index || !meta.placed[other]) continue;
    const similarity = similarityTo(index, other);
    if (similarity <= floor && best.length >= limit) continue;

    insert(best, { verseKey: meta.verseKeys[other], similarity, sharedRoots: [] }, limit);
    if (best.length >= limit) floor = best[best.length - 1].similarity;
  }

  const own = new Set(verseRoots[index] ?? []);
  for (const result of best) {
    const position = positionOf.get(result.verseKey);
    if (position === undefined) continue;
    result.sharedRoots = (verseRoots[position] ?? []).filter((r) => own.has(r));
  }

  post({ type: "neighbours", verseKey, results: best });
}

/**
 * Which verses sit closest to the centre of what this reader has been
 * dwelling on. The centroid is computed on the main thread from the local
 * ledger and passed in; the worker never sees the reading history itself.
 */
function resonance(centroid: number[], limit: number) {
  if (!meta || !vectors) throw new Error("atlas not initialised");
  if (centroid.length !== dimensions) throw new Error("centroid shape mismatch");

  let norm = 0;
  for (const value of centroid) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm < 1e-9) {
    post({ type: "resonance", results: [] });
    return;
  }

  const best: { verseKey: string; similarity: number }[] = [];
  for (let other = 0; other < meta.verseKeys.length; other += 1) {
    if (!meta.placed[other]) continue;
    const base = other * dimensions;
    let dot = 0;
    for (let c = 0; c < dimensions; c += 1) {
      dot += (vectors[base + c] / meta.scale) * centroid[c];
    }
    insert(best, { verseKey: meta.verseKeys[other], similarity: dot / norm }, limit);
  }

  post({ type: "resonance", results: best });
}

/** Mean of several verses' vectors — the shape of an interest. */
function accumulate(verseKeys: string[]) {
  if (!meta || !vectors) throw new Error("atlas not initialised");
  const vector = new Array<number>(dimensions).fill(0);
  let counted = 0;

  for (const verseKey of verseKeys) {
    const index = positionOf.get(verseKey);
    if (index === undefined || !meta.placed[index]) continue;
    const base = index * dimensions;
    for (let c = 0; c < dimensions; c += 1) {
      vector[c] += vectors[base + c] / meta.scale;
    }
    counted += 1;
  }

  if (counted > 0) {
    for (let c = 0; c < dimensions; c += 1) vector[c] /= counted;
  }
  post({ type: "centroid", vector });
}

/** Keep a short descending list without sorting the whole candidate set. */
function insert<T extends { similarity: number }>(list: T[], item: T, limit: number) {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (list[mid].similarity > item.similarity) low = mid + 1;
    else high = mid;
  }
  if (low >= limit) return;
  list.splice(low, 0, item);
  if (list.length > limit) list.pop();
}
