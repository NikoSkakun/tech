import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@electricity/content/generated/plants.manifest.json';

/**
 * «Електростанції: як первинна енергія стає струмом» — the hub of part III «Генерація»
 * (docs/volumes/electricity/chapters/plants.md). Titles, step ids and blurbs come from the generated manifest
 * (never retyped); the subtitle is the chapter's own teaser. `axisValue`: the archipelago is ≈ 300 m across
 * (10²…10³ m, log₁₀ ≈ 2.5), like the plant chapters it leads to.
 */
export default defineChapter({
  id: 'plants',
  order: meta.order,
  group: 'plants',
  ...manifestText(meta, { subtitle: 'Дев’ять способів перетворити первинну енергію на струм' }),
  axisValue: 2.5,
  // document: dominant `amber` + `yellow` energy flow; golden hour over the archipelago
  theme: { accent: 'amber', sky: 'golden', mood: 'diorama' },
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
