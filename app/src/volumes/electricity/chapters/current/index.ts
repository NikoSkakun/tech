import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/current.manifest.json';

/**
 * Chapter 4 — «Струм, напруга, опір: електричне коло» (docs/volumes/electricity/chapters/current.md).
 * The manifest stays tiny: titles, step ids and blurbs come from the generated manifest JSON.
 */
export default defineChapter({
  id: 'current',
  order: 4,
  group: 'micro',
  ...manifestText(meta, { subtitle: 'Стіл-майстерня: від електрона в дроті до кола на столі' }),
  axisValue: -2, // 10⁻³…10⁻¹ m: a wire and a tabletop circuit
  theme: { accent: 'yellow', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
