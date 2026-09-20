/**
 * Bake every deep-layer dataset the reader uses offline.
 *
 * The reader must work with no network, so nothing here is computed at
 * runtime: morphology, verse embeddings, phonetic profiles and symmetry
 * measurements are all resolved once, chunked per page where they are read
 * per page, and written into public/data.
 *
 * Run: node scripts/bake-corpus.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseMorphology, stemOf } from "./lib/morphology.mjs";
import {
  buildEmbeddings,
  buildRootIndex,
  compareVerseKeys,
  quantize,
} from "./lib/embeddings.mjs";
import { profilePage, profileVerse } from "./lib/phonetics.mjs";
import { analyseSymmetry, MUQATTAAT } from "./lib/symmetry.mjs";
import { packPage } from "./lib/pack.mjs";
import { resolveConcepts } from "./lib/concepts.mjs";
import { buildJuzBalance, buildSymmetryAnomalies } from "./lib/structure.mjs";

const QDC = "https://api.qurancdn.com/api/qdc";
const LAST_PAGE = 604;
const OUT = new URL("../public/data/", import.meta.url);
const CACHE = new URL("../.cache/", import.meta.url);

/**
 * The Quranic Arabic Corpus morphology, via a cleaned mirror of the same
 * data. It is GNU GPL and is not covered by this repository's licence — see
 * README. Cached locally so a rebuild does not re-download 6 MB.
 */
const MORPHOLOGY_URL =
  "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt";

async function getMorphologySource() {
  await mkdir(CACHE, { recursive: true });
  const cached = new URL("quran-morphology.txt", CACHE);
  if (existsSync(cached)) return readFile(cached, "utf8");

  process.stdout.write("  downloading morphology corpus…\n");
  const res = await fetch(MORPHOLOGY_URL);
  if (!res.ok) throw new Error(`morphology download failed: HTTP ${res.status}`);
  const text = await res.text();
  await writeFile(cached, text);
  return text;
}

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
    await new Promise((r) => setTimeout(r, 350 * 2 ** attempt));
  }
  throw lastError;
}

/* ------------------------------------------------------------------ *
 * 1. Which verses sit on which printed page
 * ------------------------------------------------------------------ */

async function bakePageIndex() {
  const cached = new URL("page-verses.json", CACHE);
  if (existsSync(cached)) return JSON.parse(await readFile(cached, "utf8"));

  const pages = {};
  let cursor = 0;
  let done = 0;

  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (cursor < LAST_PAGE) {
        const page = (cursor += 1);
        const body = await getJson(
          `${QDC}/verses/by_page/${page}?words=true&per_page=all&mushaf=1` +
            `&word_fields=v2_page&fields=text_uthmani`,
        );
        // A verse counts as on this page if any of its words is printed here.
        const keys = [];
        for (const verse of body.verses ?? []) {
          if (verse.words.some((w) => w.v2_page === page)) keys.push(verse.verse_key);
        }
        pages[page] = keys.sort(compareVerseKeys);
        done += 1;
        if (done % 120 === 0) process.stdout.write(`    ${done}/${LAST_PAGE}\n`);
      }
    }),
  );

  await writeFile(cached, JSON.stringify(pages));
  return pages;
}

/** Uthmani text per verse, needed for the phonetic pass. */
async function getVerseTexts() {
  const cached = new URL("verse-text.json", CACHE);
  if (existsSync(cached)) return JSON.parse(await readFile(cached, "utf8"));

  const texts = {};
  for (let surah = 1; surah <= 114; surah += 1) {
    const body = await getJson(
      `${QDC}/verses/by_chapter/${surah}?per_page=all&fields=text_uthmani`,
    );
    for (const verse of body.verses ?? []) texts[verse.verse_key] = verse.text_uthmani;
    if (surah % 30 === 0) process.stdout.write(`    sūrah ${surah}/114\n`);
  }
  await writeFile(cached, JSON.stringify(texts));
  return texts;
}

/* ------------------------------------------------------------------ *
 * Bake
 * ------------------------------------------------------------------ */

console.log("Celestial Muṣḥaf — baking deep-layer corpus\n");

console.log("[1/6] morphology corpus");
const morphology = parseMorphology(await getMorphologySource());
console.log(`      ${Object.keys(morphology).length} verses parsed`);

console.log("[2/6] page index");
const pageVerses = await bakePageIndex();

console.log("[3/6] verse text");
const verseTexts = await getVerseTexts();

console.log("[4/6] root index and embeddings");
const index = buildRootIndex(morphology);
const embeddings = buildEmbeddings(index);
const versePosition = new Map(index.verseKeys.map((k, i) => [k, i]));
console.log(
  `      ${index.vocabulary.length} roots → ${embeddings.dimensions} dimensions`,
);

console.log("[5/6] phonetic profiles");
const verseProfiles = {};
for (const [verseKey, text] of Object.entries(verseTexts)) {
  verseProfiles[verseKey] = profileVerse(text);
}

console.log("[6/6] symmetry");
const versesBySurah = new Map();
for (const verseKey of index.verseKeys) {
  const surah = Number(verseKey.split(":")[0]);
  const roots = new Set();
  for (const word of morphology[verseKey] ?? []) {
    for (const segment of word.segments) if (segment.root) roots.add(segment.root);
  }
  if (!versesBySurah.has(surah)) versesBySurah.set(surah, []);
  versesBySurah.get(surah).push({ verseKey, roots });
}

