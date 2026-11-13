/**
 * Labels of the chapter.
 *
 * `doc(step, i)` returns the i-th UI label the chapter document quotes «…» in that step's «Інтерактив»
 * (exported verbatim as `steps[].labels`, UI_API §2) — control captions come from there, never retyped.
 * `splitPair('A / B')` cuts a quoted pair into its captions for a segmented control.
 * `OWN` (in `labels-own.ts`) holds what the document does not carry: part names, axis titles, short status
 * words — plain Ukrainian (DECISIONS §54), symbols and units international.
 */
import raw from '@electricity/content/generated/transformer.json';
import type { StepId } from './chapter';

const BY_STEP = new Map<string, readonly string[]>(raw.steps.map((s) => [s.id, s.labels ?? []]));

/** The i-th quoted label of a step (document order). Throws when the document changed under us. */
export function doc(step: StepId, i: number): string {
  const text = BY_STEP.get(step)?.[i];
  if (text === undefined) throw new Error(`transformer: step '${step}' has no label #${i}`);
  return text;
}

/** «A / B / C» → ['A', 'B', 'C']; an optional «Prefix: a / b» keeps only the choices (first letter kept as is). */
export function splitList(label: string): string[] {
  const body = label.includes(':') ? label.slice(label.indexOf(':') + 1) : label;
  return body.split('/').map((s) => s.trim());
}

/** Like `splitList`, with the first letter of every item capitalised («постійний» → «Постійний»). */
export function splitCaps(label: string): string[] {
  return splitList(label).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

/** The part of «Prefix: a / b» before the colon («ВН»). */
export function pairTitle(label: string): string {
  return label.includes(':') ? label.slice(0, label.indexOf(':')).trim() : label;
}

/**
 * The i-th hotspot of a step as the content names it — `{ content: hot(ID, 0) }` binds the marker by that full
 * name (the document gives these hotspots no international name, so there is no slug id). Throws on a typo.
 */
export function hot(step: StepId, i: number): string {
  const name = raw.steps.find((s) => s.id === step)?.hotspots?.[i]?.name;
  if (name === undefined) throw new Error(`transformer: step '${step}' has no hotspot #${i}`);
  return name;
}
