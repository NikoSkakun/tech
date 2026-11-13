/**
 * Manifest data generated from the chapter documents (`<volume>/content/generated/<id>.manifest.json`, ≈ 1–3 kB each): an eager
 * `index.ts` imports it instead of retyping titles or importing the whole content file.
 *
 *   import meta from '@electricity/content/generated/plant-wind.manifest.json';
 *   export default defineChapter({ id: 'plant-wind', order: 13, group: 'plants', parent: 'plants',
 *     ...manifestText(meta), axisValue: 2.5, theme: { … }, load: () => import('./scene') });
 */
import type { ChapterMeta } from './types';

/** Title, subtitle, axis label and steps (ids, titles, blurbs) of a generated manifest file. */
export function manifestText(
  meta: ChapterMeta,
  override: { subtitle?: string; blurbs?: Readonly<Record<string, string>> } = {},
): {
  title: string;
  subtitle: string;
  axisLabel: string;
  steps: { id: string; title: string; blurb: string }[];
} {
  return {
    title: meta.title,
    subtitle: override.subtitle ?? meta.subtitle,
    axisLabel: meta.axisLabel,
    steps: meta.steps.map((s) => ({ id: s.id, title: s.title, blurb: override.blurbs?.[s.id] ?? s.blurb })),
  };
}
