/**
 * Labels of the chapter.
 *
 * `doc(step, i)` returns the i-th UI label the chapter document quotes «…» in that step's «Інтерактив»
 * (exported verbatim as `steps[].labels`, UI_API §2) — control captions come from there, never retyped.
 * `splitPair('A / B')` cuts a quoted pair into its two captions for a segmented control.
 * `OWN` (in `labels-own.ts`) holds what the document does not carry: part names, axis titles, short status
 * words — plain Ukrainian (DECISIONS §54), symbols and units international.
 */
import raw from '@electricity/content/generated/lab-inverter.json';
import type { StepId } from './chapter';

const BY_STEP = new Map<string, readonly string[]>(raw.steps.map((s) => [s.id, s.labels ?? []]));

/** The i-th quoted label of a step (document order). Throws when the document changed under us. */
export function doc(step: StepId, i: number): string {
  const text = BY_STEP.get(step)?.[i];
  if (text === undefined) throw new Error(`lab-inverter: step '${step}' has no label #${i}`);
  return text;
}

/** «Кран / Ключ» → ['Кран', 'Ключ']; an optional «Prefix: a / b» keeps only the choices. */
export function splitPair(label: string): [string, string] {
  const body = label.includes(':') ? label.slice(label.indexOf(':') + 1) : label;
  const [a = '', b = ''] = body.split('/').map((s) => s.trim());
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  return [cap(a), cap(b)];
}

/** The part of «Prefix: a / b» before the colon («Навантаження»). */
export function pairTitle(label: string): string {
  return label.includes(':') ? label.slice(0, label.indexOf(':')).trim() : label;
}
