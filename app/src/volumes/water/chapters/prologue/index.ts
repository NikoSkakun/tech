import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/prologue.manifest.json';

/**
 * The prologue of the volume `water` (docs/volumes/water/chapters/prologue.md): the glass on the night table —
 * ice, water and steam by one knob; a snowflake that always grows six arms; one flight from the glass through a
 * drop down to the restless particles; the riddle of the floating ice; the map of the seven questions.
 * It explains nothing and introduces no term. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'prologue',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'sky', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
