import { defineContent } from '@/content';

/** All Ukrainian text of the diorama sandbox (term rule: international term first). */
const text = {
  steps: {
    island: {
      title: 'Острів',
      body:
        'Цей маленький світ — еталон стилю діорам: **floating island** — летючий острів із вітровою турбіною, ' +
        'лінією електропередачі та будинками. Усе живе: вода, хмари, птахи.',
    },
    wind: {
      title: 'Вітер',
      body:
        '**Wind turbine** — вітрова турбіна: потужність росте як куб швидкості вітру, `P = ½·ρ·A·v³·C_{p}`. ' +
        'Проведи по лопатях, щоб змінити вітер від 3 до 25 m/s.',
    },
    line: {
      title: 'Лінія',
      body:
        'Жовті імпульси — це {yellow:потік енергії}: що більша потужність, то вони яскравіші й частіші. ' +
        'Лінія 10 kV несе її до будинків майже без втрат.',
    },
    dusk: {
      title: 'Сутінки',
      body:
        'Сонце сідає — споживання росте. У вікнах загоряється світло: кожна **LED**-лампа бере лише 8 W, ' +
        'але їх багато.',
    },
    night: {
      title: 'Ніч',
      body:
        'Уночі вітер часто дужчає. Турбіна на 2 MW за годину виробляє до `2 MWh` — цього вистачить приблизно ' +
        'на 200 осель на добу.',
    },
  },
  labels: {
    turbine: 'Wind turbine — вітрова турбіна',
    line: 'Лінія 10 kV',
    house: 'Споживач',
    tank: 'Water tank — водонапірний бак',
    wind: 'Вітер',
  },
} as const;

/** Scene labels (callouts, tooltips, Text3D captions). */
export const labels = text.labels;

/** Step panels: the HUD shows them (UI_API §2) — one page per step, in the manifest's order. */
export default defineContent(
  {
    id: '_sandbox-diorama',
    steps: Object.entries(text.steps).map(([id, s]) => ({ id, title: s.title, panel: [s.body] })),
  },
  { labels },
);
