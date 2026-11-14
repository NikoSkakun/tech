import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/plant-coal.manifest.json';

/**
 * «ТЕС на вугіллі (і ТЕЦ)» — child of the `plants` hub (docs/volumes/electricity/chapters/plant-coal.md).
 *
 * The manifest is eager, so it stays tiny: titles, the axis label and the step list (ids, titles, blurbs)
 * come from the generated manifest file, never from the content file and never retyped.
 */
export default defineChapter({
  id: 'plant-coal',
  order: 9, // № in docs/volumes/electricity/INDEX.md
  group: 'plants',
  parent: 'plants',
  ...manifestText(meta),
  axisValue: 2.5, // 10²…10³ m
  // document: dominant `orange` (flame) + `amber`; dusk sky with warm furnace glints
  theme: { accent: 'orange', sky: 'dusk', mood: 'diorama' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
