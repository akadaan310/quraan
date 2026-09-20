/**
 * The same juzʾ-start table as src/lib/quran/layout.ts. Duplicated rather
 * than imported: this script runs under plain Node ESM at build time, and
 * the client copy lives in a Next.js/TypeScript module tree with its own
 * import graph. Both are the same fixed fact about the printed edition, so a
 * change to one is a change that must be made to both.
 */
export const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302,
  322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export function juzForPage(page) {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i += 1) {
    if (JUZ_START_PAGES[i] > page) break;
    juz = i + 1;
  }
  return juz;
}
