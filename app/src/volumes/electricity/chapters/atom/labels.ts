/**
 * Scene and control captions that the generated export does not carry (UI_API §2): control labels quoted «…»
 * in the document's «Інтерактив» items (verbatim), chip texts named in «Бачимо», and callouts
 * (plain Ukrainian, DECISIONS §54 — no «English — українською» pairs). Panel copy never lives here — see
 * `content.ts`.
 *
 * Captions the document quotes «…» in «Інтерактив» are exported per step (`steps[].labels`); they are read
 * from there with `doc(step, wording)`, not retyped.
 */
import raw from '@electricity/content/generated/atom.json';
import type { StepId } from './chapter';

/**
 * A UI label of the document, from the export. The caller names it by its wording rather than by its index,
 * so an edit of the document cannot silently shift another caption into the control: if the wording is gone
 * the chapter fails to load (and `__tests__/manifest.test.ts` with it).
 */
function doc(step: StepId, wording: string): string {
  const label = raw.steps.find((s) => s.id === step)?.labels?.find((l) => l === wording);
  if (label === undefined) throw new Error(`atom: step '${step}' has no label «${wording}» in the document`);
  return label;
}
/** The items of a label written «A | B | C» in the document (segmented controls). */
const docItems = (step: StepId, wording: string): string[] => doc(step, wording).split(' | ');

const [PROTON, NEUTRON] = docItems('quarks', 'Протон | Нейтрон');
const [BOHR, QUANTUM] = docItems('models', 'Бор | Квантова');
const [STRONG, ELECTROMAGNETIC, WEAK, GRAVITY] = docItems(
  'standard-model',
  'Сильна | Електромагнітна | Слабка | Гравітація',
);

