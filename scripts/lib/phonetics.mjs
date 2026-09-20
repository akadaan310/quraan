/**
 * Phonetic and rhythmic profiling of Uthmani text.
 *
 * Everything here is measured off the orthography, which for Uthmani script
 * is unusually informative: the marks that govern recitation — shadda, sukūn,
 * the superscript alef, the maddah — are all written. So elongation, nasal
 * assimilation and echoing consonants can be counted directly rather than
 * predicted.
 *
 * These are *orthographic proxies* for tajwīd, not a ruling on it. They drive
 * the colour and cadence of the background, nothing a reader recites from.
 */

const DIACRITICS = /[ً-ٰٟۖ-ۭـ]/g;

const FATHA = "َ";
const DAMMA = "ُ";
const KASRA = "ِ";
const SHADDA = "ّ";
const SUKUN = "ْ";
const MADDAH = "ٓ";
const SUPERSCRIPT_ALEF = "ٰ";

/** The five letters given a slight echo when they close a syllable. */
const QALQALAH = new Set(["ق", "ط", "ب", "ج", "د"]);
/** Letters recited from deep in the throat; they darken a verse's texture. */
const HEAVY = new Set(["خ", "ص", "ض", "ط", "ظ", "غ", "ق"]);
/** Sibilants, which brighten it. */
const SIBILANT = new Set(["س", "ش", "ص", "ز"]);

export function stripDiacritics(text) {
  return text.replace(DIACRITICS, "").replace(/ّ/g, "");
}

/**
 * The rhyme key of a verse — its fāṣila.
 *
 * Qurʾānic verse endings rhyme by their final consonant cluster rather than
 * by a full syllable, so the key is the last two bare letters. Grouping
 * consecutive verses by this key is what exposes a sūrah's rhyme runs.
 */
export function rhymeKey(text) {
  const bare = stripDiacritics(text).replace(/[^ء-ي]/g, "");
  return bare.slice(-2);
}

export function profileVerse(text) {
  let madd = 0;
  let ghunnah = 0;
  let qalqalah = 0;
  let heavy = 0;
  let sibilant = 0;
  let letters = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1] ?? "";

    if (ch === MADDAH || ch === SUPERSCRIPT_ALEF) {
      madd += 1;
      continue;
    }
    if (ch >= "ء" && ch <= "ي") {
      letters += 1;
      if (QALQALAH.has(ch) && next === SUKUN) qalqalah += 1;
      if (HEAVY.has(ch)) heavy += 1;
      if (SIBILANT.has(ch)) sibilant += 1;
      // Nūn and mīm carrying shadda are held and nasalised.
      if ((ch === "ن" || ch === "م") && next === SHADDA) ghunnah += 1;
      continue;
    }
    // Natural elongation: a long vowel written as vowel + matching letter.
    if (
      (ch === FATHA && (next === "ا" || next === SUPERSCRIPT_ALEF)) ||
      (ch === DAMMA && next === "و") ||
      (ch === KASRA && next === "ي")
    ) {
      madd += 1;
    }
  }

  const span = Math.max(letters, 1);
  return {
    letters,
    // Rates per letter keep a long verse from simply scoring higher on
    // everything than a short one.
    madd: round(madd / span),
    ghunnah: round(ghunnah / span),
    qalqalah: round(qalqalah / span),
    heavy: round(heavy / span),
    sibilant: round(sibilant / span),
    rhyme: rhymeKey(text),
  };
}

/**
 * Reduce a page's verses to the few numbers the background engine reads.
 *
 * `flow` rises with elongation and nasalisation — the qualities that make a
 * passage feel sustained and unhurried. `grain` rises with echoing and
 * throat-heavy consonants, which make it feel percussive. `rhymeRun` is how
 * strongly the page locks into a single ending, which is what a listener
 * hears as insistence.
 */
export function profilePage(verseProfiles) {
  if (verseProfiles.length === 0) {
    return { flow: 0, grain: 0, brightness: 0, rhymeRun: 0, density: 0, rhyme: "" };
  }

  const mean = (pick) =>
    verseProfiles.reduce((sum, p) => sum + pick(p), 0) / verseProfiles.length;

  const counts = new Map();
  for (const profile of verseProfiles) {
    if (!profile.rhyme) continue;
    counts.set(profile.rhyme, (counts.get(profile.rhyme) ?? 0) + 1);
  }
  const [dominant, dominantCount] =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];

  const letters = mean((p) => p.letters);
  return {
    flow: round(mean((p) => p.madd) * 2.2 + mean((p) => p.ghunnah) * 1.6),
    grain: round(mean((p) => p.qalqalah) * 3 + mean((p) => p.heavy) * 1.1),
    brightness: round(mean((p) => p.sibilant) * 2.4),
    rhymeRun: round(dominantCount / verseProfiles.length),
    // Short verses in quick succession read as dense; long ones as expansive.
    density: round(Math.min(1, 34 / Math.max(letters, 1))),
    rhyme: dominant,
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
