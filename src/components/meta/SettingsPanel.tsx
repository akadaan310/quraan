"use client";

import { useState } from "react";

import { MetaPanel } from "./MetaPanel";
import { ShieldIcon } from "./icons";
import type { Reciter } from "@/lib/quran/types";
import type { Constellation } from "@/lib/deep/types";

interface TranslationOption {
  id: number;
  name: string;
  authorName: string;
}

export function SettingsPanel({
  open,
  onClose,
  translations,
  reciters,
  translationId,
  reciterId,
  glyphScale,
  ambience,
  unicodeMode,
  deepLayers,
  ledgerAvailable,
  ledgerEvents,
  lexicalPrism,
  tempo,
  resonance,
  onForget,
  onOpenVerse,
  gloss,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  translations: TranslationOption[];
  reciters: Reciter[];
  translationId: number;
  reciterId: number;
  glyphScale: number;
  ambience: boolean;
  unicodeMode: boolean;
  deepLayers: boolean;
  ledgerAvailable: boolean;
  ledgerEvents: number;
  lexicalPrism: { root: string; count: number }[];
  /** Mean seconds per page, this reader's own tempo. */
  tempo: number;
  resonance: Constellation[];
  onForget: () => void;
  onOpenVerse: (page: number, verseKey: string) => void;
  gloss: (root: string) => string | undefined;
  onChange: {
    translationId: (value: number) => void;
    reciterId: (value: number) => void;
    glyphScale: (value: number) => void;
    ambience: (value: boolean) => void;
    unicodeMode: (value: boolean) => void;
    deepLayers: (value: boolean) => void;
  };
}) {
  return (
    <MetaPanel open={open} title="Settings" onClose={onClose}>
      <div className="space-y-6">
        <Field label="Text size">
          <input
            type="range"
            min={0.82}
            max={1.3}
            step={0.02}
            value={glyphScale}
            onChange={(event) => onChange.glyphScale(Number(event.target.value))}
            className="w-full accent-[#d4ac4e]"
            aria-label="Text size"
          />
          <p className="mt-1 text-[0.66rem] text-gold-300/40">
            The fifteen-line grid is preserved at every size.
          </p>
        </Field>

        <Field label="Translation">
          <Select
            value={translationId}
            onChange={onChange.translationId}
            options={translations.map((t) => ({
              value: t.id,
              label: `${t.name} — ${t.authorName}`,
            }))}
          />
        </Field>

        <Field label="Reciter">
          <Select
            value={reciterId}
            onChange={onChange.reciterId}
            options={reciters.map((r) => ({
              value: r.id,
              label: r.style ? `${r.name} (${r.style})` : r.name,
            }))}
          />
        </Field>

        <Toggle
          label="Ambient starlight"
          description="Slow-drifting motes behind the page."
          checked={ambience}
          onChange={onChange.ambience}
        />

        <Toggle
          label="Unicode text"
          description="Selectable, resizable script instead of the page-faithful glyphs. Loses exact line breaks."
          checked={unicodeMode}
          onChange={onChange.unicodeMode}
        />

        <Toggle
          label="Deep layers"
          description="Word grammar, thematic constellations, structural symmetry, and the local ledger that personalises them."
          checked={deepLayers}
          onChange={onChange.deepLayers}
        />

        {deepLayers && (
          <PrivacySection
            available={ledgerAvailable}
            events={ledgerEvents}
            lexicalPrism={lexicalPrism}
            tempo={tempo}
            resonance={resonance}
            onForget={onForget}
            onOpenVerse={onOpenVerse}
            gloss={gloss}
          />
        )}
      </div>
    </MetaPanel>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[0.66rem] tracking-[0.18em] text-gold-300/60 uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full rounded-lg border border-gold-400/18 bg-obsidian/70 px-3 py-2 text-sm text-ink outline-none focus:border-gold-400/45"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked
            ? "border-gold-400/55 bg-gold-400/30"
            : "border-gold-400/18 bg-slate-veil"
        }`}
      >
        <span
          className={`block size-3.5 rounded-full bg-gold-200 transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
          style={{ boxShadow: "0 0 8px rgb(212 172 78 / 0.5)" }}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-[0.68rem] leading-snug text-gold-300/45">
          {description}
        </span>
      </span>
    </label>
  );
}

/**
 * What the device knows, shown to the person it knows it about.
 *
 * A reader should be able to see the whole of their own profile in one place
 * and delete it in one action. Nothing here has ever been transmitted — the
 * panel says so, and the claim is checkable: there is no network code in the
 * ledger.
 */
function PrivacySection({
  available,
  events,
  lexicalPrism,
  tempo,
  resonance,
  onForget,
  onOpenVerse,
  gloss,
}: {
  available: boolean;
  events: number;
  lexicalPrism: { root: string; count: number }[];
  tempo: number;
  resonance: Constellation[];
  onForget: () => void;
  onOpenVerse: (page: number, verseKey: string) => void;
  gloss: (root: string) => string | undefined;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-xl border border-gold-400/14 p-3.5">
      <div className="flex items-center gap-2 text-gold-200/80">
        <ShieldIcon />
        <p className="text-[0.66rem] tracking-[0.16em] uppercase">On this device</p>
      </div>

      {!available ? (
        <p className="mt-2 text-[0.7rem] leading-relaxed text-gold-300/45">
          Storage is unavailable here, so nothing is being remembered. The
          reader works exactly the same; it simply starts fresh each time.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-gold-300/55">
            {events.toLocaleString()} moments recorded, encrypted at rest.
            {tempo > 0 && ` About ${tempo.toFixed(0)}s on a page.`} None of it
            has left this device — there is nowhere for it to go.
          </p>

          {lexicalPrism.length > 0 && (
            <div className="mt-3">
              <p className="text-[0.58rem] tracking-[0.14em] text-gold-300/40 uppercase">
                Your lexical prism
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {lexicalPrism.slice(0, 8).map((entry) => (
                  <li
                    key={entry.root}
                    className="rounded-md bg-gold-400/10 px-2 py-1 text-[0.66rem] text-gold-100"
                    title={gloss(entry.root) ?? entry.root}
                  >
                    <span lang="ar" dir="rtl" style={{ fontFamily: '"UthmanicHafs", serif' }}>
                      {entry.root}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resonance.length > 0 && (
            <div className="mt-3">
              <p className="text-[0.58rem] tracking-[0.14em] text-gold-300/40 uppercase">
                Resonant with your reading
              </p>
              <ul className="mt-1.5 space-y-1">
                {resonance.slice(0, 4).map((link) => (
                  <li key={link.verseKey}>
                    <button
                      type="button"
                      onClick={() => onOpenVerse(link.page, link.verseKey)}
                      className="w-full rounded-md px-2 py-1 text-left text-[0.7rem] tabular-nums text-ink/80 transition-colors hover:bg-gold-400/10"
                    >
                      {link.verseKey}
                      <span className="ml-2 text-gold-300/40">page {link.page}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (confirming) {
                onForget();
                setConfirming(false);
              } else {
                setConfirming(true);
              }
            }}
            onBlur={() => setConfirming(false)}
            className={`mt-3.5 w-full rounded-lg border px-3 py-2 text-[0.72rem] transition-colors ${
              confirming
                ? "border-red-400/40 bg-red-400/10 text-red-200"
                : "border-gold-400/20 text-gold-200/70 hover:border-gold-400/40 hover:text-gold-100"
            }`}
          >
            {confirming ? "Tap again to erase permanently" : "Forget everything"}
          </button>
        </>
      )}
    </div>
  );
}
