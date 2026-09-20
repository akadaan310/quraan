import bakedLayout from "@/data/mushaf-layout.json";
import { isCenteredLine, isCenteredPage } from "./centering";
import { fetchChapters, fetchPageVerses, type RawVerse, type RawWord } from "./client";
import type {
  CharType,
  MushafLine,
  MushafPage,
  MushafWord,
  Surah,
  VerseMeta,
} from "./types";

export const FIRST_PAGE = 1;
export const LAST_PAGE = 604;
export const LINES_PER_PAGE = 15;

/**
 * The opening page of each juzʾ in the Madani Muṣḥaf. Fixed points of the
 * printed edition rather than anything derivable from verse data, so they
 * are stated outright — the one hand-maintained table in this file.
 */
export const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302,
  322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
] as const;

/** Which of the 30 ajzāʾ a page falls in, by its position among the starts. */
export function juzForPage(page: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i += 1) {
    if (JUZ_START_PAGES[i] > page) break;
    juz = i + 1;
  }
  return juz;
}

/** One printed line as resolved at build time by scripts/bake-layout.mjs. */
type BakedLine =
  | { t: "a"; n: number }
  | { t: "s"; s: number }
  | { t: "b"; s: number };

const LAYOUT = bakedLayout.pages as Record<string, { lines: BakedLine[] }>;

export function clampPage(n: number): number {
  if (!Number.isFinite(n)) return FIRST_PAGE;
  return Math.min(LAST_PAGE, Math.max(FIRST_PAGE, Math.trunc(n)));
}

function toCharType(raw: string): CharType {
  switch (raw) {
    case "word":
    case "end":
    case "pause":
    case "sajdah":
    case "rub":
      return raw;
    default:
      return "unknown";
  }
}

function toWord(raw: RawWord, verseKey: string): MushafWord {
  return {
    id: raw.id,
    position: raw.position,
    verseKey,
    code: raw.code_v2 ?? "",
    textUthmani: raw.text_uthmani ?? "",
    textFallback: raw.text_qpc_hafs ?? raw.text_uthmani ?? "",
    charType: toCharType(raw.char_type_name),
    translation: raw.translation?.text ?? undefined,
    transliteration: raw.transliteration?.text ?? undefined,
    audioPath: raw.audio_url ?? undefined,
  };
}

/**
 * Reconstruct a printed page.
 *
 * Line breaks come from the checked-in layout, not from the API. The upstream
 * `line_number` is served from more than one backing table and they disagree
 * by a whole line on some pages, which would slide a sūrah header onto an
 * occupied line. Words arrive in a stable reading order, so the baked
 * per-line word counts slice them into the printed lines deterministically.
 *
 * If the two ever diverge — an upstream text revision, say — the word counts
 * will not add up, and the page falls back to the API's own line numbers
 * rather than rendering a page whose lines are silently shifted.
 */
export async function buildMushafPage(pageNumber: number): Promise<MushafPage> {
  const page = clampPage(pageNumber);
  const [rawVerses, chapters] = await Promise.all([
    fetchPageVerses(page),
    fetchChapters(),
  ]);

  const chapterById = new Map<number, Surah>(chapters.map((c) => [c.id, c]));
  const verses: VerseMeta[] = rawVerses.map((v) => {
    const [surahId, ayah] = v.verse_key.split(":").map(Number);
    return {
      verseKey: v.verse_key,
      surahId,
      ayahNumber: ayah,
      juz: v.juz_number,
      hizb: v.hizb_number,
      rubElHizb: v.rub_el_hizb_number,
      sajdah: v.sajdah_number,
      textUthmani: v.text_uthmani,
    };
  });

  const orderedWords = rawVerses.flatMap((verse) =>
    verse.words.map((word) => toWord(word, verse.verse_key)),
  );

  const isOpeningSpread = isCenteredPage(page);
  const lines = trimOpeningSpread(
    layoutFromBaked(page, orderedWords) ??
      layoutFromApi(page, rawVerses, chapterById),
    isOpeningSpread,
  );

  return {
    pageNumber: page,
    lines,
    verses,
    juz: verses[0]?.juz ?? 1,
    hizb: verses[0]?.hizb ?? 1,
    surahIds: [...new Set(verses.map((v) => v.surahId))],
    isOpeningSpread,
    rubMarkers: collectRubMarkers(verses),
  };
}

