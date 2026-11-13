/**
 * Captions the generated content does not carry (DECISIONS §54: plain Ukrainian; symbols and units stay
 * international). `DOC` entries are verbatim «…» quotes of the chapter document that the exporter does not list
 * in `steps[].labels` — `__tests__/labels.test.ts` checks them against the document. Everything quoted in the
 * «Інтерактив» items is read from the content (`docLabel`), not from here.
 */
export const DOC = {
  /** step 5, caption of the phone demo */
  phoneNote: 'радіохвилі теж — змінне електромагнітне поле; щільна металева сітка їх послаблює',
  /** step 4, chip beside the landscape */
  compressed: 'висоту стиснуто: шкала нелінійна',
  /** step 2, chip beside the force arrows */
  logArrows: 'довжина стрілок — логарифмічна',
  /** step 8, bridge button */
  nextMatter: 'Далі: Речовина →',
} as const;

export const L = {
  charge: {
    portion: 'Порція електронів',
    toRight: 'Праворуч →',
    toLeft: '← Ліворуч',
    reset: 'Скинути',
    moved: 'Перенесено n',
    left: 'Лівий кубик q',
    right: 'Правий кубик q',
    sum: 'Сума зарядів Σq',
    tick: 'Поділка шкали',
    brush: 'Перетягни електрони на сусідній кубик',
    cube: 'Зразок з атомів',
    drawn: 'електрони намальовано умовно',
  },
  coulomb: {
    q1: 'Заряд q₁',
    q2: 'Заряд q₂',
    r: 'Відстань r',
    force: 'Сила F',
    kind: 'Взаємодія',
    none: 'сили немає',
    drag: 'Перетягни кульку',
    chart: 'Сила і відстань',
    ride: 'Проїхати шкалою',
    electric: 'Електрична сила',
    gravity: 'Гравітація',
    ratio: 'У скільки разів сильніша',
    floors: 'Шкала сил: 40 порядків',
    sizes: 'розміри кульок умовні',
  },
  field: {
    drag: 'Перетягни заряд',
    tray: 'Візьми заряд з лотка',
    own: 'Свій набір',
    release: 'Відпустити',
    clear: 'Прибрати шпильки',
    strength: 'Напруженість |E|',
    count: 'Зарядів на столі',
    probe: 'Пробний заряд: перетягни',
    slice: 'показано зріз поля в площині столу',
    full: 'На столі вже 6 зарядів',
    path: 'Шлях пробного заряду',
    line: 'Силова лінія',
  },
  potential: {
    sign: 'Знак кульки',
    plus: '+',
    ball: 'Пробна кулька: перетягни й відпусти',
    probeA: 'Щуп A',
    probeB: 'Щуп B',
    voltage: 'Напруга U = φ_{A} − φ_{B}',
    phiA: 'φ_{A}',
    phiB: 'φ_{B}',
    same: 'Щупи на одній ізолінії: U = 0',
    lift: 'Шкала напруг',
    full: 'На рельєфі вже 4 заряди',
    roll: 'Пустити кульку',
  },
  conductor: {
    e0: 'Зовнішнє поле E₀',
    drag: 'Перетягни провідник',
    inside: 'E = 0',
    shifted: 'Зміщено електронів',
    sigma: 'Найбільша густина заряду σ',
    surface: 'Поле біля поверхні',
    out: 'поза полем',
    sensorIn: 'Датчик усередині',
    sensorOut: 'Датчик зовні',
    phoneOut: 'Телефон назовні',
    signal: 'Сигнал телефона',
    signalOn: 'є',
    signalOff: 'немає',
    corona: 'Коронний розряд',
    tipModel: 'форму поля біля вістря показано умовно',
  },
  static: {
    rub: 'Потри кульку об светр',
    charge: 'Заряд кульки q',
    voltage: 'Потенціал кульки U',
    gap: 'Іскра проб’є зазор',
    finger: 'Палець: піднеси до кульки',
    wall: 'Стіна',
    stuck: 'прилипла',
    weak: 'Заряду замало — кулька не тримається',
    discharge: 'Розрядити',
    stormU: 'Напруга розряду',
    stormI: 'Струм розряду',
    tree: 'Найвище дерево',
    cloudTop: 'Верх хмари: «+»',
    cloudBase: 'Низ хмари: «−»',
    ground: 'Наведений заряд землі',
    leader: 'Ступінчастий лідер',
  },
  capacitor: {
    u: 'Напруга U',
    area: 'Площа пластин A',
    gap: 'Зазор d',
    c: 'Ємність C',
    q: 'Заряд Q',
    n: 'Перенесено електронів',
    e: 'Поле E',
    w: 'Енергія W',
    sum: 'Сума зарядів пластин',
    breakdown: 'Пробій! Напругу скинуто',
    paschen: 'Насправді тонкий повітряний зазор витримує більше: стале пробійне поле — спрощення',
    gapChip: 'зазор між пластинами збільшено',
    plus: 'Верхня пластина: +Q',
    minus: 'Нижня пластина: −Q',
    pump: 'Джерело напруги',
    board: 'Прилади',
  },
  bridge: {
    u: 'Напруга U',
    i: 'Струм I',
    left: 'Пішло з «−»',
    arrived: 'Прийшло на «+»',
    chart: 'Розряд через лампу',
    back: 'Назад до столу',
    copper: 'Мідь: електрони вільні',
    glass: 'Скло: електрони зв’язані',
    lamp: 'Лампа',
    cap: 'Суперконденсатор 10 F',
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
