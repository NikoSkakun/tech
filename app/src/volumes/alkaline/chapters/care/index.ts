import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/care.manifest.json';

/**
 * Chapter 5 of the volume `alkaline`: «Чому батарейка гріється і протікає?» (chapters/care.md): four
 * sizes with one voltage, a bare wire across the poles (the lamp dies, the meter drops), the heat of a short
 * circuit born inside the battery, and the white crust of dried lye at the minus end of a forgotten battery.
 * Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'care',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