/**
 * Pages 1 and 2 are the decorative opening spread: a short panel set inside a
 * frame, floating in the middle of the leaf rather than filling a 15-line
 * grid. The layout data records the empty lines around it, which would push
 * the panel to the foot of the page, so they are dropped and the remaining
 * lines are centered in the surface.
 */
function trimOpeningSpread(
  lines: MushafLine[],
  isOpeningSpread: boolean,
): MushafLine[] {
  if (!isOpeningSpread) return lines;
  const isBlank = (line: MushafLine) =>
    line.kind === "ayah" && line.words.length === 0;

  let start = 0;
  let end = lines.length;
  while (start < end && isBlank(lines[start])) start += 1;
  while (end > start && isBlank(lines[end - 1])) end -= 1;
  return lines.slice(start, end);
}

/** Slice the page's words into printed lines using the checked-in layout. */
function layoutFromBaked(
  page: number,
  words: MushafWord[],
): MushafLine[] | null {
  const baked = LAYOUT[String(page)];
  if (!baked) return null;

  const expected = baked.lines.reduce(
    (sum, line) => sum + (line.t === "a" ? line.n : 0),
    0,
  );
  if (expected !== words.length) return null;

  const lines: MushafLine[] = [];
  let cursor = 0;

  baked.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (line.t === "a") {
      lines.push({
        lineNumber,
        kind: "ayah",
        centered: isCenteredLine(page, lineNumber),
        words: words.slice(cursor, cursor + line.n),
      });
      cursor += line.n;
      return;
    }
    lines.push({
      lineNumber,
      kind: line.t === "s" ? "surah-header" : "bismillah",
      centered: true,
      surahId: line.s,
      words: [],
    });
  });

  return lines;
}

/**
 * Last resort when the baked layout does not match the payload. Groups words
 * by the API's own `line_number` and recovers ornamental lines from the gaps
 * above each sūrah opening.
 */
function layoutFromApi(
  page: number,
  rawVerses: RawVerse[],
  chapterById: Map<number, Surah>,
): MushafLine[] {
  const byLine = new Map<number, MushafWord[]>();
  for (const verse of rawVerses) {
    for (const raw of verse.words) {
      const bucket = byLine.get(raw.line_number);
      const word = toWord(raw, verse.verse_key);
      if (bucket) bucket.push(word);
      else byLine.set(raw.line_number, [word]);
    }
  }

  const ornaments = new Map<number, { kind: "surah-header" | "bismillah"; surahId: number }>();
  for (const verse of rawVerses) {
    if (verse.verse_number !== 1) continue;
    const surahId = Number(verse.verse_key.split(":")[0]);
    const firstLine = verse.words[0]?.line_number;
    if (!firstLine) continue;

    if ((chapterById.get(surahId)?.bismillahPre ?? false) && firstLine >= 3) {
      ornaments.set(firstLine - 2, { kind: "surah-header", surahId });
      ornaments.set(firstLine - 1, { kind: "bismillah", surahId });
    } else if (firstLine >= 2) {
      ornaments.set(firstLine - 1, { kind: "surah-header", surahId });
    }
  }

  const lines: MushafLine[] = [];
  for (let n = 1; n <= LINES_PER_PAGE; n += 1) {
    const ornament = ornaments.get(n);
    if (ornament) {
      lines.push({
        lineNumber: n,
        kind: ornament.kind,
        centered: true,
        surahId: ornament.surahId,
        words: [],
      });
      continue;
    }
    lines.push({
      lineNumber: n,
      kind: "ayah",
      centered: isCenteredLine(page, n),
      words: byLine.get(n) ?? [],
    });
  }
  return lines;
}

function collectRubMarkers(verses: VerseMeta[]) {
  const markers: { verseKey: string; rubElHizb: number }[] = [];
  let previous: number | null = null;
  for (const v of verses) {
    if (previous !== null && v.rubElHizb !== previous) {
      markers.push({ verseKey: v.verseKey, rubElHizb: v.rubElHizb });
    }
    previous = v.rubElHizb;
  }
  return markers;
}

/** Zero-padded page number, e.g. `604` → `"604"`, `7` → `"007"`. */
export function padPage(page: number): string {
  return String(page).padStart(3, "0");
}
