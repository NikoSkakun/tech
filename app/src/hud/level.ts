/**
 * The reading level in the WebGL HUD (temporary until the 2D interface, DECISIONS §59): the one place the HUD
 * asks which copy to show. The selection itself is `@/content/level` (shared with the 2D interface).
 */
import {
  quizAtLevel,
  stepAtLevel,
  stepContent,
  type ChapterContent,
  type LeveledStep,
  type QuizItem,
  type ReadingLevel,
} from '@/content';
import type { Engine } from '@/engine/api';

/** Reading level in effect (`?level=` flag of the session, else the setting). */
export function readingLevel(engine: Engine): ReadingLevel {
  return engine.readingLevel();
}

/** The step's copy at the level in effect (undefined for an unknown step: the HUD then uses the manifest). */
export function stepCopy(
  engine: Engine,
  content: ChapterContent | null | undefined,
  stepId: string,
): LeveledStep | undefined {
  const step = stepContent(content, stepId);
  return step ? stepAtLevel(step, readingLevel(engine)) : undefined;
}

/** The chapter quiz at the level in effect. */
export function quizCopy(engine: Engine, content: ChapterContent | null | undefined): readonly QuizItem[] {
  return quizAtLevel(content, readingLevel(engine))?.items ?? [];
}

/** Call `fn` whenever the level in effect changes (setting or the end of a `?level=` pin). */
export function onReadingLevel(engine: Engine, fn: (level: ReadingLevel) => void): () => void {
  return engine.store.subscribe(() => engine.readingLevel(), fn);
}
