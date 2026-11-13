import { defineContent } from '@/content';

/** All Ukrainian text of the studio sandbox (term rule: international term first). */
const text = {
  steps: {
    hero: {
      title: 'Індукційний стенд',
      body:
        '**Electromagnetic induction** — електромагнітна індукція: рухомий магніт створює струм у котушці. ' +
        'Перед тобою найпростіший генератор — магніт, котушка й вимірювач.',
    },
    coil: {
      title: 'Котушка',
      body:
        '**Coil** — котушка: `N` витків мідного дроту на каркасі. Залізне осердя (**iron core**) збирає ' +
        'магнітний потік `Φ`: що більше витків і потоку, то більша напруга.',
    },
    induction: {
      title: 'Закон Фарадея',
      body:
        'Рухай магніт: стрілка відхиляється лише тоді, коли потік _змінюється_. ' +
        '**Faraday’s law**: `EMF = −N·dΦ/dt`. Швидший рух — більша напруга, зупинка — нуль.',
    },
    exploded: {
      title: 'Будова',
      body:
        'Каркас, обмотка, осердя, магніт на напрямній і **galvanometer** — гальванометр. ' +
        'Жодних батарейок: енергію дає лише рух магніта.',
    },
  },
  labels: {
    coil: 'Coil — котушка',
    core: 'Iron core — осердя',
    magnet: 'Magnet — магніт',
    meter: 'Galvanometer — гальванометр',
    field: 'Magnetic field B',
  },
} as const;

/** Scene labels (callouts, tooltips, Text3D captions). */
export const labels = text.labels;

/** Step panels: the HUD shows them (UI_API §2) — one page per step, in the manifest's order. */
export default defineContent(
  {
    id: '_sandbox-studio',
    steps: Object.entries(text.steps).map(([id, s]) => ({ id, title: s.title, panel: [s.body] })),
  },
  { labels },
);
