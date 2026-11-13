/**
 * Text of the chapter. Panel pages, terms, formulas, facts, hotspot texts, misconceptions, glossary and quiz
 * come from the generated runtime export of `docs/volumes/electricity/chapters/atom.md` — never retyped here (DECISIONS §43, §53).
 * `labels.ts` holds only the scene / control captions that the export does not carry.
 */
import { defineContent } from '@/content';
import raw from '@electricity/content/generated/atom.json';
import type { StepIdOf } from '@/engine/api';
import type manifest from './index';
import { FLAT_LABELS } from './labels';

export type StepId = StepIdOf<typeof manifest>;

const content = defineContent(raw, { labels: FLAT_LABELS });
export default content;

/**
 * Name of the `index`-th hotspot of a step exactly as the document has it. Passing it as the `title` of a
 * `stepUi` hotspot makes the HUD take the card text from the content (UI_API §5).
 */
export function hotspotName(step: StepId, index: number): string {
  const hotspot = content.steps.find((s) => s.id === step)?.hotspots?.[index];
  if (!hotspot) throw new Error(`atom: step '${step}' has no hotspot #${index}`);
  return hotspot.name;
}

/** `International — українською` name of the `index`-th term of a step (for callouts and tooltips). */
export function termName(step: StepId, index: number): string {
  const term = content.steps.find((s) => s.id === step)?.terms?.[index];
  if (!term) throw new Error(`atom: step '${step}' has no term #${index}`);
  return term.international && term.ukrainian
    ? `${term.international} — ${term.ukrainian}`
    : (term.international ?? term.ukrainian ?? '');
}

/** The `index`-th formula of a step as written in the document (for in-scene formula callouts). */
export function formula(step: StepId, index: number): string {
  const text = content.steps.find((s) => s.id === step)?.formulas?.items[index];
  if (text === undefined) throw new Error(`atom: step '${step}' has no formula #${index}`);
  return text;
}
