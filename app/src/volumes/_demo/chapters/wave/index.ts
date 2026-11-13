import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/wave.manifest.json';

/** Demo chapter 1 of the dev-only volume `_demo` (docs/volumes/_demo/chapters/wave.md). */
export default defineChapter({
  id: 'wave',
  order: 1,
  group: 'basics',
  ...manifestText(meta),
  axisValue: 3, // 10³ Hz
  theme: { accent: 'violet', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
