import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/transformer.manifest.json';

/**
 * Chapter 7 — «Трансформатор» (docs/volumes/electricity/chapters/transformer.md): from Faraday's ring on the
 * studio disc to a 250 MVA substation transformer, the voltage ladder of the grid at the end. Titles, step ids
 * and blurbs come from the generated manifest (never retyped); the subtitle is the chapter's own teaser.
 * `axisValue`: a teaching transformer and a power transformer, 1 m…10 m (log₁₀ ≈ 0…1).
 */
export default defineChapter({
  id: 'transformer',
  order: meta.order,
  group: 'em',
  ...manifestText(meta, { subtitle: 'Від кільця Фарадея до гіганта підстанції' }),
  axisValue: 0.3,
  theme: { accent: 'violet', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
