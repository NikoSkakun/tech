import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/plant-gas.manifest.json';

/**
 * «Газові електростанції: ГТУ, ПГУ, газопоршневі» — child of the `plants` hub
 * (docs/volumes/electricity/chapters/plant-gas.md).
 *
 * The manifest is eager, so it stays tiny: titles, the axis label and the step list come from the generated
 * manifest file, never from the content file and never retyped.
 */
export default defineChapter({
  id: 'plant-gas',
  order: 10, // № in docs/volumes/electricity/INDEX.md — also the order among the children of `plants`
  group: 'plants',
  parent: 'plants',
  ...manifestText(meta),
  axisValue: 2.5,
  // document: dominant `violet` (gas) + `orange` (hot gases); clear day with a light haze
  theme: { accent: 'violet', sky: 'day', mood: 'diorama' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
