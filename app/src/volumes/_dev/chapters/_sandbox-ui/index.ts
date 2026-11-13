import { defineChapter } from '@/engine/api';

/** Kitchen sink of the widget kit (`@/ui3d`) and of the HUD's step UI. Development only. */
export default defineChapter({
  id: '_sandbox-ui',
  order: 9003,
  group: 'labs',
  title: 'Пісочниця: інтерфейс',
  subtitle: 'Усі віджети в HUD і у світі',
  axisLabel: '1 m',
  axisValue: 0,
  theme: { accent: 'cyan', sky: 'studio', mood: 'studio' },
  steps: [
    { id: 'controls', title: 'Керування', blurb: 'Кнопки, слайдери, перемикачі, вкладки, чипи.' },
    { id: 'readouts', title: 'Прилади і графіки', blurb: 'Покажчики, шкали, графіки, числа.' },
    { id: 'charts', title: 'Спеціальні графіки', blurb: 'Фазори, спектр, теплова мапа, радар.' },
    { id: 'cards', title: 'Картки і текст', blurb: 'Формули, картки, квіз, прокручування.' },
    { id: 'world', title: 'Інтерфейс у світі', blurb: 'Консоль на об’єкті, виноски, гарячі точки.' },
    { id: 'overflow', title: 'Повний пульт', blurb: 'Довгий текст і повний пульт: усе вміщується в екран.' },
    { id: 'board', title: 'Дошка і таблиці', blurb: 'Великий графік, таблиця, видимість за станом.' },
  ],
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
  dev: true,
});
