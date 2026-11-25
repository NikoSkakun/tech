import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/layers.manifest.json';

/**
 * Chapter 1 of the volume `alkaline`: «Що всередині батарейки?» (docs/volumes/alkaline/chapters/layers.md). The
 * slice comes out of the stand battery and the reader touches its rings one by one: the steel can and the poles,
 * the zinc paste and the brass nail, the manganese oxide, the separator (the telescope) and the lye soaking in.
 * Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'layers',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
