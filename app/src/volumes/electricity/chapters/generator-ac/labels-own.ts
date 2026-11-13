/**
 * Labels the chapter authors itself (the document does not carry them): part names for callouts, axis titles,
 * readout captions, short status words. Plain Ukrainian (DECISIONS §54 h); symbols and units international.
 * Captions that the document quotes come from `doc()` in `labels.ts` instead.
 */
export const OWN = {
  // shared
  scope: 'Осцилограф',
  phasors: 'Діаграма фазорів',
  frequency: 'Частота',
  period: 'Період',
  amplitude: 'Амплітуда',
  pause: 'Пауза',
  window: 'вікно',
  resume: 'Далі',
  // 1 rotating-loop
  magnet: 'Підковоподібний магніт',
  loop: 'Рамка',
  slipRings: 'Контактні кільця',
  normal: 'нормаль',
  crank: 'Ручка',
  crankHint: 'Тягніть ручку по колу',
  zeroAt: 'Рамка «дивиться» на полюс — ЕРС = 0',
  // 2 ac-anatomy
  dcLamp: 'Лампа на постійній напрузі',
  acLamp: 'Лампа на змінній напрузі',
  japan: 'Японія: схід 50 Hz, захід 60 Hz',
  cursorHint: 'Тягніть курсор уздовж осі часу',
  ledTrail: 'світлодіод з поганим драйвером',
  filamentTrail: 'лампа розжарення',
  // 3 war-of-currents
  lossDc: 'Втрати, постійний струм',
  lossAc: 'Втрати, змінний струм',
  lampDc: 'Лампи, постійний струм',
  lampAc: 'Лампи, змінний струм',
  milestones: 'Віхи',
  edison: 'Станція Едісона: постійний струм',
  westinghouse: 'Станція Вестінгауза: змінний струм',
  dcShelf: 'Постійний струм сьогодні',
  m1882: '1882 — станція Pearl Street у Нью-Йорку: постійний струм ~110 V',
  m1886: '1886 — перша система змінного струму з трансформаторами (Вільям Стенлі)',
  m1888: '1888 — патенти Тесли на багатофазні двигуни; ліцензію купує Westinghouse',
  m1891: '1891 — трифазна передача Лауффен–Франкфурт, ~175 km',
  m1893: '1893 — змінний струм освітлює Всесвітню виставку в Чикаго',
  m1896: '1896 — енергія Ніагари йде лінією до Буффало',
  // 4 three-phase
  magnetRotor: 'Ротор — постійний магніт',
  neutralWire: 'Нейтраль',
  // 5 star-delta
  jumperHint: 'Перетягніть перемичку на інші гвинти',
  jumpersIncomplete: 'Перемички стоять не за схемою — двигун не ввімкнено',
  motorOk: 'Зірка: на кожній обмотці',
  starPoint: 'Нульова точка (нейтраль)',
  motor400: 'Двигун Δ/Y 230/400 V у мережі 400 V',
  phaseNeutral: 'Фаза — нейтраль',
  phasePhase: 'Фаза — фаза',
  // 6 rotating-field
  zoneNormal: 'Робоча зона',
  zoneOverload: 'Перевантаження',
  dirCcw: 'Поле обертається проти годинникової стрілки',
  dirCw: 'Поле обертається за годинниковою стрілкою',
  statorCoils: 'Статор: котушки трьох фаз',
  fieldTag: 'поле',
  rotorTag: 'ротор',
  slipTag: 'ковзання',
  // 7 synchronous-generator
  saturationModel: 'спрощена модель насичення',
  exciter: 'Збудник',
  statorTerminals: 'Виводи статора → до блочного трансформатора',
  avrTag: 'ЕРС',
  // 8 synchronization
  generatorSide: 'Генератор',
  gridSide: 'Мережа',
  limitsGame: 'Межі гри',
  resync: 'Синхронізувати знову',
  synchroDesk: 'Пульт синхронізації',
  // 9 rlc
  resonanceBoard: 'Резонансна крива',
  acSource: 'Джерело 230 V змінної частоти',
  // 10 ac-power
  ropeAngle: 'Кут троса φ',
  horseHint: 'Перетягніть коня — змініть кут троса',
  capacitiveShort: 'ємн.',
  lineLoss: 'Втрати в лінії',
  motor15: 'Двигун 1,5 kW',
  lineResistance: 'Опір лінії 0,5 Ω',
  // 11 to-transformer
  transformerSoon: 'Розділ «Трансформатор» ще будується',
  ourGenerator: 'Генератор електростанції',
  primaryCoil: 'Мала котушка: товстий дріт',
  secondaryCoil: 'Велика котушка: тонкий дріт',
  m2007: '2007 — у Нью-Йорку відключено останню мережу постійного струму',
} as const;

export type OwnLabel = keyof typeof OWN;
