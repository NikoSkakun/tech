import { defineChapter } from '@/engine/api';

/** Look-dev sandbox: clean "studio" mood for machines and lab benches. Development only. */
export default defineChapter({
  id: '_sandbox-studio',
  order: 9003,
  group: 'em',
  title: 'Пісочниця: студія',
  subtitle: 'Еталон стилю «product shot»',
  axisLabel: '10⁻¹ m',
  axisValue: -1,
  theme: { accent: 'magenta', sky: 'studio', mood: 'studio' },
  steps: [
    { id: 'hero', title: 'Індукційний стенд', blurb: 'Магніт, котушка й гальванометр.' },
    { id: 'coil', title: 'Котушка', blurb: 'Витки міді на залізному осерді.' },
    { id: 'induction', title: 'Закон Фарадея', blurb: 'Рухай магніт — з’явиться струм.' },
    { id: 'exploded', title: 'Будова', blurb: 'Стенд у розібраному вигляді.' },
  ],
  load: () => import('./scene'),
  dev: true,
});
