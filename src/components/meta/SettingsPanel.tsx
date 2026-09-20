"use client";

import { MetaPanel } from "./MetaPanel";
import type { Reciter } from "@/lib/quran/types";

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
  onChange: {
    translationId: (value: number) => void;
    reciterId: (value: number) => void;
    glyphScale: (value: number) => void;
    ambience: (value: boolean) => void;
    unicodeMode: (value: boolean) => void;
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
