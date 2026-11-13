import { defineChapter } from '@/engine/api';

/** Look-dev sandbox: micro-world "inner space" mood. Development only. */
export default defineChapter({
  id: '_sandbox-micro',
  order: 9001,
  group: 'micro',
  title: 'Пісочниця: мікросвіт',
  subtitle: 'Еталон стилю «inner space»',
  axisLabel: '10⁻¹⁰ m',
  axisValue: -10,
  theme: { accent: 'cyan', sky: 'micro', mood: 'micro' },
  steps: [
    { id: 'atom', title: 'Атом', blurb: 'Ядро та електронна хмара.' },
    { id: 'nucleus', title: 'Ядро', blurb: 'Protons і neutrons, щільно стиснуті разом.' },
    { id: 'electron', title: 'Електрон', blurb: 'Носій негативного заряду.' },
    { id: 'excited', title: 'Збуджений стан', blurb: 'Перетягни електрон на вищий рівень.' },
  ],
  load: () => import('./scene'),
  dev: true,
});
