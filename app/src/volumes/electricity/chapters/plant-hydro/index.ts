import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/plant-hydro.manifest.json';

/**
 * «ГЕС і ГАЕС: енергія води» — child of the `plants` hub (docs/volumes/electricity/chapters/plant-hydro.md).
 *
 * The manifest is eager, so it stays tiny: titles, the axis label and the step list come from the generated
 * manifest file, never from the content file and never retyped.
 */
export default defineChapter({
  id: 'plant-hydro',
  order: 12, // № in docs/volumes/electricity/INDEX.md — also the order among the children of `plants`
  group: 'plants',
  parent: 'plants',
  ...manifestText(meta),
  axisValue: 2.5,
  // document: dominant `blue` (water) + `sky`; fresh day in a mountain valley (storm / night are per-step tunes)
  theme: { accent: 'blue', sky: 'day', mood: 'diorama' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
