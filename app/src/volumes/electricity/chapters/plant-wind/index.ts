import { defineChapter } from '@/engine/api';

/**
 * «Вітрова електростанція (ВЕС)» — child of the `plants` hub (docs/volumes/electricity/chapters/plant-wind.md).
 *
 * The manifest is eager, so it must stay tiny: it mirrors the chapter title and the step ids / titles of
 * `@electricity/content/generated/plant-wind.json` by hand instead of importing 65 kB of copy into the entry chunk.
 * `__tests__/manifest.test.ts` fails when the mirror drifts from the generated content.
 */
export default defineChapter({
  id: 'plant-wind',
  order: 13, // № in docs/volumes/electricity/INDEX.md — also the order among the children of `plants`
  group: 'plants',
  parent: 'plants',
  title: 'Вітрова електростанція (ВЕС)',
  subtitle: 'Вітер, що крутить генератори',
  axisLabel: '10²…10³ m',
  axisValue: 2.5,
  // document: dominant `sky`, support `teal` (plantType.wind) + `yellow` energy flow; clear windy day
  theme: { accent: 'sky', sky: 'day', mood: 'diorama' },
  steps: [
    { id: 'overview', title: 'Вітер, що крутить генератори', blurb: '' },
    { id: 'wind-power', title: 'Енергія вітру: закон куба', blurb: '' },
    { id: 'betz', title: 'Межа Беца: чому не можна забрати весь вітер', blurb: '' },
    { id: 'blade', title: 'Лопать — це крило', blurb: '' },
    { id: 'nacelle', title: 'Гондола в розрізі', blurb: '' },
    { id: 'drivetrain', title: 'Мультиплікатор чи прямий привод: три способи зробити 50\u00a0Hz', blurb: '' },
    { id: 'power-curve', title: 'Крива потужності: від штилю до шторму', blurb: '' },
    { id: 'wind-farm', title: 'ВЕС як команда: аеродинамічний слід і збірна мережа', blurb: '' },
    { id: 'capacity-factor', title: 'Рік вітру: КВВП і змінність', blurb: '' },
    { id: 'offshore', title: 'Морська ВЕС: велетні на воді', blurb: '' },
    { id: 'role', title: 'Плюси, мінуси і роль в енергосистемі', blurb: '' },
  ],
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
