/** Grammatical description of one segment of a word. */
export interface Segment {
  text: string;
  pos: "particle" | "nominal" | "verbal";
  root?: string;
  lemma?: string;
  grammaticalCase?: "nominative" | "accusative" | "genitive";
  aspect?: "perfect" | "imperfect" | "imperative";
  mood?: "indicative" | "subjunctive" | "jussive";
  agreement?: string;
  verbForm?: number;
  tags: string[];
}

export interface WordMorphology {
  position: number;
  segments: Segment[];
}

/** Morphology for every word printed on one page, keyed by verse. */
export type PageMorphology = Record<string, WordMorphology[]>;

export interface VerseAcoustics {
  letters: number;
  madd: number;
  ghunnah: number;
  qalqalah: number;
  heavy: number;
  sibilant: number;
  rhyme: string;
}

export interface PageAcoustics {
  flow: number;
  grain: number;
  brightness: number;
  rhymeRun: number;
  density: number;
  rhyme: string;
}

export interface SymmetryPair {
  depth: number;
  opening: string;
  closing: string;
  score: number;
  shared: string[];
}

export interface SurahSymmetry {
  verseCount: number;
  pivot: string;
  mirrorMean: number;
  baseline: number;
  lift: number;
  strength: "none" | "weak" | "moderate" | "strong";
  pairs: SymmetryPair[];
  notable: SymmetryPair[];
  muqattaat: string | null;
}

/** A verse the semantic worker considers close to the one being read. */
export interface Constellation {
  verseKey: string;
  page: number;
  similarity: number;
  /** Roots both verses carry — the explainable part of the link. */
  sharedRoots: string[];
}

export interface SemanticMeta {
  dimensions: number;
  scale: number;
  verseKeys: string[];
  placed: number[];
  vocabulary: string[];
  idf: number[];
  documentFrequency: number[];
  gloss: Record<string, string>;
}

/** The slice of a page the deep layers need; keeps them off the reader's types. */
export interface MushafPageLike {
  pageNumber: number;
  verses: { verseKey: string; surahId: number }[];
}
