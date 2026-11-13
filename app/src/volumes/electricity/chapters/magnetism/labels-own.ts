/**
 * Labels the chapter document does not carry: part names, axis titles, short captions of controls the script
 * describes without quoting a caption. Plain Ukrainian (DECISIONS §54); symbols and units international.
 * Kept apart from `labels.ts` so that `content.ts` (loaded by the HUD) does not pull the `DOC` checks.
 */
export const OWN = {
  // shared
  north: 'N',
  south: 'S',
  earthNorth: 'Північ',
  // 1 magnet-field
  dragMagnet: 'Потягніть другий магніт',
  magnetB: 'Другий магніт',
  // 2 domains
  magnetization: 'Намагніченість M/M_s',
  loopTitle: 'Петля гістерезису',
  coil: 'Котушка: зовнішнє поле',
  burner: 'Пальник',
  copperAl: 'Мідь і алюміній: не магнітяться',
  // 3 oersted
  probe: 'Компас-зонд',
  chip: 'B [μT] = 20·I [A] / r [cm]',
  deflection: 'Відхилення α',
  fieldB: 'Поле дроту B',
  supply: 'Джерело струму',
  conventional: 'умовний струм',
  electrons: 'електрони',
  // 4 solenoid
  crane: 'Електромагніт-кран',
  coreRod: 'Залізне осердя',
  // 5 lorentz
  partA: 'Електронний пучок',
  partB: 'Гойдалка Ампера',
  beamSlowed: 'пучок сповільнено в сотні мільйонів разів',
  speedV: 'Швидкість v',
  radiusR: 'Радіус r',
  particles: ['електрон', 'протон'],
  swingAngle: 'Відхилення β',
  force: 'Сила F',
  // 6 dc-motor
  speed: 'Оберти',
  current: 'Струм',
  power: 'Механічна потужність',
  backEmf: 'Проти-ЕРС',
  commutator: 'Колектор',
  brush: 'Щітка',
  // 7 induction
  magnetGrade: 'Магніт',
  grades: ['феритовий', 'неодимовий'],
  emfE: 'ЕРС',
  fluxPhi: 'Потік Φ',
  galvanometer: 'Гальванометр',
  dragUpDown: 'Тягніть магніт угору-вниз крізь котушку',
  // 8 lenz
  tubes: ['Пластик', 'Алюміній', 'Мідь'],
  release: 'Відпустити',
  stick: 'Прикласти до труби',
  timer: 'Час падіння',
  dragMagnetRing: 'Піднесіть магніт до кільця',
  // 9 inductance
  lamp1: 'Лампа L1',
  lamp2: 'Лампа L2',
  neon: 'Неонова лампочка',
  coilL: 'Котушка L',
  peak: 'Пік напруги',
  // 10 maxwell
  views: ['Рівняння', 'Хвиля', 'Енергія'],
  part: 'Що показати',
  equations: ['Заряди → E', 'B замкнені', 'Змінне B → E', 'Змінне E → B'],
  equation: 'Рівняння',
  bands: ['радіохвилі', 'мікрохвилі', 'інфрачервоне', 'видиме світло', 'ультрафіолет', 'рентген', 'гамма'],
  antenna: 'Антена-диполь',
  spectrum: 'Спектр',
  wavelength: 'Довжина хвилі λ',
  band: 'Діапазон',
  powerP: 'Потужність P',
  // 11 to-generator
  crank: 'Крутіть ручку',
  rpm: 'Оберти',
  emfMax: 'Амплітуда ЕРС',
  notBuilt: 'Розділ «Генератор» ще будується',
} as const;
