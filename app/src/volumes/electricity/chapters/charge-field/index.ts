import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/charge-field.manifest.json';

/**
 * Chapter 2 — «Заряд і електричне поле» (docs/volumes/electricity/chapters/charge-field.md).
 * Eager and tiny: titles, step ids and blurbs come from the generated manifest (never retyped).
 */
export default defineChapter({
  id: 'charge-field',
  order: 2,
  group: 'micro',
  ...manifestText(meta, { subtitle: 'Сили, лінії поля, потенціал і конденсатор' }),
  // 10⁻¹⁰…10⁻² m: the chapter climbs from single electrons to table-top experiments
  axisValue: -6,
  // document: `amber` dominant (electric field), `coral` (+) and `cyan` (−) supporting; micro "inner space"
  theme: { accent: 'amber', sky: 'micro', mood: 'micro' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
