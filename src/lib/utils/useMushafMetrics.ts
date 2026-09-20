"use client";

import { useEffect } from "react";

/**
 * The measure of the printed page, in em.
 *
 * Every full line of the QCF V2 Muṣḥaf is very nearly the same width — not by
 * coincidence but by design. Each page has its own face in which every word is
 * a single pre-shaped glyph, already stretched so the line comes out
 * justified. Measured over 453 full lines sampled across 36 pages, widths run
 * 15.31–16.06 em with a median of 15.58.
 *
 * The constant is the *maximum*, not the median, with a hair of margin: the
 * page is exactly as wide as its widest possible line, so nothing can overflow
 * and be clipped, and flex justification is left with only the fraction of an
 * em of designed slack to distribute. Sizing to the median instead clips the
 * long lines; sizing by any looser rule opens gulfs between words that the
 * printed page does not contain.
 */
const DESIGNED_LINE_WIDTH_EM = 16.1;

/**
 * Height of one line box relative to the glyph size. QCF glyphs carry their
 * marks inside their own metrics, so this is tighter than Unicode Uthmani
 * needs — enough room for the superscript alef and waqf signs, no more.
 */
const LINE_BOX_EM = 1.74;

/**
 * Size the reading surface so that fifteen lines of the printed page fit the
 * viewport without reflowing.
 *
 * The page is height-constrained on a landscape screen and width-constrained
 * on a phone; whichever binds, the result is written to CSS custom properties
 * so a resize never re-renders the React tree.
 */
export function useMushafMetrics({
  frameRef,
  cardRef,
  contentRef,
  scale,
  lineCount,
}: {
  /** The area the page is allowed to occupy. */
  frameRef: React.RefObject<HTMLElement | null>;
  /** The page itself; receives the resolved custom properties. */
  cardRef: React.RefObject<HTMLElement | null>;
  /** The text block inside the page, excluding its header and footer rails. */
  contentRef: React.RefObject<HTMLElement | null>;
  scale: number;
  lineCount: number;
}) {
  useEffect(() => {
    const frame = frameRef.current;
    const card = cardRef.current;
    if (!frame || !card) return;
    // The animated wrapper reads --page-width, so it is published on the frame
    // (a stable ancestor) rather than on the page being swapped out.
    const scope = frame;

    const apply = () => {
      const { width, height } = frame.getBoundingClientRect();
      if (width < 1 || height < 1) return;

      // Header rails, rules and the page number sit outside the text block.
      const content = contentRef.current;
      const chrome = content
        ? Math.max(0, card.getBoundingClientRect().height - content.getBoundingClientRect().height)
        : 0;

      const textHeight = Math.max(1, height - chrome);
      const lines = Math.max(lineCount, 1);

      const fromHeight = textHeight / lines / LINE_BOX_EM;
      const fromWidth = width / DESIGNED_LINE_WIDTH_EM;
      const glyph = Math.min(fromHeight, fromWidth) * scale;

      scope.style.setProperty("--glyph-size", `${glyph.toFixed(3)}px`);
      scope.style.setProperty("--line-height", String(LINE_BOX_EM));
      // The page is exactly as wide as its longest line, so justification has
      // only the designed slack to distribute — never a gulf.
      scope.style.setProperty(
        "--page-width",
        `${(glyph * DESIGNED_LINE_WIDTH_EM).toFixed(2)}px`,
      );
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(frame);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [frameRef, cardRef, contentRef, scale, lineCount]);
}
