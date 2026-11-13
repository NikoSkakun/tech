import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/lab-pv.manifest.json';

/**
 * Lab «Сонячні панелі: від фотона до масиву» (docs/volumes/electricity/chapters/lab-pv.md) — child of `home`.
 * Titles, step ids and blurbs come from the generated manifest (never retyped); the subtitle is the chapter's own.
 */
export default defineChapter({
  id: 'lab-pv',
  order: 22,
  group: 'labs',
  parent: 'home',
  ...manifestText(meta, { subtitle: 'Від фотона в кремнії до масиву на даху' }),
  axisValue: 0, // the hero is a 1.7 m module; the chapter dives to 10⁻⁹ m and climbs to the roof
  theme: { accent: 'sky', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
