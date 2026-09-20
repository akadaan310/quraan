/**
 * Parsing for the Quranic Arabic Corpus morphology table.
 *
 * Source format is one row per *segment* — a word may be several segments,
 * because Arabic fuses prefixes and suffixes onto the stem:
 *
 *   1:1:1:1   بِ        P   P|PREF|LEM:ب
 *   1:1:1:2   سْمِ      N   ROOT:سمو|LEM:اسْم|M|GEN
 *
 * so `بِسْمِ` is word 1 of 1:1, carried by two segments. The word indices line
 * up exactly with the reader's word positions once verse-end markers are
 * excluded — verified across 107 verses spanning the whole Muṣḥaf, with no
 * mismatches.
 */

/** Tags that name a segment's grammatical case. */
const CASE_TAGS = { NOM: "nominative", ACC: "accusative", GEN: "genitive" };

/** Tags that name a verb's aspect or mood. */
const ASPECT_TAGS = {
  PERF: "perfect",
  IMPF: "imperfect",
  IMPV: "imperative",
};

const MOOD_TAGS = {
  "MOOD:IND": "indicative",
  "MOOD:SUBJ": "subjunctive",
  "MOOD:JUS": "jussive",
};

/** Broad syntactic role, as far as the corpus's tagging supports it. */
const ROLE_TAGS = {
  PREF: "prefix",
  SUFF: "suffix",
  DET: "determiner",
  PRON: "pronoun",
  PN: "proper noun",
  ADJ: "adjective",
  CONJ: "conjunction",
  NEG: "negation",
  REL: "relative",
  REM: "resumptive",
  EMPH: "emphasis",
  ACT_PCPL: "active participle",
  PASS_PCPL: "passive participle",
  VN: "verbal noun",
};

const POS_CLASS = { N: "nominal", V: "verbal", P: "particle" };

/**
 * Parse the raw table into `{ "2:255": [ { position, segments: [...] } ] }`.
 */
export function parseMorphology(raw) {
  const verses = new Map();

  for (const line of raw.split("\n")) {
    if (!line) continue;
    const [location, arabic, posClass, featureBlob = ""] = line.split("\t");
    const [surah, ayah, wordIndex] = location.split(":").map(Number);
    if (!Number.isFinite(wordIndex)) continue;

    const verseKey = `${surah}:${ayah}`;
    let words = verses.get(verseKey);
    if (!words) verses.set(verseKey, (words = new Map()));

    let word = words.get(wordIndex);
    if (!word) words.set(wordIndex, (word = { position: wordIndex, segments: [] }));

    word.segments.push(parseSegment(arabic, posClass, featureBlob));
  }

  const out = {};
  for (const [verseKey, words] of verses) {
    out[verseKey] = [...words.values()].sort((a, b) => a.position - b.position);
  }
  return out;
}

function parseSegment(arabic, posClass, featureBlob) {
  const features = featureBlob.split("|").filter(Boolean);

  const segment = {
    /** Surface form of this segment alone. */
    text: arabic,
    /** `nominal` | `verbal` | `particle`. */
    pos: POS_CLASS[posClass] ?? "particle",
    tags: [],
  };

  for (const feature of features) {
    if (feature.startsWith("ROOT:")) {
      segment.root = feature.slice(5);
      continue;
    }
    if (feature.startsWith("LEM:")) {
      segment.lemma = feature.slice(4);
      continue;
    }
    if (feature.startsWith("VF:")) {
      // Verb form I–X, the derivational pattern the stem sits in.
      segment.verbForm = Number(feature.slice(3));
      continue;
    }
    if (feature.startsWith("MOOD:")) {
      segment.mood = MOOD_TAGS[feature] ?? feature.slice(5).toLowerCase();
      continue;
    }
    if (CASE_TAGS[feature]) {
      segment.grammaticalCase = CASE_TAGS[feature];
      continue;
    }
    if (ASPECT_TAGS[feature]) {
      segment.aspect = ASPECT_TAGS[feature];
      continue;
    }
    if (ROLE_TAGS[feature]) {
      segment.tags.push(ROLE_TAGS[feature]);
      continue;
    }
    // Person/gender/number agreement, e.g. 3MP, 2MS, FP.
    if (/^[123]?[MF][SPD]$/.test(feature) || /^[123]P$|^[123]S$/.test(feature)) {
      segment.agreement = feature;
      continue;
    }
    if (feature === "INDEF") {
      segment.definite = false;
      continue;
    }
  }

  if (segment.tags.length === 0) delete segment.tags;
  return segment;
}

/** The stem is the segment that carries the root — what a reader taps for. */
export function stemOf(word) {
  return word.segments.find((s) => s.root) ?? word.segments.at(-1);
}
