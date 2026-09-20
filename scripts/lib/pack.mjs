/**
 * Compact encoding for the per-page morphology chunks.
 *
 * The readable shape costs about 23 KB a page, and a reader on a phone
 * downloads one of these every time they turn to a new page — so the wire
 * format drops the field names, folds roots and lemmas into per-page string
 * tables (they repeat heavily within a page), and enumerates the closed tag
 * vocabularies. The app expands it back on arrival; nothing downstream sees
 * the packed form.
 */

export const POS_CODES = ["particle", "nominal", "verbal"];
export const CASE_CODES = [null, "nominative", "accusative", "genitive"];
export const ASPECT_CODES = [null, "perfect", "imperfect", "imperative"];
export const MOOD_CODES = [null, "indicative", "subjunctive", "jussive"];
export const TAG_CODES = [
  "prefix", "suffix", "determiner", "pronoun", "proper noun", "adjective",
  "conjunction", "negation", "relative", "resumptive", "emphasis",
  "active participle", "passive participle", "verbal noun",
];

const index = (list, value) => {
  const i = list.indexOf(value ?? null);
  return i < 0 ? 0 : i;
};

/**
 * Segment tuple: [text, pos, rootRef, lemmaRef, case, aspect, mood,
 *                 agreement, verbForm, tagMask]
 * Trailing zeros are trimmed, since most segments carry only a few features.
 */
export function packPage(verses) {
  const roots = [];
  const lemmas = [];
  const rootRef = new Map();
  const lemmaRef = new Map();

  const intern = (table, refs, value) => {
    if (!value) return 0;
    let ref = refs.get(value);
    if (ref === undefined) {
      table.push(value);
      refs.set(value, (ref = table.length));
    }
    return ref;
  };

  const packed = {};
  for (const [verseKey, words] of Object.entries(verses)) {
    packed[verseKey] = words.map((word) =>
      word.segments.map((segment) => {
        let tagMask = 0;
        for (const tag of segment.tags ?? []) {
          const bit = TAG_CODES.indexOf(tag);
          if (bit >= 0) tagMask |= 1 << bit;
        }

        const tuple = [
          segment.text,
          POS_CODES.indexOf(segment.pos),
          intern(roots, rootRef, segment.root),
          intern(lemmas, lemmaRef, segment.lemma),
          index(CASE_CODES, segment.grammaticalCase),
          index(ASPECT_CODES, segment.aspect),
          index(MOOD_CODES, segment.mood),
          segment.agreement ?? "",
          segment.verbForm ?? 0,
          tagMask,
        ];
        while (tuple.length > 2 && !tuple[tuple.length - 1]) tuple.pop();
        return tuple;
      }),
    );
  }

  return { r: roots, l: lemmas, v: packed };
}
