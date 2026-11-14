/**
 * Labels of the chapter.
 *
 * `doc(step, i)` returns the i-th UI label the chapter document quotes «…» in that step's «Інтерактив»
 * (exported verbatim as `steps[].labels`, UI_API §2) — control captions come from there, never retyped.
 * `fact(step, i)` returns a «Цифри і факти» line of a step (the gallery plaques). `plantTitle(id)` / `plantBlurb(id)`
 * are the title and first sentence of a plant chapter, taken from that chapter's generated manifest.
 * `OWN` (in `labels-own.ts`) holds what the document does not carry: part names, axis titles, short status
 * words — plain Ukrainian (DECISIONS §54), symbols and units international.
 */
import raw from '@electricity/content/generated/plants.json';
import coal from '@electricity/content/generated/plant-coal.manifest.json';
import future from '@electricity/content/generated/plant-future.manifest.json';
import gas from '@electricity/content/generated/plant-gas.manifest.json';
import geoBio from '@electricity/content/generated/plant-geo-bio.manifest.json';
import hydro from '@electricity/content/generated/plant-hydro.manifest.json';
import nuclear from '@electricity/content/generated/plant-nuclear.manifest.json';
import ocean from '@electricity/content/generated/plant-ocean.manifest.json';
import solar from '@electricity/content/generated/plant-solar.manifest.json';
import wind from '@electricity/content/generated/plant-wind.manifest.json';
import type { StepId } from './chapter';
import type { PlantId } from './plants-data';

const BY_STEP = new Map<string, readonly string[]>(raw.steps.map((s) => [s.id, s.labels ?? []]));

/** The i-th quoted label of a step (document order). Throws when the document changed under us. */
export function doc(step: StepId, i: number): string {
  const text = BY_STEP.get(step)?.[i];
  if (text === undefined) throw new Error(`plants: step '${step}' has no label #${i}`);
  return text;
}

/** The i-th «Цифри і факти» line of a step. */
export function fact(step: StepId, i: number): string {
  const s = raw.steps.find((x) => x.id === step) as { facts?: { items: { text: string }[] } } | undefined;
  const text = s?.facts?.items[i]?.text;
  if (text === undefined) throw new Error(`plants: step '${step}' has no fact #${i}`);
  return text;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** «АЕС / ВЕС / СЕС 1000 MW» → parts; «Світ: 2015 · 2025» → ['Світ', '2015', '2025'] with `splitDots`. */
export function splitAll(label: string, sep: string | RegExp = '/'): string[] {
  return label.split(sep).map((s) => cap(s.trim()));
}

const MANIFESTS: Record<PlantId, { title: string; steps: { id: string; blurb: string }[] }> = {
  coal,
  gas,
  nuclear,
  hydro,
  wind,
  solar,
  geoBio,
  ocean,
  future,
};

export const plantTitle = (id: PlantId): string => MANIFESTS[id].title;
export const plantBlurb = (id: PlantId): string => MANIFESTS[id].steps[0]?.blurb ?? '';
