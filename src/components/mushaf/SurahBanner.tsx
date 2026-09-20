"use client";

import { surahNameLigature } from "@/lib/quran/fonts";

/**
 * The illuminated band that opens a sūrah.
 *
 * The title itself is drawn by the KFGQPC sūrah-name font, which resolves a
 * zero-padded chapter number through ligature substitution — `"002"` becomes
 * the calligraphic title of al-Baqarah. The filigree around it is CSS.
 */
export function SurahBanner({
  surahId,
  name,
  fontReady,
}: {
  surahId: number;
  name: string;
  fontReady: boolean;
}) {
  return (
    <div className="mushaf-line" data-centered="true" aria-hidden="true">
      <div className="relative flex w-full items-center justify-center gap-3 px-[6%]">
        <Filigree side="start" />

        <div
          className="relative flex shrink-0 items-center justify-center px-5"
          style={{ minWidth: "min(38%, 15rem)" }}
        >
          {/* A soft golden bloom sits behind the title, as gold leaf catches light. */}
          <span
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 70% 130% at 50% 50%, rgb(212 172 78 / 0.17) 0%, transparent 72%)",
            }}
          />
          {fontReady ? (
            <span
              className="surah-name-glyph text-gold-200"
              style={{
                fontSize: "calc(var(--glyph-size) * 1.34)",
                textShadow: "0 0 22px rgb(212 172 78 / 0.4)",
              }}
            >
              {surahNameLigature(surahId)}
            </span>
          ) : (
            <span
              className="text-gold-200"
              style={{ fontSize: "calc(var(--glyph-size) * 0.58)" }}
            >
              {name}
            </span>
          )}
        </div>

        <Filigree side="end" />
      </div>
    </div>
  );
}

/**
 * The tapering rule either side of the title. Two hairlines with a diamond
 * between them reads as engraved metal without needing artwork.
 */
function Filigree({ side }: { side: "start" | "end" }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {side === "end" && <Diamond />}
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="gold-rule h-px w-full opacity-70" />
        <span className="gold-rule h-px w-full opacity-35" />
      </div>
      {side === "start" && <Diamond />}
    </div>
  );
}

function Diamond() {
  return (
    <span
      className="size-1.5 shrink-0 rotate-45 bg-gold-400"
      style={{ boxShadow: "0 0 10px rgb(212 172 78 / 0.55)" }}
    />
  );
}
