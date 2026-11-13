/**
 * Reading level selector («Просто / Докладно», docs/briefs/L-simple-level.md §4) — pure functions over the content
 * model, shared by every interface that shows step copy (the WebGL HUD now, the 2D interface later).
 *
 * The simple layer replaces whole parts of a step: pages and title, «Терміни» → «Слова», «Цифри і факти» →
 * «Цікаво», no «Формули», its own «Хибне уявлення», plain hotspot texts; the chapter quiz → «Простий квіз».
 * Fallbacks: a step without a simple layer keeps its detailed copy (the result says `level: 'detailed'`); inside a
 * simple step a hotspot without a plain sentence keeps its detailed text (a card is never empty); other parts the
 * simple layer leaves out are simply absent (no detailed formulas or terms mixed into simple copy).
 */
import type { ReadingLevel } from '@/engine/api';
import type { ChapterContent, QuizItem, StepContent, Term } from './types';

export { DEFAULT_READING_LEVEL, isReadingLevel, type ReadingLevel } from '@/engine/api';

/** Labels of the switch «Рівень тексту: Просто / Докладно», in display order. */
export const READING_LEVELS: readonly { id: ReadingLevel; label: string }[] = [
  { id: 'simple', label: 'Просто' },
  { id: 'detailed', label: 'Докладно' },
];

/** Section captions of a step at its effective level. */
export interface LevelLabels {
  /** The term chips («Терміни» / «Слова») and the kicker of one card («Термін» / «Слово»). */
  terms: string;
  term: string;
  /** «Цифри і факти» / «Цікаво». */
  facts: string;
  /** The term card links to the glossary (simple words are not glossary entries). */
  glossary: boolean;
}

export const LEVEL_LABELS: Readonly<Record<ReadingLevel, LevelLabels>> = {
  detailed: { terms: 'Терміни', term: 'Термін', facts: 'Цифри і факти', glossary: true },
  simple: { terms: 'Слова', term: 'Слово', facts: 'Цікаво', glossary: false },
};

/** A step's copy at a reading level; `level` is the level actually shown (`detailed` after a fallback). */
export interface LeveledStep extends StepContent {
  level: ReadingLevel;
}

/** Does the chapter have a simple layer at all (any step, or a simple quiz)? */
export function hasSimpleLayer(content: ChapterContent | null | undefined): boolean {
  return !!content && (content.steps.some((s) => !!s.simple) || !!content.simpleQuiz?.length);
}

/**
 * The step as shown at `level`, in the shape of `StepContent` so a renderer of detailed copy renders it unchanged
 * (simple words become terms with only a name and a definition, simple facts become plain facts).
 */
export function stepAtLevel(step: StepContent, level: ReadingLevel): LeveledStep {
  const x = step.simple;
  if (level === 'detailed' || !x) return { ...step, level: 'detailed' };
  const words: Term[] = (x.words ?? []).map((w) => ({
    international: null,
    ukrainian: w.word,
    name: w.word,
    definition: w.text,
  }));
  return {
    ...step,
    level: 'simple',
    title: x.title ?? step.title,
    panel: x.panel,
    terms: words.length ? words : undefined,
    formulas: undefined,
    facts: x.facts?.length ? { items: x.facts.map((text) => ({ text })) } : undefined,
    hotspots: step.hotspots?.map((h) => {
      const plain = h.id ? x.hotspots?.find((p) => p.id === h.id)?.text : undefined;
      return plain ? { ...h, text: plain } : h;
    }),
    misconceptions: x.misconception ? [x.misconception] : undefined,
  };
}

/** The chapter quiz at `level`: «Простий квіз» when the chapter has one, else the detailed «Міні-квіз». */
export function quizAtLevel(
  content: ChapterContent | null | undefined,
  level: ReadingLevel,
): { items: readonly QuizItem[]; level: ReadingLevel } | null {
  if (!content) return null;
  if (level === 'simple' && content.simpleQuiz?.length) return { items: content.simpleQuiz, level: 'simple' };
  return content.quiz?.length ? { items: content.quiz, level: 'detailed' } : null;
}
