/**
 * `defineContent` — what a chapter's `content.ts` default-exports. It accepts hand-written content or the
 * chapter's machine-readable export (`docs/volumes/<volume>/chapters/_export/<id>.json`) and keeps only on-screen copy.
 *
 *   import raw from './content.json';                       // runtime subset of the export
 *   export default defineContent(raw, { labels: { drag: 'Перетягни електрон' } });
 */
import type { ChapterContent, Fact, StepContent } from './types';

/** Loose view of an export file: everything `defineContent` reads, nothing else is required. */
export interface ContentSource {
  volume?: string;
  id: string;
  title?: string;
  group?: string;
  learningGoals?: readonly string[];
  steps: readonly (Omit<StepContent, 'formulas' | 'facts'> & {
    formulas?: { items: readonly string[]; raw?: string | null } | null;
    facts?: { items: readonly Fact[] } | null;
  })[];
  glossary?: ChapterContent['glossary'];
  quiz?: ChapterContent['quiz'];
  simpleQuiz?: ChapterContent['simpleQuiz'];
  crossReferences?: ChapterContent['crossReferences'];
  labels?: Readonly<Record<string, string>>;
}

export function defineContent(
  source: ContentSource,
  extra: { labels?: Readonly<Record<string, string>> } = {},
): ChapterContent {
  const ids = new Set<string>();
  const steps = source.steps.map((s): StepContent => {
    if (ids.has(s.id)) throw new Error(`defineContent(${source.id}): duplicate step '${s.id}'`);
    ids.add(s.id);
    return {
      id: s.id,
      title: s.title,
      panel: [...s.panel],
      terms: s.terms?.map((t) => ({
        international: t.international,
        ukrainian: t.ukrainian,
        symbol: t.symbol ?? null,
        unit: t.unit ?? null,
        definition: t.definition ?? null,
        raw: t.raw,
        name: t.name,
        intl: t.intl,
      })),
      formulas: s.formulas ? { items: [...s.formulas.items], raw: s.formulas.raw ?? undefined } : undefined,
      facts: s.facts
        ? { items: s.facts.items.map((f) => ({ text: f.text, source: f.source ?? null, table: f.table })) }
        : undefined,
      hotspots: s.hotspots?.map((h) => ({
        id: h.id,
        intl: h.intl,
        title: h.title,
        name: h.name,
        international: h.international ?? null,
        ukrainian: h.ukrainian ?? null,
        text: h.text,
      })),
      misconceptions: s.misconceptions?.map((m) => ({ myth: m.myth, correction: m.correction })),
      quiz: s.quiz,
      labels: s.labels,
      simple: s.simple,
    };
  });
  for (const q of [...(source.quiz ?? []), ...(source.simpleQuiz ?? [])]) {
    if (q.correct < 0 || q.correct >= q.options.length)
      throw new Error(`defineContent(${source.id}): quiz answer index out of range`);
  }
  return {
    volume: source.volume,
    id: source.id,
    title: source.title,
    group: source.group as ChapterContent['group'],
    learningGoals: source.learningGoals,
    steps,
    glossary: source.glossary,
    quiz: source.quiz,
    simpleQuiz: source.simpleQuiz,
    crossReferences: source.crossReferences,
    labels: { ...(source.labels ?? {}), ...(extra.labels ?? {}) },
  };
}

/** Step content by id (undefined for unknown ids — the HUD then falls back to the manifest's title / blurb). */
export function stepContent(
  content: ChapterContent | null | undefined,
  stepId: string,
): StepContent | undefined {
  return content?.steps.find((s) => s.id === stepId);
}

/** An international abbreviation token (BMS, MPPT, USB-PD, DoD) — mirrors `export_runtime.py`. */
function abbreviation(intl: string): string | null {
  const isAbbr = (t: string): boolean => {
    if (!/^[A-Za-z0-9][A-Za-z0-9+/-]{0,11}$/.test(t)) return false;
    const upper = (t.match(/[A-Z]/g) ?? []).length;
    return upper >= 2 && (t.match(/[a-z]/g) ?? []).length <= upper;
  };
  const s = intl.trim();
  if (isAbbr(s)) return s;
  const m = /^(.*\S)\s*\(([^()]+)\)$/.exec(s);
  if (m) {
    if (isAbbr(m[1]!.trim())) return m[1]!.trim();
    if (isAbbr(m[2]!.trim())) return m[2]!.trim();
  }
  return null;
}

/**
 * Display name of a term, glossary row or hotspot (DECISIONS §54): the generated `name` when there is one;
 * otherwise the Ukrainian form, with an international abbreviation in parentheses when the Ukrainian form has
 * no abbreviation of its own («система керування батареєю (BMS)»).
 */
export function termName(t: {
  international?: string | null;
  ukrainian?: string | null;
  raw?: string;
  name?: string;
}): string {
  if (t.name) return t.name;
  const ukr = t.ukrainian?.trim();
  if (!ukr) return t.international ?? t.raw ?? '';
  const abbr = t.international ? abbreviation(t.international) : null;
  if (!abbr || ukr.includes(abbr) || /(?<![А-Яа-яІіЇїЄєҐґ’'])[А-ЯІЇЄҐ]{2,}(?![а-яіїєґ’'])/.test(ukr))
    return ukr;
  return `${ukr} (${abbr})`;
}

/** The international form to show as a secondary line under `termName(t)` (null when it adds nothing). */
export function termIntl(t: { international?: string | null; intl?: string; name?: string }): string | null {
  const intl = t.intl ?? t.international ?? null;
  if (!intl) return null;
  return termName(t).includes(intl) ? null : intl;
}

/**
 * Is a code span an in-app link? `volume/chapter/step` is a full step address; the short `chapter/step`
 * (how a chapter's text refers to its own volume) has `volumeId: null`. Returns the target or null.
 */
export function linkTarget(
  code: string,
): { volumeId: string | null; chapterId: string; stepId: string } | null {
  const m = /^(?:([a-z_][a-z0-9_-]*)\/)?([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)$/.exec(code.trim());
  return m ? { volumeId: m[1] ?? null, chapterId: m[2]!, stepId: m[3]! } : null;
}

/** Key of a chapter in progress records, glossary filters and the content loader: `volume/chapter`. */
export function contentKey(chapter: { readonly volume?: string; readonly id: string }): string {
  return chapter.volume ? `${chapter.volume}/${chapter.id}` : chapter.id;
}
