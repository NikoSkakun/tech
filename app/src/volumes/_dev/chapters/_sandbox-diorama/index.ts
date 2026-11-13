import { defineChapter } from '@/engine/api';

/** Look-dev sandbox: floating-island diorama mood. Development only. */
export default defineChapter({
  id: '_sandbox-diorama',
  order: 9002,
  group: 'plants',
  title: 'Пісочниця: діорама',
  subtitle: 'Еталон стилю «tabletop world»',
  axisLabel: '10² m',
  axisValue: 2,
  theme: { accent: 'yellow', sky: 'day', mood: 'diorama' },
  steps: [
    { id: 'island', title: 'Острів', blurb: 'Маленький світ, де народжується електрика.' },
    { id: 'wind', title: 'Вітер', blurb: 'Турбіна перетворює рух повітря на електроенергію.' },
    { id: 'line', title: 'Лінія', blurb: 'Енергія біжить проводами до споживача.' },
    { id: 'dusk', title: 'Сутінки', blurb: 'Вмикається світло у вікнах.' },
    { id: 'night', title: 'Ніч', blurb: 'Острів живе на енергії вітру.' },
  ],
  load: () => import('./scene'),
  dev: true,
});
