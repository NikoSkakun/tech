import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/antenna.manifest.json';

/** Demo chapter 2 of the dev-only volume `_demo` (docs/volumes/_demo/chapters/antenna.md). */
export default defineChapter({
  id: 'antenna',
  order: 2,
  group: 'devices',
  ...manifestText(meta),
  axisValue: 8, // 10⁸ Hz
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
