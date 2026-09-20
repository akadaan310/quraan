import type {
  AyahAudio,
  Reciter,
  Surah,
  TranslationLine,
} from "./types";

/**
 * Thin, cached wrapper over the Quran.com v4 REST API.
 *
 * Every helper here runs on the server. Muṣḥaf content is immutable, so
 * responses are cached aggressively and shared across all readers; only the
 * resource catalogues (translations, reciters) get a shorter window.
 */

/**
 * Text and translations come from the host the reference web client uses.
 * The older public `api.quran.com/api/v4` host serves page layout from more
 * than one backing table and the tables disagree (see scripts/bake-layout.mjs),
 * so it is used only for audio, where a stale timing costs nothing.
 */
export const CONTENT_API = "https://api.qurancdn.com/api/qdc";
export const AUDIO_API = "https://api.quran.com/api/v4";
export const AUDIO_CDN = "https://verses.quran.com";

/** Content that will never change — cache for a year. */
const IMMUTABLE = 31_536_000;
/** Catalogues that occasionally gain entries — cache for a day. */
const CATALOGUE = 86_400;

class QuranApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
  ) {
    super(`Quran API ${status} for ${path}`);
    this.name = "QuranApiError";
  }
}

async function request<T>(
  host: string,
  path: string,
  revalidate: number,
): Promise<T> {
  const res = await fetch(`${host}${path}`, {
    next: { revalidate },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new QuranApiError(path, res.status);
  return (await res.json()) as T;
}

const get = <T>(path: string, revalidate: number) =>
  request<T>(CONTENT_API, path, revalidate);

const getAudio = <T>(path: string, revalidate: number) =>
  request<T>(AUDIO_API, path, revalidate);

/* ------------------------------------------------------------------ *
 * Raw upstream shapes (only the fields we actually consume)
 * ------------------------------------------------------------------ */

export interface RawWord {
  id: number;
  position: number;
  char_type_name: string;
  code_v2: string | null;
  text_uthmani: string | null;
  /** Unicode Uthmani fallback, used when the page's glyph font fails to load. */
  text_qpc_hafs: string | null;
  line_number: number;
  /**
   * The page this word is printed on *in the V2 layout*. It does not always
   * agree with the endpoint the word arrived from — see `fetchPageVerses`.
   */
  v2_page: number;
  audio_url: string | null;
  translation?: { text: string | null };
  transliteration?: { text: string | null };
}

export interface RawVerse {
  verse_key: string;
  verse_number: number;
  juz_number: number;
  hizb_number: number;
  rub_el_hizb_number: number;
  sajdah_number: number | null;
  text_uthmani: string;
  words: RawWord[];
}

const PAGE_WORD_FIELDS = [
  "code_v2",
  "line_number",
  "char_type_name",
  "text_uthmani",
  "text_qpc_hafs",
  "v2_page",
  "audio_url",
].join(",");

async function fetchVersesForEndpoint(pageNumber: number): Promise<RawVerse[]> {
  const body = await get<{ verses?: RawVerse[] }>(
    `/verses/by_page/${pageNumber}?words=true&per_page=all&mushaf=1` +
      `&word_fields=${PAGE_WORD_FIELDS}&fields=text_uthmani` +
      `&word_translation_language=en`,
    IMMUTABLE,
  );
  return body.verses ?? [];
}

/**
 * Every ayah printed on Muṣḥaf page `pageNumber`, with per-word glyph codes.
 *
 * `by_page/N` is keyed on a page index that does not always agree with the V2
 * layout the glyph fonts are cut for. Through the thirtieth juzʾ in particular,
 * the endpoint returns words printed on N±1 while words genuinely belonging to
 * N arrive only from a neighbouring endpoint — on page 591 that is 25 of 150
 * words. (`filter_page_words=true`, which the reference client sends, is
 * accepted but has no effect on this host; it was measured, not assumed.)
 *
 * Each word carries its own authoritative `v2_page`, so query the three
 * adjacent endpoints and keep exactly the words that claim this page.
 */
export async function fetchPageVerses(pageNumber: number): Promise<RawVerse[]> {
  const neighbours = [pageNumber - 1, pageNumber, pageNumber + 1].filter(
    (p) => p >= 1 && p <= 604,
  );
  const batches = await Promise.all(neighbours.map(fetchVersesForEndpoint));

  const byKey = new Map<string, RawVerse>();
  for (const verse of batches.flat()) {
    const words = verse.words.filter((w) => w.v2_page === pageNumber);
    if (words.length === 0) continue;

    const existing = byKey.get(verse.verse_key);
    if (!existing) {
      byKey.set(verse.verse_key, { ...verse, words });
      continue;
    }
    // The same ayah can arrive from two endpoints; union its words by position.
    const seen = new Set(existing.words.map((w) => w.position));
    existing.words.push(...words.filter((w) => !seen.has(w.position)));
  }

  const verses = [...byKey.values()];
  for (const verse of verses) {
    verse.words.sort((a, b) => a.position - b.position);
  }
  return verses.sort(compareVerseKeys);
}

function compareVerseKeys(a: RawVerse, b: RawVerse): number {
  const [aSurah, aAyah] = a.verse_key.split(":").map(Number);
  const [bSurah, bAyah] = b.verse_key.split(":").map(Number);
  return aSurah - bSurah || aAyah - bAyah;
}

export async function fetchChapters(): Promise<Surah[]> {
  const body = await get<{
    chapters: {
      id: number;
      name_simple: string;
      name_arabic: string;
      revelation_place: "makkah" | "madinah";
      verses_count: number;
      bismillah_pre: boolean;
      pages: [number, number];
      translated_name: { name: string };
    }[];
  }>("/chapters?language=en", IMMUTABLE);

  return body.chapters.map((c) => ({
    id: c.id,
    nameSimple: c.name_simple,
    nameArabic: c.name_arabic,
    translatedName: c.translated_name.name,
    revelationPlace: c.revelation_place,
    versesCount: c.verses_count,
    bismillahPre: c.bismillah_pre,
    pages: c.pages,
  }));
}

export async function fetchTranslationsCatalogue(): Promise<
  { id: number; name: string; authorName: string; languageName: string }[]
> {
  const body = await get<{
    translations: {
      id: number;
      name: string;
      author_name: string;
      language_name: string;
    }[];
  }>("/resources/translations", CATALOGUE);

  return body.translations.map((t) => ({
    id: t.id,
    name: t.name,
    authorName: t.author_name,
    languageName: t.language_name,
  }));
}

export async function fetchReciters(): Promise<Reciter[]> {
  // Reciter and audio endpoints live only on the v4 host.
  const body = await getAudio<{
    recitations: { id: number; reciter_name: string; style: string | null }[];
  }>("/resources/recitations?language=en", CATALOGUE);

  return body.recitations.map((r) => ({
    id: r.id,
    name: r.reciter_name,
    style: r.style ?? undefined,
  }));
}

/** Translation lines for one printed page, in reading order. */
export async function fetchPageTranslation(
  pageNumber: number,
  translationId: number,
): Promise<TranslationLine[]> {
  const body = await get<{
    verses?: {
      verse_key: string;
      translations: { text: string; resource_name?: string }[];
    }[];
  }>(
    `/verses/by_page/${pageNumber}?per_page=all&mushaf=1` +
      `&translations=${translationId}&fields=text_uthmani`,
    IMMUTABLE,
  );
  const verses = body.verses ?? [];

  return verses.map((v) => ({
    verseKey: v.verse_key,
    text: stripFootnotes(v.translations?.[0]?.text ?? ""),
    resourceName: v.translations?.[0]?.resource_name ?? "",
  }));
}

/**
 * Translations embed `<sup foot_note=...>` markers that are meaningless
 * without the footnote bodies; drop them rather than render dangling digits.
 */
function stripFootnotes(html: string): string {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Per-ayah recitation audio for one page, including word-level timings. */
export async function fetchPageAudio(
  pageNumber: number,
  reciterId: number,
): Promise<AyahAudio[]> {
  const body = await getAudio<{
    audio_files?: {
      verse_key: string;
      url: string;
      duration: number;
      segments?: number[][];
    }[];
  }>(
    `/recitations/${reciterId}/by_page/${pageNumber}?per_page=all&fields=segments,duration`,
    IMMUTABLE,
  );
  const files = body.audio_files ?? [];

  return files.map((f) => ({
    verseKey: f.verse_key,
    url: `${AUDIO_CDN}/${f.url}`,
    durationMs: Math.round((f.duration ?? 0) * 1000),
    // Upstream tuples are [segmentIndex, wordPosition, startMs, endMs], timed
    // against the per-ayah file. The leading index is redundant for playback.
    // The feed contains genuinely malformed rows (stray 1- and 2-element
    // tuples), so length is checked rather than trusted.
    segments: (f.segments ?? [])
      .filter((s) => s.length >= 4 && s.every(Number.isFinite))
      .map((s) => [s[1], Math.round(s[2]), Math.round(s[3])] as [number, number, number]),
  }));
}