const symmetry = {};
for (const [surah, verses] of versesBySurah) {
  const analysis = analyseSymmetry(verses);
  if (analysis) symmetry[surah] = { ...analysis, muqattaat: MUQATTAAT[surah] ?? null };
}

const { concepts, warnings: conceptWarnings } = resolveConcepts(index);
for (const warning of conceptWarnings) console.warn(`      ! ${warning}`);
console.log(`      ${concepts.length} concepts resolved`);

const juzBalance = buildJuzBalance(pageVerses, morphology);
const symmetryAnomalies = buildSymmetryAnomalies(symmetry);

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

await mkdir(new URL("morphology/", OUT), { recursive: true });
await mkdir(new URL("semantic/", OUT), { recursive: true });

let morphologyBytes = 0;
for (let page = 1; page <= LAST_PAGE; page += 1) {
  const chunk = {};
  for (const verseKey of pageVerses[page] ?? []) {
    const words = morphology[verseKey];
    if (words) chunk[verseKey] = words;
  }
  const json = JSON.stringify(packPage(chunk));
  morphologyBytes += json.length;
  await writeFile(new URL(`morphology/p${page}.json`, OUT), json);
}

// Verse vectors as a flat int8 block, indexed by the order in meta.verseKeys.
const quantized = quantize(embeddings.verseVectors);
await writeFile(new URL("semantic/verse-vectors.i8", OUT), Buffer.from(quantized.buffer));

/**
 * The most frequent English gloss of each root's words, harvested from the
 * word-by-word translations. It is what lets the constellation view name the
 * thread it drew instead of showing a bare root.
 */
console.log("      harvesting root glosses…");
const glossCounts = new Map();
for (let page = 1; page <= LAST_PAGE; page += 1) {
  // Reuse the page fetch already cached by the layout bake where possible.
  if (page % 60 === 0) process.stdout.write(`        ${page}/${LAST_PAGE}\n`);
  let body;
  try {
    body = await getJson(
      `${QDC}/verses/by_page/${page}?words=true&per_page=all&mushaf=1` +
        `&word_fields=v2_page,char_type_name&word_translation_language=en`,
    );
  } catch {
    continue;
  }
  for (const verse of body.verses ?? []) {
    const words = morphology[verse.verse_key];
    if (!words) continue;
    const real = verse.words.filter((w) => w.char_type_name === "word");
    real.forEach((apiWord, i) => {
      const gloss = apiWord.translation?.text;
      const root = words[i] ? stemOf(words[i])?.root : null;
      if (!gloss || !root) return;
      if (!glossCounts.has(root)) glossCounts.set(root, new Map());
      const bucket = glossCounts.get(root);
      bucket.set(gloss, (bucket.get(gloss) ?? 0) + 1);
    });
  }
}

const rootGloss = {};
for (const [root, bucket] of glossCounts) {
  const [best] = [...bucket.entries()].sort((a, b) => b[1] - a[1]);
  if (best) rootGloss[root] = best[0];
}

await writeFile(
  new URL("semantic/meta.json", OUT),
  JSON.stringify({
    dimensions: embeddings.dimensions,
    scale: 127,
    verseKeys: index.verseKeys,
    placed: Array.from(embeddings.placed),
    vocabulary: index.vocabulary,
    idf: Array.from(index.idf, (v) => Math.round(v * 1000) / 1000),
    documentFrequency: Array.from(index.documentFrequency),
    gloss: rootGloss,
  }),
);

// Roots per verse, as vocabulary indices — the explainable half of a link.
const verseRootsByPage = {};
for (let page = 1; page <= LAST_PAGE; page += 1) {
  const chunk = {};
  for (const verseKey of pageVerses[page] ?? []) {
    const position = versePosition.get(verseKey);
    if (position === undefined) continue;
    chunk[verseKey] = [...new Set(index.verseRoots[position])];
  }
  verseRootsByPage[page] = chunk;
}
await writeFile(
  new URL("semantic/verse-roots.json", OUT),
  JSON.stringify(verseRootsByPage),
);

const pageProfiles = {};
for (let page = 1; page <= LAST_PAGE; page += 1) {
  const profiles = (pageVerses[page] ?? [])
    .map((key) => verseProfiles[key])
    .filter(Boolean);
  pageProfiles[page] = profilePage(profiles);
}
await writeFile(
  new URL("phonetics.json", OUT),
  JSON.stringify({ pages: pageProfiles, verses: verseProfiles }),
);

await writeFile(new URL("symmetry.json", OUT), JSON.stringify(symmetry));
await writeFile(new URL("page-verses.json", OUT), JSON.stringify(pageVerses));
await writeFile(new URL("concepts.json", OUT), JSON.stringify(concepts));
await writeFile(
  new URL("structure.json", OUT),
  JSON.stringify({ juz: juzBalance, anomalies: symmetryAnomalies }),
);

const strengths = Object.values(symmetry).reduce((acc, s) => {
  acc[s.strength] = (acc[s.strength] ?? 0) + 1;
  return acc;
}, {});

console.log("\nwritten to public/data:");
console.log(`  morphology/     604 chunks, ${(morphologyBytes / 1e6).toFixed(1)} MB total`);
console.log(`  semantic/       ${quantized.length} int8 (${(quantized.length / 1e3).toFixed(0)} KB) + meta`);
console.log(`  root glosses    ${Object.keys(rootGloss).length}`);
console.log(`  phonetics.json  604 pages, ${Object.keys(verseProfiles).length} verses`);
console.log(`  symmetry.json   ${Object.keys(symmetry).length} sūrahs — ${JSON.stringify(strengths)}`);
