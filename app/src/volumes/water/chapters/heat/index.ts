import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/heat.manifest.json';

/**
 * Chapter 4 of the volume `water`: «Що таке тепло?» (docs/volumes/water/chapters/heat.md). Five steps on one sample
 * of 252 molecules that is simulated live: ice that trembles more as it warms, water whose motion the thermometer
 * reads, slow and fast molecules at one temperature, heat passing from the hot half to the cold one, and the
 * stillness of absolute zero. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'heat',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'sky', sky: 'micro', mood: 'micro' },
  load: () => import('./scene'),
});
