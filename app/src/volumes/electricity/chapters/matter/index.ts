import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/matter.manifest.json';

/**
 * Chapter 3 — «Провідники, ізолятори, напівпровідники» (docs/volumes/electricity/chapters/matter.md).
 * Eager and tiny: titles, step ids and blurbs come from the generated manifest (never retyped).
 */
export default defineChapter({
  id: 'matter',
  order: 3,
  group: 'micro',
  ...manifestText(meta, { subtitle: 'Мідь, скло, кремній — і p-n перехід' }),
  // 10⁻⁹ m: a block of a few nanometres of crystal is the hero of every step
  axisValue: -9,
  // document: `teal` dominant, `cyan` (electrons) and `coral` (holes, ion cores) supporting; micro "inner space"
  theme: { accent: 'teal', sky: 'micro', mood: 'micro' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