/** A document phrase used as a caption of its own: first letter upper-cased. */
const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const L = {
  ruler: { title: 'Масштаб' },
  diveIn: {
    wheel: 'Колесо масштабу',
    hint: 'Покрутіть колесо масштабу — пірнайте в дріт',
    wire: 'Мідний дріт 1,5 mm²',
    face: 'Торець жили: ⌀ 1,38 mm',
    grains: 'Зерна міді: десятки μm',
    lattice: 'Кристалічна ґратка: 0,256 nm між атомами',
    atom: 'Атом міді: ⌀ ≈ 0,26 nm',
    scale: 'Масштаб кадру',
  },
  anatomy: {
    trueScale: doc('anatomy', 'Справжні пропорції'),
    pea: doc('anatomy', 'Горошина / стадіон'),
    ball: doc('anatomy', 'М’яч / місто'),
    enlarged: 'Ядро',
    enlargedChip: 'ядро збільшено ×1000',
    marker: 'Ядро тут: у 27 000 разів менше за атом',
    cloud: 'Електронна хмара',
    massNucleus: 'Маса: ядро 99,97 %',
    massElectrons: 'електрони 0,025 %',
    peaCaption: 'Горошина 7 mm → атом ⌀ ≈ 190 m',
    ballCaption: 'Футбольний м’яч 22 cm → атом ⌀ ≈ 6 km (ціле місто)',
    massBar: 'Шкала мас',
  },
  nucleus: {
    hint: 'Витягни протон — потягніть підсвічений протон від ядра',
    drag: 'Витягни протон',
    proton: 'Протон p⁺',
    neutron: 'Нейтрон n⁰',
    strong: 'Сильна F_s',
    coulomb: 'Кулонівська F_C',
    distance: 'Відстань r',
    removeNeutrons: 'Прибрати нейтрони',
    escape:
      'Насправді вирвати протон зі стабільного ядра можна лише дуже енергійним ударом — потрібно кілька мільйонів електронвольтів (MeV)',
    pair: 'У справжньому ядрі на протон діє відштовхування від усіх 28 інших протонів, а сильна взаємодія зв’язує його лише з найближчими сусідами; тут для наочності порівнюється одна пара.',
    chartX: 'r, fm',
    chartY: 'F, N',
  },
  quarks: {
    hint: 'Спробуй вирвати кварк — потягніть будь-який кварк назовні',
    proton: PROTON!,
    neutron: NEUTRON!,
    sum: 'Сума зарядів',
    energy: 'Енергія струни E = σ·d',
    stretch: 'Розтяг d',
    pion: 'π⁰ — піон',
    broke: 'Енергія, якою ви тягнули, перетворилася на нові частинки. Самотнього кварка отримати неможливо',
    massQuarks: 'кварки ≈ 1 %',
    massField: 'енергія поля ≈ 99 %',
    massBar: 'Маса протона',
    colour: 'Кольоровий заряд: R / G / B',
    glass: 'Протон: uud',
    glassN: 'Нейтрон: udd',
  },
  electron: {
    add1: '+1 e⁻',
    add100: '+100 e⁻',
    add1000: '+1000 e⁻',
    reset: doc('electron', 'Скинути'),
    count: 'Електронів на шальці',
    balanced: doc('electron', '1836 електронів = 1 протон'),
    compare: doc('electron', 'Порівняти заряди'),
    compareMass: 'Порівняти маси',
    charges: doc('electron', '|q_p| = |q_e|'),
    hint: 'Скільки електронів урівноважать один протон? Сипте їх на шальку',
    spin: 'Спін s = ½',
    hero: 'Електрон e⁻',
    scales: 'Терези мас',
    scalesCharge: 'Заряд-ваги',
  },
  models: {
    model: 'Модель',
    bohr: BOHR!,
    quantum: QUANTUM!,
    orbital: 'Орбіталь',
    orientP: 'Гантель уздовж осі',
    along: { x: 'x', y: 'y', z: 'z' },
    orientD: 'Орієнтація 3d-орбіталі',
    clover: { z2: 'z²', xz: 'xz', xy: 'xy' },
    samples: doc('models', 'Вимірювань'),
    level: 'Рівень n',
    energy: 'Енергія E_n',
    radius: 'Радіус орбіти r_n',
    hint: 'Перемкніть модель: орбіта Бора чи хмара ймовірності',
    orbit: 'Орбіта n = ',
    nucleus: 'Протон (ядро водню)',
  },
  shells: {
    group11: doc('shells', 'Група 11'),
    filling: doc('shells', 'Показати порядок заповнення'),
    hint: 'Наведіть на плитку таблиці — атом перебудується',
    shellsLabel: 'Оболонки',
    valence: 'Валентних електронів',
    outerS: doc('shells', 's-електрони зовнішньої оболонки'),
    config: 'Конфігурація',
    valenceE: '4s¹ — валентний електрон',
    exception: 'Виняток: 4s заповнюється раніше за 3d',
    back: 'До міді',
    element: 'Елемент',
  },
  photons: {
    energy: 'Енергія фотона E',
    fire: doc('ions-photons', 'Вогонь!'),
    volley: 'Залп ×10',
    clear: doc('ions-photons', 'Очистити спектр'),
    passed: sentence(doc('ions-photons', 'не поглинуто: енергія не збігається з жодним переходом')),
    ion: 'H⁺ (іон)',
    uv: 'UV',
    ir: 'IR',
    hint: 'Намацайте енергію, яку атом поглинає, і тисніть «Вогонь!»',
    wavelength: 'Довжина хвилі λ',
    level: 'Рівень n',
    kinetic: 'E_k електрона',
    gun: 'Фотонна гармата',
    limit: '0 eV — межа іонізації',
    spectrum: 'Спектр 380–750 nm',
    slowed: 'сповільнено ≈ у мільярд разів',
  },
  builder: {
    plus: doc('atom-builder', '+'),
    minus: doc('atom-builder', '−'),
    protons: 'Протони p⁺',
    neutrons: 'Нейтрони n⁰',
    electrons: 'Електрони e⁻',
    hydrogen: doc('atom-builder', 'Водень'),
    helium4: doc('atom-builder', 'Гелій-4'),
    carbon12: doc('atom-builder', 'Карбон-12'),
    iron56: doc('atom-builder', 'Залізо-56'),
    copper63: doc('atom-builder', 'Мідь-63'),
    copperIon: doc('atom-builder', 'Cu⁺'),
    noAtom: 'Лише нейтрони — це не атом',
    stable: 'стабільний',
    practicallyStable: 'стабільний (практично)',
    radioactive: 'радіоактивний: T½ = ',
    instant: 'розпадається миттєво (≪ 1 s)',
    fastDecay: 'нестабільне ядро: швидко розпадається (T½ — від часток секунди до десятків годин)',
    unbound: 'таке ядро не утримується: розпадається практично миттєво',
    protium: 'протон / іон H⁺ без електрона або атом протію з електроном',
    neutral: 'нейтральний атом',
    cation: 'катіон',
    anion: 'аніон',
    anionUnstable: 'такий аніон нестійкий: зайвий електрон одразу відлітає',
    firstIsotope: doc('atom-builder', 'Перший ізотоп'),
    firstIon: doc('atom-builder', 'Перший іон'),
    copperDone: doc('atom-builder', 'Мідь зібрано!'),
    hint: 'Додавайте частинки — спробуйте зібрати мідь',
    charge: 'Заряд',
    years: 'р.',
    thousand: 'тис.',
    million: 'млн',
    billion: 'млрд',
    dayForms: 'доба|доби|діб',
    basket: 'Натисніть кошик, щоб додати частинку',
    status: 'Ядро',
    isotope: 'Ізотоп',
    presets: 'Готові атоми',
    composition: 'Склад',
    nucleus: 'Ядро',
    config: 'Конфігурація',
    element: 'Атом',
  },
  sm: {
    ordinary: doc('standard-model', 'Звичайна речовина'),
    strong: STRONG!,
    electromagnetic: ELECTROMAGNETIC!,
    weak: WEAK!,
    gravity: GRAVITY!,
    interaction: 'Взаємодія',
    next: 'Далі: Заряд і поле →',
    hint: 'Натисніть на жетон частинки — відкриється її картка',
    charge: 'Заряд',
    spin: 'Спін',
    mass: 'Маса',
    discovered: 'Відкрито',
    where: sentence(doc('standard-model', 'де трапляється')),
    quarks: 'Кварки',
    leptons: 'Лептони',
    bosons: 'Бозони',
    beta: 'β-розпад: n → p + e⁻ + ν̄_e',
    noCarrier: 'Гравітація не входить у Стандартну модель',
  },
} as const;

/** `diveIn.wheel` → text: the flat map handed to `defineContent` (the HUD exposes it as `content.labels`). */
export const FLAT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(L).flatMap(([group, items]) =>
    Object.entries(items).flatMap(([key, text]) =>
      typeof text === 'string'
        ? [[`${group}.${key}`, text]]
        : Object.entries(text).map(([sub, t]) => [`${group}.${key}.${sub}`, t]),
    ),
  ),
);
