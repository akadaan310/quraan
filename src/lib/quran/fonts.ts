import { padPage } from "./layout";

/**
 * QCF (King Fahd Glyph Code) v2 ships one font per printed page. Each font
 * contains only the glyphs that page needs, mapped into the private use area,
 * which is why the glyph codes must never be rendered with a fallback family —
 * a miss would paint unrelated characters rather than tofu.
 */
export const GLYPH_FONT_CDN =
  "https://static.qurancdn.com/fonts/quran/hafs/v2/woff2";

export const SURAH_NAME_FONT_URL =
  "https://static.qurancdn.com/fonts/quran/surah-names/v2/sura_names.woff2";

export function glyphFontFamily(page: number): string {
  return `QCF2${padPage(page)}`;
}

export function glyphFontUrl(page: number): string {
  return `${GLYPH_FONT_CDN}/p${page}.woff2`;
}

/**
 * `font-display: block` is deliberate. Any swap period would flash private-use
 * codepoints through a fallback family, which renders as unrelated Arabic —
 * far worse than a brief blank line.
 */
export function glyphFontFace(page: number): string {
  return `@font-face{font-family:"${glyphFontFamily(page)}";src:url("${glyphFontUrl(
    page,
  )}") format("woff2");font-display:block;font-weight:normal;font-style:normal;}`;
}

/**
 * The sūrah-name font resolves a zero-padded chapter number through `liga`
 * substitutions, so `"002"` paints the calligraphic title of al-Baqarah.
 */
export function surahNameLigature(surahId: number): string {
  return String(surahId).padStart(3, "0");
}
