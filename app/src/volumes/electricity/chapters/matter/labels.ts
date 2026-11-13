/**
 * Captions the generated content does not carry (DECISIONS §54: plain Ukrainian; symbols and units stay
 * international). `DOC` entries are verbatim «…» quotes of the chapter document that the exporter does not list
 * in `steps[].labels` — `__tests__/manifest.test.ts` checks them against the document. Everything quoted in the
 * «Інтерактив» items is read from the content (`docLabel`), not from here.
 */
export const DOC = {
  /** step 3, material switch */
  bandMaterials: 'Мідь | Германій | Кремній | Арсенід галію | Алмаз | Скло (SiO₂)',
  /** step 3, chip beside the band tower */
  simplified: 'спрощена модель',
  /** step 3, n_i of diamond and glass (§3) */
  niZero: '≈ 0 (менше 1 на кубокілометр)',
  /** step 2, chips */
  slowed: 'сповільнено у 5×10¹⁴ разів',
  balls: 'спрощена модель: електрони показано кульками',
  driftChip: 'дрейф збільшено в 100\u00a0млн разів',
  transferred: 'сумарне перенесення',
  /** steps 6–9, caption of the planar scheme */
  planar: 'площинна схема; справжня ґратка — тривимірна (типу алмазу)',
  /** step 7, dopant labels and counters */
  phosphorus: 'P, 5\u00a0e⁻',
  boron: 'B, 3\u00a0e⁻',
  freeElectrons: 'вільних електронів n',
  holes: 'дірок p',
  /** step 8 chip */
  notToScale: 'не в масштабі',
  /** step 9, LED material by E_g (§9) */
  ledIr: 'GaAs / AlGaAs (IR)',
  ledRed: 'AlGaInP (червоний–жовтий)',
  ledGreen: 'InGaN (зелений)',
  ledBlue: 'InGaN (синій)',
  ledUv: 'AlGaN / GaN (UV)',
  /** step 9, bridge to `current` */
  nextCurrent: 'Далі: Електричне коло →',
  bridgeLine: 'Ми знаємо, чому мідь проводить. Тепер змусимо електрони текти',
} as const;

export const L = {
  lattice: {
    cell: 'Елементарна комірка',
    ion: 'Іонний остов Cu⁺',
    sea: 'Море електронів',
    ruler: 'a = 0,3615 nm',
    count: '8·⅛ + 6·½ = 4 атоми',
    corner: 'вершина: ⅛ атома',
    face: 'грань: ½ атома',
  },
  sea: {
    field: 'Напруженість поля E',
    drift: 'Дрейф v_d',
    ratio: 'v_d : v_F',
    temp: 'Температура',
    scatters: 'Розсіювань за секунду',
    fieldArrow: 'поле E',
    driftArrow: 'дрейф електронів',
    follow: 'один електрон',
  },
  bands: {
    gap: 'Заборонена зона E_g',
    ni: 'Власна концентрація n_i',
    valence: 'Валентна зона',
    conduction: 'Зона провідності',
    axis: 'Енергія E',
  },
  ins: {
    voltage: 'Напруга U',
    field: 'Поле E = U/d',
    strength: 'Електрична міцність E_b',
    broken: 'Пробито: обвуглений канал уже проводить',
    minus: 'Електрод «−»',
    plus: 'Електрод «+»',
    gap: 'Проміжок d = 1 mm',
  },
  res: {
    temp: 'Температура t',
    hgTemp: 'Температура ртуті T',
    rho: 'Питомий опір ρ',
    alpha: 'Температурний коефіцієнт α',
    hours: 'Струм у кільці, годин',
    chart: 'Питомий опір і температура',
    impurity: 'Домішка',
    mercury: 'Ртуть Hg у кріостаті',
    ringOn: 'Кільце: струм не згасає',
    ringOff: 'Кільце: струм згас',
  },
  si: {
    drag: 'Перетягни дірку',
    ni: 'Власна концентрація n_i',
    rho: 'Питомий опір ρ',
    hole: 'Дірка',
    free: 'Вільний електрон',
    bond: 'Зв’язок: 2 спільні електрони',
  },
  dop: {
    nd: 'Фосфор (донори) N_D',
    na: 'Бор (акцептори) N_A',
    drag: 'Перетягни P або B з лотка у вузол ґратки',
    nHead: 'n-тип (P)',
    pHead: 'p-тип (B)',
    rho: 'Питомий опір ρ',
    charge: 'Сумарний заряд',
    nSide: 'n-тип · заряд 0',
    pSide: 'p-тип · заряд 0',
  },
  pn: {
    source: 'Напруга джерела U_s',
    ud: 'На діоді U_D',
    i: 'Струм I',
    w: 'Збіднена область W',
    barrier: 'Бар’єр',
    chart: 'Вольт-амперна характеристика',
    p: 'p-область: дірки',
    n: 'n-область: електрони',
    hill: 'Бар’єр для електронів',
    resistor: 'Резистор 220 Ω',
  },
  dev: {
    eg: 'Заборонена зона E_g',
    g: 'Освітленість G',
    ugs: 'Напруга затвора U_GS',
    material: 'Матеріал',
    fan: 'Вентилятор',
    lampI: 'Струм лампи',
    chart: 'Випрямляч: вхід і вихід',
    input: 'вхід',
    output: 'вихід',
  },
} as const;

type Leaves<T> = { [K in keyof T]: T[K] extends string ? string : Leaves<T[K]> };

/** `group.key` → caption, the shape `defineContent({ labels })` expects. */
export const FLAT_LABELS: Record<string, string> = Object.fromEntries([
  ...Object.entries(DOC).map(([k, v]) => [`doc.${k}`, v] as const),
  ...Object.entries(L as Leaves<typeof L>).flatMap(([g, group]) =>
    Object.entries(group).map(([k, v]) => [`${g}.${k}`, v as string] as const),
  ),
]);
