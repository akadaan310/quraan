/**
 * A small, hand-curated table of thematic root-groups.
 *
 * This is deliberately not model-derived: picking "patience" or "mercy" as a
 * concept worth a lens is an editorial choice, and the honest thing is to
 * say so rather than dress a curated list up as something the corpus itself
 * produced. What *is* real is the resolution step below — every root here is
 * checked against the actual baked vocabulary, and the verse list attached
 * to each concept is exactly the verses that carry one of its roots, nothing
 * inferred or padded.
 *
 * Once resolved, a concept's `verseKeys` are handed to the existing semantic
 * worker's centroid/resonance calls (the same ones the personal-resonance
 * feature already uses) — so "verses near this concept" reuses the real
 * embedding space rather than introducing a second notion of similarity.
 */

export const CONCEPTS = [
  {
    id: "sabr",
    label: "Patience",
    labelArabic: "الصبر",
    roots: ["صبر"],
  },
  {
    id: "shukr",
    label: "Gratitude",
    labelArabic: "الشكر",
    roots: ["شكر"],
  },
  {
    id: "qurb",
    label: "Nearness to God",
    labelArabic: "القرب",
    roots: ["قرب"],
  },
  {
    id: "rahma",
    label: "Mercy & forgiveness",
    labelArabic: "الرحمة والمغفرة",
    roots: ["رحم", "غفر"],
  },
  {
    id: "nur",
    label: "Light & fire",
    labelArabic: "النور والنار",
    // One root covers both — ن و ر is the radical set behind نور (light) and
    // نار (fire) alike, and the Qur'an plays on that shared root directly
    // (an-Nūr 24:35 vs. verses of warning). Labeled as both, not simplified
    // to one, because the corpus itself does not separate them.
    roots: ["نور"],
  },
  {
    id: "zulm",
    label: "Wrongdoing",
    labelArabic: "الظلم",
    roots: ["ظلم"],
  },
  {
    id: "khashyah",
    label: "Awe before God",
    labelArabic: "الخشوع",
    roots: ["خشع"],
  },
  {
    id: "trial-yunus",
    label: "Yūnus's solitude",
    labelArabic: "يونس",
    // Curated tag, not narrative detection: ل ب ث ("tarried") and حوت
    // ("fish/whale") are the two roots that concentrate in 37:139-148 and
    // 21:87-88, the two passages telling his story.
    roots: ["حوت", "لبث"],
  },
  {
    id: "trial-yaqub",
    label: "Yaʿqūb's grief",
    labelArabic: "يعقوب",
    roots: ["حزن"],
  },
];

/**
 * Resolve the curated table against a real baked root index, dropping (and
 * reporting) any root the vocabulary filter excluded — a root can miss
 * `MIN_OCCURRENCES` or exceed `MAX_DOC_FREQUENCY` in embeddings.mjs, and a
 * concept built on a root that was never placed in the vector space would be
 * silently wrong rather than absent.
 */
export function resolveConcepts(index) {
  const resolved = [];
  const warnings = [];

  for (const concept of CONCEPTS) {
    const rootIds = [];
    for (const root of concept.roots) {
      const id = index.rootId.get(root);
      if (id === undefined) {
        warnings.push(`concept "${concept.id}": root ${root} not in vocabulary`);
        continue;
      }
      rootIds.push(id);
    }
    if (rootIds.length === 0) {
      warnings.push(`concept "${concept.id}": no roots resolved, dropped`);
      continue;
    }

    const rootIdSet = new Set(rootIds);
    const verseKeys = [];
    index.verseRoots.forEach((roots, i) => {
      if (roots.some((r) => rootIdSet.has(r))) verseKeys.push(index.verseKeys[i]);
    });

    if (verseKeys.length === 0) {
      warnings.push(`concept "${concept.id}": resolved roots but no verses, dropped`);
      continue;
    }

    resolved.push({
      id: concept.id,
      label: concept.label,
      labelArabic: concept.labelArabic,
      roots: concept.roots.filter((r) => index.rootId.has(r)),
      verseKeys,
    });
  }

  return { concepts: resolved, warnings };
}
