import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/inside.manifest.json';

/**
 * Chapter 2 of the volume `alkaline`: «Хто в батарейці віддає, а хто забирає?» (docs/volumes/alkaline/chapters/inside.md).
 * The lens dives from the slice into the paste: zinc grains in the lye, the atoms of one grain, an atom leaving
 * as an ion, the oxide taking an electron, and zinc touching oxide (heat only).
 * Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'inside',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
