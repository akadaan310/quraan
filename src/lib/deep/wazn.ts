import type { Segment } from "./types";

/**
 * Classical verb-measure (وزن) naming.
 *
 * Every derived Arabic verb form (II–X) has a fixed, rule-governed template —
 * this is standard sarf, not something inferred from the corpus. Given the
 * verb form the morphology already carries (QAC's `VF:` tag), the template
 * name is a deterministic lookup, not a guess. Nominal participle patterns
 * (فَاعِل / مَفْعُول and their derived-form equivalents) follow the same
 * fixed rule from the already-tagged `verbForm` + active/passive tag.
 */

interface Wazn {
  name: string;
  template: string;
  translit: string;
}

/** Perfect-tense templates. Form I is unmarked in the corpus; treated as 1. */
const VERB_MEASURES: Record<number, Wazn> = {
  1: { name: "Form I", template: "فَعَلَ", translit: "faʿala" },
  2: { name: "Form II", template: "فَعَّلَ", translit: "faʿʿala" },
  3: { name: "Form III", template: "فَاعَلَ", translit: "fāʿala" },
  4: { name: "Form IV", template: "أَفْعَلَ", translit: "afʿala" },
  5: { name: "Form V", template: "تَفَعَّلَ", translit: "tafaʿʿala" },
  6: { name: "Form VI", template: "تَفَاعَلَ", translit: "tafāʿala" },
  7: { name: "Form VII", template: "اِنْفَعَلَ", translit: "infaʿala" },
  8: { name: "Form VIII", template: "اِفْتَعَلَ", translit: "iftaʿala" },
  9: { name: "Form IX", template: "اِفْعَلَّ", translit: "ifʿalla" },
  10: { name: "Form X", template: "اِسْتَفْعَلَ", translit: "istafʿala" },
};

/** Active-participle templates by form. */
const ACTIVE_PARTICIPLES: Record<number, Wazn> = {
  1: { name: "Active participle", template: "فَاعِل", translit: "fāʿil" },
  2: { name: "Active participle (Form II)", template: "مُفَعِّل", translit: "mufaʿʿil" },
  3: { name: "Active participle (Form III)", template: "مُفَاعِل", translit: "mufāʿil" },
  4: { name: "Active participle (Form IV)", template: "مُفْعِل", translit: "mufʿil" },
  5: { name: "Active participle (Form V)", template: "مُتَفَعِّل", translit: "mutafaʿʿil" },
  6: { name: "Active participle (Form VI)", template: "مُتَفَاعِل", translit: "mutafāʿil" },
  7: { name: "Active participle (Form VII)", template: "مُنْفَعِل", translit: "munfaʿil" },
  8: { name: "Active participle (Form VIII)", template: "مُفْتَعِل", translit: "muftaʿil" },
  9: { name: "Active participle (Form IX)", template: "مُفْعَلّ", translit: "mufʿall" },
  10: { name: "Active participle (Form X)", template: "مُسْتَفْعِل", translit: "mustafʿil" },
};

/** Passive-participle templates by form. Form IX has none in productive use. */
const PASSIVE_PARTICIPLES: Record<number, Wazn> = {
  1: { name: "Passive participle", template: "مَفْعُول", translit: "mafʿūl" },
  2: { name: "Passive participle (Form II)", template: "مُفَعَّل", translit: "mufaʿʿal" },
  3: { name: "Passive participle (Form III)", template: "مُفَاعَل", translit: "mufāʿal" },
  4: { name: "Passive participle (Form IV)", template: "مُفْعَل", translit: "mufʿal" },
  5: { name: "Passive participle (Form V)", template: "مُتَفَعَّل", translit: "mutafaʿʿal" },
  6: { name: "Passive participle (Form VI)", template: "مُتَفَاعَل", translit: "mutafāʿal" },
  8: { name: "Passive participle (Form VIII)", template: "مُفْتَعَل", translit: "muftaʿal" },
  10: { name: "Passive participle (Form X)", template: "مُسْتَفْعَل", translit: "mustafʿal" },
};

/**
 * The wazn for one morphological segment, or null when the segment is not a
 * verb or participle (particles, plain nouns, pronouns — nothing here claims
 * a measure for those).
 */
export function waznFor(segment: Segment): Wazn | null {
  const form = segment.verbForm ?? 1;
  if (segment.pos === "verbal") return VERB_MEASURES[form] ?? null;
  if (segment.tags.includes("active participle")) return ACTIVE_PARTICIPLES[form] ?? null;
  if (segment.tags.includes("passive participle")) return PASSIVE_PARTICIPLES[form] ?? null;
  return null;
}
