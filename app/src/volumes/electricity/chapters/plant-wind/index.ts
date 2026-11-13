import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/plant-wind.manifest.json';

/**
 * «Вітрова електростанція (ВЕС)» — child of the `plants` hub (docs/volumes/electricity/chapters/plant-wind.md).
 *
 * The manifest is eager, so it must stay tiny: titles, the axis label and the step list (ids, titles, blurbs)
 * come from the generated manifest file (≈ 2 kB), never from the 65 kB content file and never retyped.
 */
export default defineChapter({
  id: 'plant-wind',
  order: 13, // № in docs/volumes/electricity/INDEX.md — also the order among the children of `plants`
  group: 'plants',
  parent: 'plants',
  ...manifestText(meta),
  axisValue: 2.5,
  // document: dominant `sky`, support `teal` (plantType.wind) + `yellow` energy flow; clear windy day
  theme: { accent: 'sky', sky: 'day', mood: 'diorama' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
