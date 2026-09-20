/**
 * Bake the 15-line Madani (QCF V2) page layout into a static asset.
 *
 * Why this exists: the public `api.quran.com/api/v4` host serves `line_number`
 * from more than one backing table, and the tables disagree. Identical queries
 * for page 591 returned both `[3,4,5,6,7,8,9,12,13,14,15]` and
 * `[2,3,4,5,6,7,10,11,12,13]` minutes apart — a whole line of drift, which
 * would move a sūrah header onto an occupied line. Page layout is the one
 * thing this reader promises to get exactly right, so it is resolved once,
 * here, against the host the reference client actually uses, and checked in.
 *
 * Output: src/data/mushaf-layout.json — for every page, the kind of each of
 * its 15 printed lines and how many words sit on it. At runtime the words for
 * a page are sliced into lines by those counts, so a page renders identically
 * no matter what the API says that day.
 *
 * Run: node scripts/bake-layout.mjs
 */

import { writeFile } from "node:fs/promises";

const QDC = "https://api.qurancdn.com/api/qdc";
const LAST_PAGE = 604;
const CONCURRENCY = 6;

async function getJson(url, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) return await res.json();
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
  throw lastError;
}

const chapters = (await getJson(`${QDC}/chapters?language=en`)).chapters;
const bismillahPre = new Map(chapters.map((c) => [c.id, c.bismillah_pre]));

/**
 * Fetch one page and reduce it to line kinds and word counts.
 *
 * Two corrections are applied to the raw payload:
 *  - words are kept only when their own `v2_page` claims this page, because
 *    the endpoint returns neighbours' words either side of a sūrah break;
 *  - ornamental lines are recovered from the gaps in the line numbering. The
 *    API never emits them, but a sūrah opening is always preceded by exactly
 *    the blank lines its header (and separate basmala, where printed) occupy.
 */
async function bakePage(page) {
  const body = await getJson(
    `${QDC}/verses/by_page/${page}?words=true&per_page=all&mushaf=1` +
      `&word_fields=line_number,v2_page,char_type_name&fields=text_uthmani`,
  );

  const counts = new Map();
  const starts = [];
  const seen = new Set();

  for (const verse of body.verses ?? []) {
    for (const word of verse.words) {
      if (word.v2_page !== page) continue;
      const key = `${verse.verse_key}#${word.position}`;
      if (seen.has(key)) continue;
      seen.add(key);

      counts.set(word.line_number, (counts.get(word.line_number) ?? 0) + 1);
      if (verse.verse_number === 1 && word.position === 1) {
        starts.push({
          surahId: Number(verse.verse_key.split(":")[0]),
          line: word.line_number,
        });
      }
    }
  }

  const ornaments = new Map();
  for (const start of starts) {
    const separateBasmala = bismillahPre.get(start.surahId) ?? false;
    if (separateBasmala && start.line >= 3) {
      ornaments.set(start.line - 2, { t: "s", s: start.surahId });
      ornaments.set(start.line - 1, { t: "b", s: start.surahId });
    } else if (start.line >= 2) {
      ornaments.set(start.line - 1, { t: "s", s: start.surahId });
    }
  }

  const lines = [];
  const issues = [];
  const occupiedMax = Math.max(0, ...counts.keys());
  // Pages 1–2 are the decorative opening spread and use a short grid.
  const lineCount = page <= 2 ? occupiedMax : 15;

  for (let n = 1; n <= lineCount; n += 1) {
    const ornament = ornaments.get(n);
    const wordCount = counts.get(n) ?? 0;

    if (ornament && wordCount > 0) {
      issues.push(`L${n}: ornament collides with ${wordCount} words`);
      lines.push({ t: "a", n: wordCount });
      continue;
    }
    if (ornament) {
      lines.push(ornament);
      continue;
    }
    lines.push({ t: "a", n: wordCount });
  }

  const totalWords = [...counts.values()].reduce((a, b) => a + b, 0);
  return { page, lines, totalWords, issues, verseCount: (body.verses ?? []).length };
}

const results = new Array(LAST_PAGE);
const problems = [];
let cursor = 0;
let done = 0;

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < LAST_PAGE) {
      const page = (cursor += 1);
      try {
        const baked = await bakePage(page);
        results[page - 1] = baked;
        for (const issue of baked.issues) problems.push(`p${page} ${issue}`);
      } catch (error) {
        problems.push(`p${page} FETCH FAILED: ${error.message}`);
      }
      done += 1;
      if (done % 100 === 0) process.stdout.write(`  ...${done}/${LAST_PAGE}\n`);
    }
  }),
);

/**
 * A gap we cannot explain is a layout bug and must not ship silently — but a
 * blank *final* line is real print. It occurs on the 18 pages where a sūrah
 * ends on line 14 and the next sūrah's header will not fit beneath it, so the
 * printers leave the line empty and open the sūrah overleaf (page 76 closes
 * 3:200, page 207 closes 9:129, page 584 closes 79:46). Only interior gaps
 * are reported.
 */
for (const baked of results) {
  if (!baked || baked.page <= 2) continue;
  const blanks = baked.lines
    .map((l, i) => (l.t === "a" && l.n === 0 ? i + 1 : 0))
    .filter((n) => n > 0 && n < baked.lines.length);
  if (blanks.length) {
    problems.push(`p${baked.page} unexplained blank line(s): ${blanks.join(",")}`);
  }
}

const payload = {
  mushaf: "qcf-v2",
  source: `${QDC}/verses/by_page/{page}?mushaf=1`,
  generatedAt: new Date().toISOString(),
  pages: Object.fromEntries(
    results.filter(Boolean).map((r) => [r.page, { lines: r.lines }]),
  ),
};

await writeFile(
  new URL("../src/data/mushaf-layout.json", import.meta.url),
  `${JSON.stringify(payload)}\n`,
);

const totalWords = results.reduce((a, r) => a + (r?.totalWords ?? 0), 0);
console.log(`\nbaked ${results.filter(Boolean).length}/${LAST_PAGE} pages`);
console.log(`total words: ${totalWords}`);
console.log(`problems: ${problems.length}`);
for (const problem of problems.slice(0, 30)) console.log(`  ${problem}`);
