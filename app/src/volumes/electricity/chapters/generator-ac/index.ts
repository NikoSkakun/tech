import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/generator-ac.manifest.json';

/**
 * «Генератор, змінний струм, три фази» (docs/volumes/electricity/chapters/generator-ac.md). Titles, step ids
 * and blurbs come from the generated manifest (never retyped); the subtitle is the chapter's own teaser.
 * `axisValue`: the machines of the chapter are ≈ 1 m (log₁₀ = 0).
 */
export default defineChapter({
  id: 'generator-ac',
  order: meta.order,
  group: 'em',
  ...manifestText(meta, { subtitle: 'Від рамки в полі до генератора електростанції' }),
  axisValue: 0,
  theme: { accent: 'teal', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
