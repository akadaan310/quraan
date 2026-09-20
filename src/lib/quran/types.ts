/**
 * Domain model for a single printed page of the Madani (15-line) Muṣḥaf.
 *
 * The shape here is deliberately "page-first" rather than "verse-first": the
 * printed page — not the ayah — is the unit of visual fidelity we promise, so
 * everything downstream renders from `MushafPage.lines`.
 */

export type CharType = "word" | "end" | "pause" | "sajdah" | "rub" | "unknown";

export interface MushafWord {
  /** Stable global word id from the upstream corpus. */
  id: number;
  /** 1-based position of the word within its ayah. */
  position: number;
  /** `"2:255"` style key of the owning ayah. */
  verseKey: string;
  /** Private-use glyph codepoint(s) for the page-specific QCF font. */
  code: string;
  /** Real Uthmani text — used for a11y, search and clipboard, never displayed. */
  textUthmani: string;
  /** Unicode Uthmani, rendered verbatim if the page's glyph font fails. */
  textFallback: string;
  charType: CharType;
  /** Word-by-word gloss, when the upstream payload carries one. */
  translation?: string;
  transliteration?: string;
  /** Relative path of the per-word recitation clip, if available. */
  audioPath?: string;
}

export type LineKind = "ayah" | "surah-header" | "bismillah";

export interface MushafLine {
  /** 1-15, matching the printed line number on the physical page. */
  lineNumber: number;
  kind: LineKind;
  /**
   * Centered lines are the ones the printed Muṣḥaf does not stretch — the
   * closing line of a sūrah, and every line on the two opening pages.
   */
  centered: boolean;
  /** Present when `kind === "surah-header"` or `"bismillah"`. */
  surahId?: number;
  words: MushafWord[];
}

export interface VerseMeta {
  verseKey: string;
  surahId: number;
  ayahNumber: number;
  juz: number;
  hizb: number;
  rubElHizb: number;
  sajdah: number | null;
  textUthmani: string;
}

export interface MushafPage {
  pageNumber: number;
  /** Always 15 entries for pages 3–604; pages 1–2 carry their own short grid. */
  lines: MushafLine[];
  /** Ordered ayah metadata for everything visible on this page. */
  verses: VerseMeta[];
  juz: number;
  hizb: number;
  /** Sūrah ids appearing anywhere on this page, in reading order. */
  surahIds: number[];
  /** True for the two decorative opening pages, which break the 15-line grid. */
  isOpeningSpread: boolean;
  /** Ayah keys at which a new rubʿ al-ḥizb begins on this page. */
  rubMarkers: { verseKey: string; rubElHizb: number }[];
}

export interface Surah {
  id: number;
  nameSimple: string;
  nameArabic: string;
  translatedName: string;
  revelationPlace: "makkah" | "madinah";
  versesCount: number;
  bismillahPre: boolean;
  pages: [number, number];
}

export interface TranslationLine {
  verseKey: string;
  text: string;
  resourceName: string;
}

export interface Reciter {
  id: number;
  name: string;
  style?: string;
}

/** One `[wordPosition, startMs, endMs]` triple from the upstream timings. */
export type AudioSegment = [number, number, number];

export interface AyahAudio {
  verseKey: string;
  url: string;
  durationMs: number;
  segments: AudioSegment[];
}
