import { JUZ_START_PAGES, juzForPage } from "./juz.mjs";

const LAST_PAGE = 604;

/**
 * Word and verse counts per juzʾ — a real structural-balance measurement,
 * not a reading of what the balance means. `pageVerses` is the page→verseKey
 * index already baked for the reader; `morphology` gives each verse's word
 * count for free, since it is already parsed into one entry per word.
 *
 * A verse whose words straddle a page break is counted once, on the first
 * page it appears on, so the juzʾ totals do not double-count it.
 */
export function buildJuzBalance(pageVerses, morphology) {
  const stats = new Map();
  for (let juz = 1; juz <= 30; juz += 1) {
    const startPage = JUZ_START_PAGES[juz - 1];
    const endPage = juz < 30 ? JUZ_START_PAGES[juz] - 1 : LAST_PAGE;
    stats.set(juz, { juz, pages: [startPage, endPage], verseCount: 0, wordCount: 0 });
  }

  const counted = new Set();
  for (let page = 1; page <= LAST_PAGE; page += 1) {
    const stat = stats.get(juzForPage(page));
    for (const verseKey of pageVerses[page] ?? []) {
      if (counted.has(verseKey)) continue;
      counted.add(verseKey);
      stat.verseCount += 1;
      stat.wordCount += morphology[verseKey]?.length ?? 0;
    }
  }

  return [...stats.values()];
}

/**
 * A numeric extension of the existing symmetry measurement (scripts/lib/
 * symmetry.mjs): which sūrahs carry one genuinely notable mirrored pair (the
 * same `NOTABLE_PAIR` bar symmetry.mjs already uses) despite an *aggregate*
 * mirror signal that is weak or absent. This is not redundant with a plain
 * "strong sūrahs" list — those already show as `strength: "strong"` — it
 * surfaces the sūrahs whose one real pivot would otherwise be invisible
 * next to a low overall lift, the same reasoning that already keeps
 * `notable` pairs independent of `strength` in symmetry.mjs itself, applied
 * across the whole Muṣḥaf rather than within one sūrah.
 *
 * A raw peak-over-mean ratio was tried first and dropped: the baseline mean
 * sits near zero for most sūrahs, so almost every sūrah's peak pair looks
 * "huge" relative to it — the ratio does not discriminate.
 */
const NOTABLE_PAIR = 0.18;

export function buildSymmetryAnomalies(symmetry) {
  const anomalies = {};
  for (const [surah, data] of Object.entries(symmetry)) {
    if (!data.pairs || data.pairs.length === 0) continue;
    const peak = data.pairs.reduce((best, p) => (p.score > best.score ? p : best), data.pairs[0]);
    anomalies[surah] = {
      peakDepth: peak.depth,
      peakOpening: peak.opening,
      peakClosing: peak.closing,
      peakScore: peak.score,
      strength: data.strength,
      isAnomaly:
        peak.score >= NOTABLE_PAIR && (data.strength === "none" || data.strength === "weak"),
    };
  }
  return anomalies;
}
