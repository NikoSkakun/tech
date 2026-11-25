import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/trick.manifest.json';

/**
 * Chapter 3 of the volume `alkaline`: «Як батарейка жене електрони крізь лампочку?» (chapters/trick.md):
 * the separator stops electrons and lets ions through; the reaction stops itself on an open circuit; the switch
 * gives the electrons a way through the lamp; ions close the loop inside; the meter reads the voltage.
 * Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'trick',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
