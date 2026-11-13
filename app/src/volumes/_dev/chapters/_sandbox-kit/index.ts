import { defineChapter } from '@/engine/api';

/** Kit parade: every model set of `@/kit` on themed islands, plus a studio turntable for QA thumbnails. Development only. */
export default defineChapter({
  id: '_sandbox-kit',
  order: 9003,
  group: 'plants',
  title: 'Пісочниця: набір моделей',
  subtitle: 'Парад параметричних моделей kit',
  axisLabel: '10² m',
  axisValue: 2,
  theme: { accent: 'teal', sky: 'day', mood: 'diorama' },
  steps: [
    { id: 'town', title: 'Природа і місто', blurb: 'Острів, ліс, село, квартал, дорога.' },
    { id: 'industry', title: 'Промисловість', blurb: 'Градирні, димар, резервуари, конвеєр, колія.' },
    { id: 'grid', title: 'Мережа', blurb: 'ЛЕП 110 kV, підстанція, фідери 10 kV, місто.' },
    { id: 'renewables', title: 'Відновлювані й дім', blurb: 'Вітер, сонце, накопичувачі, дім-лабораторія.' },
    { id: 'machines', title: 'Машини', blurb: 'Турбоагрегат, гідрогенератор, газова турбіна.' },
    { id: 'dusk', title: 'Сутінки', blurb: 'Місто вмикає світло.' },
    { id: 'night', title: 'Ніч', blurb: 'Мережа і місто вночі.' },
    { id: 'studio', title: 'Студія', blurb: 'Поворотний стіл для окремих моделей.' },
  ],
  load: () => import('./scene'),
  dev: true,
});
