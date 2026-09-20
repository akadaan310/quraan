/**
 * A rule-based classical Arabic verb conjugator, scoped to sound
 * (triliteral, non-weak, non-doubled, non-hamzated) roots.
 *
 * This is real sarf, not a lookup table scraped from anywhere: perfect- and
 * imperfect-tense templates for Forms I–X are fixed and fully rule-governed
 * for a sound root, so the whole paradigm is derivable from the three
 * radicals plus the verb form alone. Two honest limits, stated rather than
 * silently wrong:
 *
 *  - Weak (containing و/ي/ا), hamzated, or doubled (geminate, r2 = r3) roots
 *    undergo real phonological contractions this module does not model, so
 *    `conjugate` refuses them outright rather than print a form that looks
 *    plausible and is not.
 *  - Form I's imperfect vowel on the middle radical (a/i/u) is lexically
 *    fixed per verb in Classical Arabic — it is not derivable from the root
 *    shape — so the imperfect paradigm for Form I is shown with the
 *    statistically common fatḥa pattern and flagged as an approximation.
 *    Forms II–X have no such ambiguity: their imperfect vowel is fixed by
 *    the form itself.
 */

const FATHA = "َ";
const DAMMA = "ُ";
const KASRA = "ِ";
const SUKUN = "ْ";
const SHADDA = "ّ";
const ALEF = "ا";
const ALEF_WASL = "ا" + KASRA;
const HAMZA_ALEF = "أ";
const TA = "ت";
const NUN = "ن";
const MIM = "م";
const SIN = "س";
const WAW = "و";

const WEAK_RADICALS = new Set(["و", "ي", "ا", "أ", "إ", "ؤ", "ئ", "ء", "ى"]);
/** Roots beginning with these assimilate the Form VIII infix ت into r1. */
const FORM_VIII_ASSIMILATING = new Set([
  "ت", "ث", "د", "ذ", "ز", "س", "ش", "ص", "ض", "ط", "ظ",
]);

export function isSoundRoot(root: string): boolean {
  const radicals = [...root];
  if (radicals.length !== 3) return false;
  const [r1, r2, r3] = radicals;
  if (r2 === r3) return false; // geminate/doubled — real assimilation rules apply
  return ![r1, r2, r3].some((r) => WEAK_RADICALS.has(r));
}

export interface ConjugatedForm {
  person: string;
  label: string;
  word: string;
}

export type ConjugationResult =
  | {
      supported: true;
      formName: string;
      perfect: ConjugatedForm[];
      imperfect: ConjugatedForm[];
      notes: string[];
    }
  | { supported: false; reason: string };

/** Perfect-tense stem, ending in fatḥa on the third radical (or after its shadda). */
function perfectStem(form: number, r1: string, r2: string, r3: string): string | null {
  switch (form) {
    case 1:
      return r1 + FATHA + r2 + FATHA + r3 + FATHA;
    case 2:
      return r1 + FATHA + r2 + SHADDA + FATHA + r3 + FATHA;
    case 3:
      return r1 + FATHA + ALEF + r2 + FATHA + r3 + FATHA;
    case 4:
      return HAMZA_ALEF + FATHA + r1 + SUKUN + r2 + FATHA + r3 + FATHA;
    case 5:
      return TA + FATHA + r1 + FATHA + r2 + SHADDA + FATHA + r3 + FATHA;
    case 6:
      return TA + FATHA + r1 + ALEF + r2 + FATHA + r3 + FATHA;
    case 7:
      return ALEF_WASL + NUN + SUKUN + r1 + FATHA + r2 + FATHA + r3 + FATHA;
    case 8:
      return ALEF_WASL + r1 + SUKUN + TA + FATHA + r2 + FATHA + r3 + FATHA;
    case 9:
      return ALEF_WASL + r1 + SUKUN + r2 + FATHA + r3 + SHADDA + FATHA;
    case 10:
      return ALEF_WASL + SIN + SUKUN + TA + FATHA + r1 + SUKUN + r2 + FATHA + r3 + FATHA;
    default:
      return null;
  }
}

/** Imperfect stem core (after the person prefix, before the third radical). */
function imperfectCore(form: number, r1: string, r2: string, r3: string): string | null {
  switch (form) {
    // Middle-radical vowel is lexically fixed per verb; fatḥa is the default
    // shown, flagged in `notes`.
    case 1:
      return r1 + SUKUN + r2 + FATHA;
    case 2:
      return r1 + FATHA + r2 + SHADDA + KASRA;
    case 3:
      return r1 + FATHA + ALEF + r2 + KASRA;
    case 4:
      return r1 + SUKUN + r2 + KASRA;
    case 5:
      return TA + FATHA + r1 + FATHA + r2 + SHADDA + FATHA;
    case 6:
      return TA + FATHA + r1 + ALEF + r2 + FATHA;
    case 7:
      return NUN + SUKUN + r1 + FATHA + r2 + KASRA;
    case 8:
      return r1 + SUKUN + TA + FATHA + r2 + KASRA;
    case 9:
      return r1 + SUKUN + r2 + FATHA;
    case 10:
      return SIN + SUKUN + TA + FATHA + r1 + SUKUN + r2 + KASRA;
    default:
      return null;
  }
}

/** Imperfect prefix vowel: damma for Forms II/III/IV, fatḥa for the rest. */
function prefixVowel(form: number): string {
  return form === 2 || form === 3 || form === 4 ? DAMMA : FATHA;
}

/**
 * `full` keeps the stem's own final fatḥa (3rd person, non-plural). `sukun`
 * drops it for a person suffix that itself starts with a consonant (تَ, تِ,
 * نَ…). `consonant` drops it with no replacement vowel at all — only the
 * 3mp suffix needs this, because ُوا supplies the vowel itself and a
 * consonant cannot carry two stacked diacritics.
 */
