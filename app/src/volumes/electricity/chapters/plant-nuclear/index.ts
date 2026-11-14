import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/plant-nuclear.manifest.json';

/**
 * «Атомна електростанція (АЕС)» — child of the `plants` hub (docs/volumes/electricity/chapters/plant-nuclear.md).
 *
 * The manifest is eager, so it stays tiny: titles, the axis label and the step list come from the generated
 * manifest file, never from the content file and never retyped.
 */
export default defineChapter({
  id: 'plant-nuclear',
  order: 11, // № in docs/volumes/electricity/INDEX.md — also the order among the children of `plants`
  group: 'plants',
  parent: 'plants',
  ...manifestText(meta),
  axisValue: 2.5,
  // document: dominant `violet` (= plantType.nuclear) + `blue` primary water; a cool morning over the island
  theme: { accent: 'violet', sky: 'day', mood: 'diorama' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
