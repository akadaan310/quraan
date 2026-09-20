"use client";

/**
 * The basmala printed beneath a sūrah header.
 *
 * It is not part of the ayah text for these sūrahs, so it has no glyph codes
 * of its own in the page font. It is rendered from Unicode in the Uthmani
 * fallback face, sized to sit a little below the weight of the body text.
 */
const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export function BismillahLine() {
  return (
    <div className="mushaf-line" data-centered="true">
      <span
        lang="ar"
        dir="rtl"
        className="text-gold-100/90"
        style={{
          fontFamily: '"UthmanicHafs", "Times New Roman", serif',
          fontSize: "calc(var(--glyph-size) * 0.84)",
          fontFeatureSettings: '"rlig" 1, "calt" 1, "mark" 1, "mkmk" 1',
          textShadow: "0 0 24px rgb(232 201 119 / 0.3)",
        }}
      >
        {BASMALA}
      </span>
    </div>
  );
}
