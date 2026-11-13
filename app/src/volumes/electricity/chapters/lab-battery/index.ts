import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/lab-battery.manifest.json';

/**
 * Lab «Літій-іонні акумулятори: енергія в кишені й у підвалі»
 * (docs/volumes/electricity/chapters/lab-battery.md) — child of `home`.
 *
 * The manifest is eager and must stay tiny: title, step ids, step titles and blurbs come from the generated
 * manifest file (≈ 2 kB, written by `tools/content/export_runtime.py`), never from the 67 kB content file.
 * Only the subtitle is the chapter's own (the document has none).
 */
export default defineChapter({
  id: 'lab-battery',
  order: meta.order,
  group: 'labs',
  parent: 'home',
  ...manifestText(meta, { subtitle: 'Від іона Li⁺ між шарами графіту до домашньої батареї' }),
  axisValue: -1,
  theme: { accent: 'lime', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
