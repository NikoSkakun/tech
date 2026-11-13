/**
 * Text of the chapter. Panel pages, terms, formulas, facts, hotspot cards, misconceptions, glossary and quiz come
 * from the generated runtime content (never retyped — DECISIONS §43, §53). Control captions that the document
 * quotes «…» are read from `steps[].labels`; `labels.ts` holds only what the export does not carry.
 */
import { defineContent, linkTarget } from '@/content';
import raw from '@electricity/content/generated/matter.json';
import { FLAT_LABELS } from './labels';

export type StepId =
  | 'lattice'
  | 'electron-sea'
  | 'bands'
  | 'insulators'
  | 'resistance'
  | 'silicon'
  | 'doping'
  | 'pn-junction'
  | 'devices';

const content = defineContent(raw, { labels: FLAT_LABELS });
export default content;

const step = (id: StepId): (typeof raw.steps)[number] => {
  const s = raw.steps.find((x) => x.id === id);
  if (!s) throw new Error(`matter: no step '${id}' in the generated content`);
  return s;
};

/** The `index`-th caption quoted «…» in the step's «Інтерактив» text, exactly as the document has it. */
export function docLabel(id: StepId, index: number): string {
  const text = step(id).labels[index];
  if (text === undefined) throw new Error(`matter: step '${id}' has no quoted label #${index}`);
  return text;
}

/** A quoted caption that lists alternatives («Діод | Світлодіод | …», «змінна / постійна») split into items. */
export function docItems(id: StepId, index: number, separator: '|' | '/' = '|'): string[] {
  return splitItems(docLabel(id, index), separator);
}

export const splitItems = (text: string, separator: '|' | '/' = '|'): string[] =>
  text.split(separator).map((s) => s.trim());

/** Full address of the first cross-reference of the chapter that points into `chapterId`. */
export function crossTarget(chapterId: string): string | undefined {
  return raw.crossReferences.flatMap((x) => x.targets).find((t) => linkTarget(t)?.chapterId === chapterId);
}

/** First letter in upper case — for a quoted caption that the document writes inside a sentence. */
export const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
