/**
 * Text of the chapter. Panel pages, terms, formulas, facts, hotspot texts, misconceptions, glossary and quiz
 * come from the generated runtime export of `docs/volumes/electricity/chapters/atom.md` — never retyped here
 * (DECISIONS §43, §53). Hotspot cards are bound by id in the step UI (`{ anchor, content: 'nucleus' }`).
 * `labels.ts` holds only the scene / control captions that the export does not carry.
 */
import { defineContent, termName } from '@/content';
import raw from '@electricity/content/generated/atom.json';
import type { StepId } from './chapter';
import { FLAT_LABELS } from './labels';

const content = defineContent(raw, { labels: FLAT_LABELS });
export default content;

const step = (id: StepId): (typeof raw.steps)[number] => {
  const found = raw.steps.find((s) => s.id === id);
  if (!found) throw new Error(`atom: no step '${id}' in the generated content`);
  return found;
};

/** Ukrainian display name of the `index`-th term of a step (DECISIONS §54), for callouts and tooltips. */
export function termOf(id: StepId, index: number): string {
  const term = content.steps.find((s) => s.id === id)?.terms?.[index];
  if (!term) throw new Error(`atom: step '${id}' has no term #${index}`);
  return termName(term);
}

/** The `index`-th formula of a step as written in the document (for in-scene formula callouts). */
export function formula(id: StepId, index: number): string {
  const text = step(id).formulas?.items[index];
  if (text === undefined) throw new Error(`atom: step '${id}' has no formula #${index}`);
  return text;
}
