/**
 * TEMPLATE — chapter manifest. Copy this directory to `src/volumes/<volume>/chapters/<your-id>/` and edit.
 * The manifest is tiny and loaded eagerly (menus and the journey map read it); the scene is a lazy chunk.
 * This copy lives outside `src/chapters/`, so it is type-checked but never discovered by the app.
 */
import { defineChapter } from '@/engine/api';

export default defineChapter({
  id: 'minimal-chapter', // must equal the directory name
  order: 1,
  group: 'micro',
  title: 'Заряд',
  subtitle: 'Мінімальний приклад розділу',
  axisLabel: '10⁻¹⁰ m',
  axisValue: -10, // log10 of the size in metres: decides the zoom direction of chapter transitions
  theme: { accent: 'cyan', sky: 'micro', mood: 'micro' },
  steps: [
    { id: 'intro', title: 'Один заряд', blurb: 'Знайомимося з електроном.' },
    { id: 'pair', title: 'Два заряди', blurb: 'Протилежні заряди притягуються.' },
  ],
  load: () => import('./scene'),
});
