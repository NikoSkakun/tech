import {
  Button,
  Card,
  Chip,
  FormulaBlock,
  Label,
  Legend,
  PLANT_TYPE,
  Pager,
  Panel,
  QuizCard,
  ScrollView,
  TEXT_COLOR,
  ToastStack,
  UiNode,
  col,
  row,
} from '@/ui3d';

const LONG = [
  '**Electromagnetic induction** — електромагнітна індукція: зміна магнітного потоку `Φ` крізь контур наводить у ньому електрорушійну силу `EMF = −dΦ/dt`. Саме так працюють генератори, трансформатори й індукційні плити.',
  'Знак «мінус» — це **Lenz’s law — правило Ленца**: наведений струм завжди протидіє зміні, яка його викликала. Тому магніт, що падає крізь мідну трубу, сповільнюється, а генератор під навантаженням «важче» крутити.',
  'У трифазній системі три ЕРС зсунуті на `120°`: `u₁ = U_m·sin ωt`, `u₂ = U_m·sin(ωt − 2π/3)`, `u₃ = U_m·sin(ωt + 2π/3)`. Сума миттєвих значень дорівнює нулю — нейтральний провід симетричного навантаження не несе струму.',
  'Для мережі 50 Hz кутова частота `ω = 2πf ≈ 314 rad/s`, амплітуда фазної напруги `U_m = 230·√2 ≈ 325 V`, лінійної — `400·√2 ≈ 566 V`.',
];

/** Cards, formulas, quiz, paged and scrolling text, legend, toasts. */
export function cardsDemo(): UiNode {
  const toasts = new ToastStack({ float: { ax: 0.5, ay: 0, dy: -70 } });
  const card = new Card({
    kicker: 'Гаряча точка',
    icon: 'info',
    title: 'Контактні кільця',
    body: 'Через кільця і щітки на обмотку ротора подається постійний струм збудження: він створює магнітне поле, що обертається разом із ротором.',
    details:
      'У сучасних турбогенераторах щітки часто замінює **brushless exciter** — безщітковий збудник: невеликий генератор на тому самому валу з обертовим випрямлячем. Менше іскріння, менше обслуговування.',
    extra: [
      row(
        { gap: 8, wrap: true, width: 'fill' },
        new Chip({ kind: 'term', text: 'збудження', onClick: () => undefined }),
        new Chip({ kind: 'status', text: 'у нормі' }),
      ),
    ],
    onClose: () =>
      toasts.push('У справжньому розділі картка закрилася б; тут це лише демонстрація.', { duration: 3 }),
  });
  const pager = new Pager({
    pages: LONG.slice(0, 3).map((t) => new Label(t, { size: 19, lineHeight: 1.46 }, { width: 'fill' })),
  });
  const scroll = new ScrollView({
    height: 200,
    gap: 12,
    children: LONG.map(
      (t) => new Label(t, { size: 17, color: TEXT_COLOR.dim, lineHeight: 1.42 }, { width: 'fill' }),
    ),
  });
  const quiz = new QuizCard({
    width: 500,
    items: [
      {
        question: 'Що утримує протони в ядрі, попри їхнє кулонівське відштовхування?',
        options: ['гравітація', 'сильна взаємодія', 'електрони', 'магнітне поле ядра'],
        correct: 1,
        explanation:
          'сильна взаємодія на відстанях ~1 fm приблизно в сто разів перевищує електричне відштовхування.',
      },
      {
        question: 'Яка частота в енергосистемі Європи?',
        options: ['50 Hz', '60 Hz', '400 Hz'],
        correct: 0,
        explanation: 'ENTSO-E працює на 50 Hz; 60 Hz — Північна Америка.',
      },
    ],
  });
  const legend = new Legend({
    items: [
      { label: 'АЕС', color: PLANT_TYPE.nuclear, swatch: 'box' },
      { label: 'ГЕС', color: PLANT_TYPE.hydro, swatch: 'box' },
      { label: 'ВЕС', color: PLANT_TYPE.wind, swatch: 'box' },
      { label: 'СЕС', color: PLANT_TYPE.solar, swatch: 'box' },
      { label: 'реактивний струм', color: 'sky', swatch: 'dash' },
    ],
  });
  return new UiNode({
    dir: 'row',
    gap: 18,
    align: 'start',
    children: [
      col(
        { gap: 14 },
        card,
        new Panel({
          variant: 'card',
          width: 400,
          gap: 10,
          children: [
            new FormulaBlock({ formula: 'EMF = −N · dΦ/dt', note: 'ЕРС індукції в котушці з N витків' }),
            new FormulaBlock({
              formula: 'P = √3 · U_L · I_L · cos φ',
              note: 'активна потужність трифазної системи',
            }),
            legend,
          ],
        }),
      ),
      col(
        { gap: 14 },
        new Panel({
          width: 470,
          gap: 12,
          children: [
            new Label('Сторінки і прокручування', { font: 'display', size: 26 }),
            pager,
            scroll,
            row(
              { gap: 10 },
              new Button({
                label: 'Підказка',
                icon: 'info',
                onClick: () => toasts.push('Тягніть сцену, щоб обертати її.', { icon: 'hand' }),
              }),
              new Button({
                label: 'Увага',
                icon: 'warning',
                onClick: () => toasts.push('Частота нижча за 49,8 Hz.', { tone: 'warning' }),
              }),
            ),
            toasts,
          ],
        }),
      ),
      quiz,
    ],
  });
}
