import { defineChapter } from '@/engine/api';

/** Gallery of the shared effects library (`@/fx`) and the audio engine. Development only. */
export default defineChapter({
  id: '_sandbox-fx',
  order: 9003,
  group: 'em',
  title: 'Пісочниця: ефекти',
  subtitle: 'Галерея бібліотеки ефектів',
  axisLabel: '1 m',
  axisValue: 0,
  theme: { accent: 'cyan', sky: 'studio', mood: 'studio' },
  steps: [
    { id: 'characters', title: 'Частинки-персонажі', blurb: 'Electron, proton, neutron, photon, ion, quarks, gluon, hole.' },
    { id: 'fields', title: 'Електричне поле', blurb: 'Лінії поля, потенціальний рельєф, вектор у точці.' },
    { id: 'induction', title: 'Магнітне поле та індукція', blurb: 'Лінії B, потік крізь котушку, індукований струм.' },
    { id: 'flow', title: 'Потоки і провідники', blurb: 'DC ↔ AC, розгалуження, імпульси енергії, промінь.' },
    { id: 'thermal', title: 'Тепло, пара і вода', blurb: 'Полум’я, пара, дим, градирня, потік води, бульбашки.' },
    { id: 'machine', title: 'Машини зсередини', blurb: 'Розріз, рознесений вигляд, обертання, рентген, підсвітка.' },
    { id: 'signals', title: 'Сигнали', blurb: 'Осцилограф, фазори, ШІМ, спектр, хвиля в дроті.' },
    { id: 'drama', title: 'Розряди і світло', blurb: 'Дуга, корона, коротке замикання, іскри, промені світла.' },
  ],
  load: () => import('./scene'),
  dev: true,
});
