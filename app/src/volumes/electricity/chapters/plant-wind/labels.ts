/**
 * Scene labels the generated content does not carry: callouts, readout captions, chart titles, chips.
 * DECISIONS §54: plain Ukrainian; an international abbreviation only where the learner meets it on real
 * equipment, after the Ukrainian words («лінія постійного струму (HVDC)»); symbols and units international.
 * `QUOTED` are wordings the document gives in «Бачимо» (not exported as labels) — the test checks that each
 * of them still stands in the document.
 */
export const QUOTED = {
  // step 7 — the four zones of the power curve
  zone1: 'I · штиль',
  zone2: 'II · ловимо максимум',
  zone3: 'III · номінал, скидаємо зайве',
  zone4: 'IV · шторм — стоп',
  // step 11 — the three portals
  portalHub: 'Хаб: Електростанції',
  portalSolar: 'Далі: Сонячна СЕС',
  portalGrid: 'Енергосистема: як балансувати вітер',
} as const;

export const SCENE = {
  ...QUOTED,
  // step 1 — overview
  flyAround: 'Обліт острова',
  // step 2 — wind-power
  v: 'Швидкість вітру v',
  d: 'Діаметр ротора D',
  t: 'Температура T',
  pWind: 'Потужність потоку P',
  area: 'Площа ротора A',
  airSecond: 'Повітря за 1 s',
  // step 3 — betz
  a: 'Осьова індукція a',
  cp: 'Коефіцієнт потужності C_{p}',
  aHint:
    'Тут модель ідеального диска вже не працює: при a = 0,5 повітря за ротором мало б зупинитися, а при більших — текти назад',
  presetFree: 'Не гальмує',
  presetBlock: 'Стіна',
  presetBetz: 'Оптимум',
  vRotor: 'v у площині ротора',
  vWake: 'v за ротором',
  // step 4 — blade
  alpha: 'Кут атаки α',
  twist: 'Кут установлення θ',
  windV: 'v — вітер',
  windOmega: 'ω·r — зустрічний потік',
  windRel: 'v_{rel} — уявний вітер',
  lift: 'F_{L} — підіймальна сила',
  drag: 'F_{D} — лобовий опір',
  torque: 'Тягне лопать уперед',
  stall: 'Зрив потоку',
  stallMark: 'зрив',
  polar: 'Коефіцієнти профілю',
  liftCurve: 'C_{L} — підіймальна сила',
  dragCurve: 'C_{D} — опір',
  twistView: 'Закрутка лопаті',
  root: 'корінь',
  tip: 'кінчик',
  flowModel: 'обтікання без в’язкості; зрив — якісно',
  rotorPlane: 'Площина обертання',
  viewAlong: 'Вигляд уздовж лопаті: площина обертання — горизонтально, вітер дме знизу',
  // step 5 — nacelle
  technician: 'Технік — для масштабу',
  // step 6 — drivetrain
  rotorRpm: 'Оберти ротора',
  genRpm: 'Оберти генератора',
  rawHz: '«Сира» частота',
  outHz: 'На виході',
  nacelleMass: 'Маса гондоли (умовно)',
  fieldB: 'Магнітне поле B',
  scopeRaw: 'Генератор: частота «пливе»',
  scopeGrid: 'Мережа: рівно 50 Hz',
  driveDfig: 'DFIG',
  driveDirect: 'Прямий привод',
  driveMedium: 'Середньошвидкісний',
  driveDfigFull: 'Мультиплікатор + асинхронний генератор подвійного живлення (DFIG)',
  driveDirectFull: 'Прямий привод: генератор з постійними магнітами на маточині, без мультиплікатора',
  driveMediumFull: 'Компактний мультиплікатор + генератор з постійними магнітами',
  driveBoard: 'Від ротора до мережі',
  // step 7 — power-curve
  pitch: 'Кут повороту лопатей β',
  power: 'Потужність P',
  curve: 'Крива потужності P(v)',
  rpm: 'Оберти ротора',
  cutIn: 'увімкнення',
  cutOut: 'вимкнення',
  farmEffShort: 'Ефективність ВЕС',
  // step 8 — wind-farm
  windDir: 'Напрямок вітру',
  windDirDrag: 'Напрямок вітру — тягніть стрілку',
  rowSpacing: 'Відстань між рядами',
  farmPower: 'Потужність ВЕС',
  farmBoard: 'Табло ВЕС',
  perTurbine: 'Потужність кожної турбіни, % від одинокої',
  xray: 'Збірна мережа 33 kV',
  // step 9 — capacity-factor
  vMean: 'Середня швидкість v̄',
  histogram: 'Години за рік',
  energyBars: 'Енергія за рік',
  yearStrip: 'Рік по днях: середня потужність за добу',
  dayWind: 'Вітер цього дня',
  shearNote: 'На висоті 200 m вітер узято однаковим над будь-якою місцевістю',
  // step 10 — offshore
  eiffel: 'Ейфелева вежа · 330 m',
  motherland: 'Батьківщина-Мати · 102 m',
  a380: 'Аеробус A380 · розмах 80 m',
  person: 'Людина',
  turbine15: 'Турбіна 15 MW · ≈ 260 m',
  exportAc: 'Експортний кабель змінного струму 220 kV',
  exportDc: 'Лінія постійного струму (HVDC) ±320 kV',
  monopile: 'Монопаля',
  jacket: 'Ґратчаста основа',
  floating: 'Плавуча платформа',
  // step 11 — role
  trip: 'Вимкнути великий блок',
  frequency: 'Частота мережі f',
  load: 'Споживання',
  windBand: 'Вітер',
  nadir: 'Найнижча частота',
  notBuilt: 'Розділи за порталами ще будуються — портали поки неактивні',
} as const;
