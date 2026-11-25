import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/life.manifest.json';

/**
 * Chapter 4 of the volume `alkaline`: «Чому батарейка сідає?» (docs/volumes/alkaline/chapters/life.md): eight
 * hours of light on one slider — zinc whitening into zinc oxide, the needle sagging, the lamp yellowing —, the dead
 * battery that still shows a voltage until the switch closes, and ten years in a drawer that barely touch it.
 * Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'life',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
