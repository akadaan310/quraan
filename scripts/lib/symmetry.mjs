/**
 * Measured mirror structure within a sūrah.
 *
 * Ring composition — an opening that answers its close, the second verse the
 * second-from-last, folding inward to a pivot — is a real and much-discussed
 * feature of sūrah structure. It is also a *reading*, argued by scholars from
 * meaning, and there is no authoritative machine-readable dataset of it.
 *
 * So this computes something narrower and honest: how strongly verse `i` from
 * the start shares vocabulary with verse `i` from the end, measured as root
 * overlap. Where a sūrah is built as a ring, that signal tends to show; where
 * it is not, the numbers stay low and the UI says the structure is weak. The
 * reader is shown a measurement, never told what it means.
 */

/** Below this, an overlap is indistinguishable from chance. */
const NOTABLE_PAIR = 0.18;

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * @param verses ordered `{ verseKey, roots: Set<string> }` for one sūrah
 */
export function analyseSymmetry(verses) {
  const n = verses.length;
  if (n < 5) return null;

  const pairs = [];
  const depth = Math.floor(n / 2);

  for (let i = 0; i < depth; i += 1) {
    const opening = verses[i];
    const closing = verses[n - 1 - i];
    const score = jaccard(opening.roots, closing.roots);
    const shared = [...opening.roots].filter((r) => closing.roots.has(r));
    pairs.push({
      depth: i + 1,
      opening: opening.verseKey,
      closing: closing.verseKey,
      score: Math.round(score * 1000) / 1000,
      shared,
    });
  }

  /*
   * A sūrah's mirror signal only means something relative to how much any two
   * of its verses happen to share — a sūrah with a narrow vocabulary scores
   * high everywhere. So the baseline is the mean overlap of *non*-mirrored
   * pairs at the same distances, and the strength reported is the lift over
   * that baseline.
   */
  let baselineTotal = 0;
  let baselineCount = 0;
  for (let i = 0; i < depth; i += 1) {
    const offset = (i * 7 + 3) % n;
    const other = (n - 1 - i + offset) % n;
    if (other === n - 1 - i || other === i) continue;
    baselineTotal += jaccard(verses[i].roots, verses[other].roots);
    baselineCount += 1;
  }
  const baseline = baselineCount ? baselineTotal / baselineCount : 0;
  const mirrorMean = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;
  const lift = baseline > 0 ? mirrorMean / baseline : mirrorMean > 0 ? 2 : 0;

  const notable = pairs
    .filter((p) => p.score >= NOTABLE_PAIR)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return {
    verseCount: n,
    // The verse the fold closes on: the centre of an odd sūrah, the seam of
    // an even one.
    pivot: verses[Math.floor((n - 1) / 2)].verseKey,
    mirrorMean: round(mirrorMean),
    baseline: round(baseline),
    lift: round(lift),
    strength: classify(lift, mirrorMean),
    pairs,
    notable,
  };
}

/**
 * Deliberately conservative wording. `lift` near 1 means the mirrored pairs
 * look like any other pairs in the sūrah, which is the common case.
 */
function classify(lift, mirrorMean) {
  if (mirrorMean < 0.05) return "none";
  if (lift >= 1.9) return "strong";
  if (lift >= 1.35) return "moderate";
  return "weak";
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

/** The twenty-nine sūrahs opened by disconnected letters. */
export const MUQATTAAT = {
  2: "الم", 3: "الم", 7: "المص", 10: "الر", 11: "الر", 12: "الر",
  13: "المر", 14: "الر", 15: "الر", 19: "كهيعص", 20: "طه", 26: "طسم",
  27: "طس", 28: "طسم", 29: "الم", 30: "الم", 31: "الم", 32: "الم",
  36: "يس", 38: "ص", 40: "حم", 41: "حم", 42: "حم", 43: "حم",
  44: "حم", 45: "حم", 46: "حم", 50: "ق", 68: "ن",
};
