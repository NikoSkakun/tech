/**
 * Content model. The shapes mirror the machine-readable export of the chapter documents
 * (`docs/volumes/<volume>/chapters/_export/<id>.json`, schema v2) so a chapter's `content.ts` can be generated from — or simply
 * import a runtime subset of — that export without retyping Ukrainian text (DECISIONS §43, §49).
 *
 * Only on-screen copy is modelled here. Builder guidance in the export (`see`, `interaction`, `transition`,
 * `visualIdea`, notes) is deliberately absent: it never ships to the client.
 *
 * Strings use the text mini-markup of `@/text` (`**term**`, `_emphasis_`, `` `formula` ``); a code span of the
 * form `` `chapter/step` `` is an in-app link.
 */
import type { ChapterGroup } from '@/engine/api';

/**
 * A key term. Both forms stay as data; the app displays `name` (DECISIONS §54: the Ukrainian form, with the
 * international abbreviation in parentheses where one is kept) and `intl` as a small secondary line.
 */
export interface Term {
  international: string | null;
  ukrainian: string | null;
  /** Display name (generated; `termName()` derives it for hand-written content). */
  name?: string;
  /** International form as a secondary line (omitted when it is already in `name`). */
  intl?: string;
  /** Symbol of the quantity (`U`, `I_sc`, `p⁺`). */
  symbol?: string | null;
  /** SI unit symbol in Latin (`V`, `Ω`, `kWh`). */
  unit?: string | null;
  definition?: string | null;
  /** The term line exactly as written in the document (fallback label). */
  raw?: string;
}

export interface Fact {
  text: string;
  source?: string | null;
  /** The fact is a table in the document: the HUD renders it as a table instead of `text`. */
  table?: FactTable;
}

export interface FactTable {
  head: readonly string[];
  rows: readonly (readonly string[])[];
  /** Footnote text after the table (e.g. «* за даними…»). */
  note?: string;
}

export interface Hotspot {
  /** Stable id (slug of the international name, e.g. `wind-turbine`) — bind with `hotspots: [{ content: id }]`. */
  id?: string;
  /** The name pair as written in the document (`Nucleus — ядро`); chapters bound cards by it. */
  name: string;
  /** Display name (§54: Ukrainian, e.g. `атомне ядро`) — the HUD shows this. */
  title?: string;
  international?: string | null;
  ukrainian?: string | null;
  /** International form as a secondary line. */
  intl?: string;
  /** Card text. */
  text: string;
}

export interface Misconception {
  /** The wrong belief (shown as a quote). */
  myth: string | null;
  /** What is actually true / what the scene shows. */
  correction: string;
}

export interface QuizItem {
  question: string;
  options: readonly string[];
  /** 0-based index into `options`. */
  correct: number;
  explanation?: string | null;
}

/** A word of the simple level («Слова»): the word as it appears in the simple text and one plain sentence. */
export interface SimpleWord {
  word: string;
  text: string;
}

/** A plain hotspot card text («Підказки»). */
export interface SimpleHotspot {
  id: string;
  text: string;
}

/**
 * The simple reading level of a step («Просто», docs/briefs/L-simple-level.md §4). Every part is optional except
 * the pages; a missing part falls back to the detailed copy (see `@/hud/level`). There are no formulas.
 */
export interface SimpleStep {
  /** Shorter title where the detailed one is long. */
  title?: string;
  /** 1–2 pages, ≤ 250 characters each. */
  panel: readonly string[];
  /** «Слова» (replaces «Терміни» in the simple level). */
  words?: readonly SimpleWord[];
  /** «Цікаво» (replaces «Цифри і факти»). */
  facts?: readonly string[];
  /** Plain hotspot card texts, bound by the hotspot `id` (a list: JSON inference cannot widen an id-keyed object). */
  hotspots?: readonly SimpleHotspot[];
  misconception?: Misconception;
}

/** On-screen content of one step. Field names equal the export's `steps[]` entries. */
export interface StepContent {
  id: string;
  title: string;
  /** Panel pages in order (≤ ~450 characters of plain text each). */
  panel: readonly string[];
  terms?: readonly Term[];
  /** Formulas without backticks; `raw` keeps the explanatory words around them. */
  formulas?: { items: readonly string[]; raw?: string };
  facts?: { items: readonly Fact[] };
  hotspots?: readonly Hotspot[];
  misconceptions?: readonly Misconception[];
  /** Optional step-level quiz (the chapter quiz lives in `ChapterContent.quiz`). */
  quiz?: readonly QuizItem[];
  /** UI labels quoted «…» in the document's «Інтерактив» items, verbatim — use them for control captions. */
  labels?: readonly string[];
  /** The simple reading level of the step, when the chapter has one. */
  simple?: SimpleStep;
}

export interface GlossaryEntry {
  international: string;
  ukrainian: string;
  /** Display name (§54). */
  name?: string;
  /** International form as a secondary line. */
  intl?: string;
  symbol?: string | null;
  unit?: string | null;
  definition: string;
}

export interface CrossReference {
  where: string;
  /** Full step addresses `volume/chapter/step` (see `linkTarget`). */
  targets: readonly string[];
  note?: string | null;
}

/** Eager chapter data generated next to the content (`generated/<id>.manifest.json`) for `index.ts`. */
export interface ChapterMeta {
  /** Volume the chapter belongs to. */
  volume: string;
  id: string;
  title: string;
  /** Default: the first step's title (the documents have no subtitle). */
  subtitle: string;
  /** The chapter's place on the volume's journey axis as written in its document (`10⁻¹⁰ m`). */
  axisLabel: string;
  group: string;
  parent: string | null;
  order: number | null;
  steps: readonly { id: string; title: string; blurb: string }[];
}

/** Everything a chapter shows as text. `defineContent()` accepts this or the raw export object. */
export interface ChapterContent {
  /** Volume the chapter belongs to (generated content always has it; hand-written test content may not). */
  volume?: string;
  id: string;
  title?: string;
  group?: ChapterGroup;
  learningGoals?: readonly string[];
  steps: readonly StepContent[];
  glossary?: readonly GlossaryEntry[];
  quiz?: readonly QuizItem[];
  /** «Простий квіз» — the chapter quiz of the simple reading level (3 questions, no arithmetic). */
  simpleQuiz?: readonly QuizItem[];
  crossReferences?: readonly CrossReference[];
  /** Free-form scene labels of the chapter (callouts, button captions…), keyed by the builder. */
  labels?: Readonly<Record<string, string>>;
}

/** A glossary entry with its origin, as shown in the glossary overlay. */
export interface GlossaryRecord extends GlossaryEntry {
  /** Volume, chapter and step where the term is introduced (`null` step: chapter-level glossary only). */
  volumeId: string | null;
  chapterId: string;
  stepId: string | null;
  /** Other chapters that list the same term — content keys (`volume/chapter`, see `contentKey`). */
  alsoIn: string[];
}
