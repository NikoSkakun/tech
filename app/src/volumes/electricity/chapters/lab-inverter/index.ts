import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/lab-inverter.manifest.json';

/**
 * Lab «Інвертори: як постійний струм стає змінним» (docs/volumes/electricity/chapters/lab-inverter.md) — child of
 * `home`. Titles, step ids and blurbs come from the generated manifest (never retyped); the subtitle is the
 * chapter's own teaser. `axisValue`: the wall inverter is ≈ 0,5 m (log₁₀ ≈ −0,3).
 */
export default defineChapter({
  id: 'lab-inverter',
  order: meta.order,
  group: 'labs',
  parent: 'home',
  ...manifestText(meta, { subtitle: 'Від одного транзистора до шафи на 6 kW' }),
  axisValue: -0.3,
  theme: { accent: 'violet', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