const PERFECT_PERSONS: {
  id: string;
  label: string;
  stem: "full" | "sukun" | "consonant";
  suffix: string;
}[] = [
  { id: "3ms", label: "he", stem: "full", suffix: "" },
  { id: "3fs", label: "she", stem: "full", suffix: TA + SUKUN },
  { id: "3md", label: "they two (m)", stem: "full", suffix: ALEF },
  { id: "3fd", label: "they two (f)", stem: "full", suffix: TA + FATHA + ALEF },
  { id: "3mp", label: "they (m)", stem: "consonant", suffix: DAMMA + WAW + ALEF },
  { id: "3fp", label: "they (f)", stem: "sukun", suffix: NUN + FATHA },
  { id: "2ms", label: "you (m)", stem: "sukun", suffix: TA + FATHA },
  { id: "2fs", label: "you (f)", stem: "sukun", suffix: TA + KASRA },
  { id: "2d", label: "you two", stem: "sukun", suffix: TA + DAMMA + MIM + FATHA + ALEF },
  { id: "2mp", label: "you (m pl)", stem: "sukun", suffix: TA + DAMMA + MIM + SUKUN },
  { id: "2fp", label: "you (f pl)", stem: "sukun", suffix: TA + DAMMA + NUN + SHADDA + FATHA },
  { id: "1s", label: "I", stem: "sukun", suffix: TA + DAMMA },
  { id: "1p", label: "we", stem: "sukun", suffix: NUN + FATHA + ALEF },
];

const IMPERFECT_PERSONS: {
  id: string;
  label: string;
  prefix: string;
  stemVowel: "damma" | "fatha" | "kasra" | "sukun";
  suffix: string;
}[] = [
  { id: "3ms", label: "he", prefix: "ي", stemVowel: "damma", suffix: "" },
  { id: "3fs", label: "she", prefix: "ت", stemVowel: "damma", suffix: "" },
  { id: "3md", label: "they two (m)", prefix: "ي", stemVowel: "fatha", suffix: ALEF + NUN + KASRA },
  { id: "3fd", label: "they two (f)", prefix: "ت", stemVowel: "fatha", suffix: ALEF + NUN + KASRA },
  { id: "3mp", label: "they (m)", prefix: "ي", stemVowel: "damma", suffix: WAW + NUN + FATHA },
  { id: "3fp", label: "they (f)", prefix: "ي", stemVowel: "sukun", suffix: NUN + FATHA },
  { id: "2ms", label: "you (m)", prefix: "ت", stemVowel: "damma", suffix: "" },
  { id: "2fs", label: "you (f)", prefix: "ت", stemVowel: "kasra", suffix: "ي" + NUN + FATHA },
  { id: "2d", label: "you two", prefix: "ت", stemVowel: "fatha", suffix: ALEF + NUN + KASRA },
  { id: "2mp", label: "you (m pl)", prefix: "ت", stemVowel: "damma", suffix: WAW + NUN + FATHA },
  { id: "2fp", label: "you (f pl)", prefix: "ت", stemVowel: "sukun", suffix: NUN + FATHA },
  { id: "1s", label: "I", prefix: "أ", stemVowel: "damma", suffix: "" },
  { id: "1p", label: "we", prefix: "ن", stemVowel: "damma", suffix: "" },
];

const STEM_VOWEL: Record<string, string> = {
  damma: DAMMA,
  fatha: FATHA,
  kasra: KASRA,
  sukun: SUKUN,
};

const FORM_NAMES: Record<number, string> = {
  1: "Form I",
  2: "Form II",
  3: "Form III",
  4: "Form IV",
  5: "Form V",
  6: "Form VI",
  7: "Form VII",
  8: "Form VIII",
  9: "Form IX",
  10: "Form X",
};

export function conjugate(root: string, form: number): ConjugationResult {
  if (!isSoundRoot(root)) {
    return {
      supported: false,
      reason:
        "This root is weak, hamzated, or doubled — its conjugation involves " +
        "contractions this module does not model, so no paradigm is shown " +
        "rather than an incorrect one.",
    };
  }
  const [r1, r2, r3] = [...root];
  const full = perfectStem(form, r1, r2, r3);
  const core = imperfectCore(form, r1, r2, r3);
  if (!full || !core) {
    return { supported: false, reason: `Form ${form} is not a recognised derived form.` };
  }
  const stems = {
    full,
    sukun: full.slice(0, -1) + SUKUN,
    consonant: full.slice(0, -1),
  };

  const perfect = PERFECT_PERSONS.map((p) => ({
    person: p.id,
    label: p.label,
    word: stems[p.stem] + p.suffix,
  }));

  const shadda = form === 9 ? SHADDA : "";
  const imperfect = IMPERFECT_PERSONS.map((p) => ({
    person: p.id,
    label: p.label,
    word:
      p.prefix +
      prefixVowel(form) +
      core +
      r3 +
      shadda +
      STEM_VOWEL[p.stemVowel] +
      p.suffix,
  }));

  const notes: string[] = [];
  if (form === 1) {
    notes.push(
      "Form I's imperfect vowel on the middle radical is fixed per verb by " +
        "usage, not derivable from the root — shown with the common fatḥa " +
        "pattern as an approximation.",
    );
  }
  if (form === 8 && FORM_VIII_ASSIMILATING.has(r1)) {
    notes.push(
      "Form VIII assimilates its ت infix into a first radical from this " +
        "letter class (e.g. اتّخذ, not *اوتخذ) — the template above does not " +
        "reflect that assimilation for this root.",
    );
  }

  return { supported: true, formName: FORM_NAMES[form] ?? `Form ${form}`, perfect, imperfect, notes };
}
