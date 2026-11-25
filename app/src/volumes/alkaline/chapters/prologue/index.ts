import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/prologue.manifest.json';

/**
 * The prologue of the volume `alkaline`: «Маленька батарейка світить годинами. Що в ній?»
 * (docs/volumes/alkaline/chapters/prologue.md). The stand of `circuit`: the switch lights the lamp, the battery opens
 * where it lies, ten years in a drawer barely touch it, and the map. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'prologue',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
