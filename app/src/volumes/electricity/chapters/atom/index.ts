import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/atom.manifest.json';

/**
 * Chapter 1 — «Атом і субатомні частинки» (docs/volumes/electricity/chapters/atom.md).
 *
 * The manifest is eager and must stay tiny: title, axis label, step ids, titles and blurbs come from the
 * generated `atom.manifest.json` (2 kB) — never from `atom.json` (59 kB of copy, loaded with the scene).
 * The documents carry no subtitle, so the generated one repeats the first step's title; ours is written here.
 */
export default defineChapter({
  id: 'atom',
  order: meta.order,
  group: 'micro',
  ...manifestText(meta, { subtitle: 'Від мідного дроту до кварків і назад' }),
  axisValue: -10,
  theme: { accent: 'cyan', sky: 'micro', mood: 'micro' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
