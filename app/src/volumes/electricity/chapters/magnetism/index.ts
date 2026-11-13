import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/magnetism.manifest.json';

/**
 * Chapter 5 — «Магнетизм та електромагнітна індукція» (docs/volumes/electricity/chapters/magnetism.md).
 * The manifest stays tiny: titles, step ids and blurbs come from the generated manifest JSON.
 */
export default defineChapter({
  id: 'magnetism',
  order: 5,
  group: 'em',
  ...manifestText(meta, { subtitle: 'Майстерня Фарадея: від магніту до генератора' }),
  axisValue: -1, // 10⁻¹ m: a tabletop of magnets, coils and a small motor
  theme: { accent: 'magenta', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
