import { defineChapter } from '@/engine/api';

/**
 * Chapter 1 — «Атом і субатомні частинки» (docs/volumes/electricity/chapters/atom.md).
 *
 * The manifest is eager and must stay tiny, so it does not import the generated content (59 kB): step ids and
 * titles are repeated here and `__tests__/manifest.test.ts` asserts that they equal the generated copy.
 * Blurbs are menu teasers (not in the chapter document).
 */
export default defineChapter({
  id: 'atom',
  order: 1,
  group: 'micro',
  title: 'Атом і субатомні частинки',
  subtitle: 'Від мідного дроту до кварків і назад',
  axisLabel: '10⁻¹⁸…10⁻¹⁰ m',
  axisValue: -10,
  theme: { accent: 'cyan', sky: 'micro', mood: 'micro' },
  steps: [
    { id: 'dive-in', title: 'Усе складається з атомів', blurb: 'Пірнаємо з мідного дроту до одного атома.' },
    { id: 'anatomy', title: 'Ядро і хмара', blurb: 'Крихітне важке ядро і хмара електронів.' },
    {
      id: 'nucleus',
      title: 'Ядро: протони, нейтрони і сильна взаємодія',
      blurb: 'Що тримає протони разом попри відштовхування.',
    },
    { id: 'quarks', title: 'Кварки і глюони', blurb: 'Усередині протона: кварки на глюонних пружинах.' },
    { id: 'electron', title: 'Електрон', blurb: 'Заряд −e і маса, у 1836 разів менша за протонну.' },
    { id: 'models', title: 'Модель Бора проти квантової', blurb: 'Орбіти Бора проти хмар імовірності.' },
    {
      id: 'shells',
      title: 'Оболонки, валентні електрони і чому мідь проводить',
      blurb: 'Оболонки K, L, M, N і самотній 4s-електрон міді.',
    },
    {
      id: 'ions-photons',
      title: 'Іони і світло: стрибки між рівнями',
      blurb: 'Фотони, стрибки між рівнями та іонізація.',
    },
    {
      id: 'atom-builder',
      title: 'Конструктор атома',
      blurb: 'Зберіть власний атом із протонів, нейтронів та електронів.',
    },
    {
      id: 'standard-model',
      title: 'Стандартна модель і чотири взаємодії',
      blurb: '17 частинок і чотири взаємодії — карта мікросвіту.',
    },
  ],
  load: () => import('./scene'),
  emblem: () => import('./emblem'),
});
