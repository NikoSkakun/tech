import { defineContent } from '@/content';
import raw from '@electricity/content/generated/lab-pv.json';
import { L } from './labels';

/**
 * All on-screen text of the chapter: the generated runtime copy of `docs/volumes/electricity/chapters/lab-pv.md`
 * (never edited or retyped here) plus the scene labels of `labels.ts`. The HUD discovers this module by itself.
 */
const content = defineContent(raw, { labels: L });
export default content;

export type StepId = (typeof raw.steps)[number]['id'];

/**
 * A UI label the document quotes «…» in a step's «Інтерактив» (`steps[].labels`, document order) — control
 * captions are taken from here, never retyped. Throws on a wrong index so a document change cannot pass silently.
 */
export function doc(step: StepId, index: number): string {
  const label = raw.steps.find((s) => s.id === step)?.labels?.[index];
  if (label === undefined) throw new Error(`lab-pv: no document label ${step}[${index}]`);
  return label;
}

/** A document label used as a caption: first letter upper-cased (the document quotes some in running text). */
export function cap(text: string): string {
  return text.charAt(0).toLocaleUpperCase('uk') + text.slice(1);
}

/** Both halves of a document label written as «A / B». */
export function docPair(step: StepId, index: number): [string, string] {
  const [a, b] = doc(step, index).split(' / ');
  if (a === undefined || b === undefined) throw new Error(`lab-pv: label ${step}[${index}] is not a pair`);
  return [a, b];
}

/** A link target (full address) of the cross-references that leads into `chapterId`, if the document has one. */
export function xref(chapterId: string, stepId?: string): string | undefined {
  const tail = stepId ? `/${chapterId}/${stepId}` : `/${chapterId}/`;
  return raw.crossReferences.flatMap((x) => x.targets).find((t) => (stepId ? t.endsWith(tail) : t.includes(tail)));
}
