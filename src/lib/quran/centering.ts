/**
 * Which printed lines sit centered rather than stretched to both margins.
 *
 * This cannot be derived from the text. QCF glyphs carry their own horizontal
 * stretching — the justification is baked into the outlines — so almost every
 * line already fills the measure exactly, including most lines that close a
 * sūrah. Only a small number of genuinely short lines are set centered by the
 * printers. Inferring "centered" from "ends a sūrah" over-centers badly.
 *
 * The table below is the V2 (1421H) Madani layout's set, matching the
 * reference web Muṣḥaf. The two opening pages are centered in their entirety.
 */

const CENTERED_PAGES = new Set([1, 2]);

const CENTERED_LINES: Record<number, readonly number[]> = {
  255: [2],
  528: [9],
  534: [6],
  545: [6],
  586: [1],
  593: [2],
  594: [5],
  600: [10],
  602: [5, 15],
  603: [10, 15],
  604: [4, 9, 14, 15],
};

export function isCenteredLine(page: number, lineNumber: number): boolean {
  if (CENTERED_PAGES.has(page)) return true;
  return CENTERED_LINES[page]?.includes(lineNumber) ?? false;
}

export function isCenteredPage(page: number): boolean {
  return CENTERED_PAGES.has(page);
}
