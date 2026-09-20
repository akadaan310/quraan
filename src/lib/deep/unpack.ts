import type { PageMorphology, Segment, WordMorphology } from "./types";

/**
 * Expand the packed morphology chunks written by scripts/lib/pack.mjs.
 *
 * The two files must agree; the vocabularies below are the contract between
 * them. They are closed sets from the corpus's own tagging, so a mismatch
 * would be a build error rather than a data surprise.
 */

const POS_CODES = ["particle", "nominal", "verbal"] as const;
const CASE_CODES = [null, "nominative", "accusative", "genitive"] as const;
const ASPECT_CODES = [null, "perfect", "imperfect", "imperative"] as const;
const MOOD_CODES = [null, "indicative", "subjunctive", "jussive"] as const;
const TAG_CODES = [
  "prefix", "suffix", "determiner", "pronoun", "proper noun", "adjective",
  "conjunction", "negation", "relative", "resumptive", "emphasis",
  "active participle", "passive participle", "verbal noun",
] as const;

type PackedSegment = (string | number)[];

export interface PackedPage {
  r: string[];
  l: string[];
  v: Record<string, PackedSegment[][]>;
}

export function unpackPage(packed: PackedPage): PageMorphology {
  const out: PageMorphology = {};

  for (const [verseKey, words] of Object.entries(packed.v)) {
    out[verseKey] = words.map<WordMorphology>((segments, index) => ({
      position: index + 1,
      segments: segments.map((tuple) => unpackSegment(tuple, packed)),
    }));
  }
  return out;
}

function unpackSegment(tuple: PackedSegment, packed: PackedPage): Segment {
  const at = (i: number) => (tuple[i] ?? 0) as number;

  const segment: Segment = {
    text: String(tuple[0] ?? ""),
    pos: POS_CODES[at(1)] ?? "particle",
    tags: [],
  };

  // String table references are 1-based so that 0 can mean "absent".
  const rootRef = at(2);
  if (rootRef) segment.root = packed.r[rootRef - 1];
  const lemmaRef = at(3);
  if (lemmaRef) segment.lemma = packed.l[lemmaRef - 1];

  const grammaticalCase = CASE_CODES[at(4)];
  if (grammaticalCase) segment.grammaticalCase = grammaticalCase;
  const aspect = ASPECT_CODES[at(5)];
  if (aspect) segment.aspect = aspect;
  const mood = MOOD_CODES[at(6)];
  if (mood) segment.mood = mood;

  const agreement = tuple[7];
  if (agreement) segment.agreement = String(agreement);
  const verbForm = at(8);
  if (verbForm) segment.verbForm = verbForm;

  const tagMask = at(9);
  for (let bit = 0; bit < TAG_CODES.length; bit += 1) {
    if (tagMask & (1 << bit)) segment.tags.push(TAG_CODES[bit]);
  }

  return segment;
}

/** The segment carrying the root — the one a reader means when they tap. */
export function stemOf(word: WordMorphology): Segment | undefined {
  return word.segments.find((s) => s.root) ?? word.segments.at(-1);
}

/**
 * Render agreement codes as something readable. The corpus writes them as
 * person-gender-number runs like `3MP`, which mean nothing on their own.
 */
export function describeAgreement(code: string | undefined): string | null {
  if (!code) return null;
  const person = /^[123]/.test(code) ? `${code[0]}${ordinal(code[0])} person` : null;
  const rest = person ? code.slice(1) : code;
  const gender = rest.includes("M") ? "masculine" : rest.includes("F") ? "feminine" : null;
  const number = rest.includes("P")
    ? "plural"
    : rest.includes("D")
      ? "dual"
      : rest.includes("S")
        ? "singular"
        : null;
  const parts = [person, gender, number].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function ordinal(digit: string): string {
  return digit === "1" ? "st" : digit === "2" ? "nd" : "rd";
}

/** Verb forms I–X, the derivational patterns an Arabic root is built into. */
export const VERB_FORM_NUMERALS = [
  "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
];
