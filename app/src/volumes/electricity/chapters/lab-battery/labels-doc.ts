/**
 * `DOC` — UI copy of the chapter document's «Інтерактив» items, never retyped where the export carries it:
 *
 * - `d(step, n)` reads label `n` of the step from the generated content (`steps[].labels`: the wording quoted
 *   «…» in the document, in document order); `d(step, n, k)` takes item `k` of a quoted list
 *   («Розряд / Заряд», «Балансування: вимк. / пасивне 0,1 A / активне 2 A»), `'head'` its name before the colon.
 * - the few phrases the export does not list as labels (chips written inside a sentence, task names) are
 *   copied verbatim below under "verbatim".
 *
 * `__tests__/labels.test.ts` asserts that every entry occurs in the document's export and pins the labels a
 * mix-up would hurt, so a label index that shifts after a document edit fails the test instead of silently
 * renaming a control.
 */
import raw from '@electricity/content/generated/lab-battery.json';

function d(step: number, n: number, part?: number | 'head'): string {
  const text = raw.steps[step - 1]!.labels[n]!;
  if (part === undefined) return text;
  const colon = text.indexOf(': ');
  if (part === 'head') return text.slice(0, colon);
  return (colon < 0 ? text : text.slice(colon + 2)).split(' / ')[part]!;
}

export const DOC = {
  // 1 what-is-battery
  ladder: d(1, 0), // «Драбина потенціалів»
  reactsWithWater: d(1, 1), // «Реагує з водою! Потрібен неводний електроліт»
  discharge: d(1, 2, 0), // «Розряд / Заряд»
  charge: d(1, 2, 1),
  // 2 cell-anatomy
  unroll: d(2, 0), // «Розмотати»
  mass: d(2, 3), // «маса»
  capCut: d(2, 4), // «Розріз кришки»
  capLater: d(2, 5), // «повернемося до них у кроці 11»
  // 3 intercalation
  pause: d(3, 0, 2), // «Заряд / Розряд / Пауза»
  current: d(3, 1), // «Струм»
  fastCold: d(3, 2), // «Швидко на морозі»
  platingSee7: d(3, 5), // «осадження літію: див. крок 7»
  ionTip: d(3, 6), // «Li⁺ · у шубці з 4 молекул розчинника»
  // 4 why-lithium
  energyNeeded: d(4, 0), // «скільки енергії потрібно»
  cellsOnly: d(4, 1), // «лише комірки, без корпусу й електроніки»
  usable: d(4, 2), // «корисні»
  // 5 chemistries
  compareTwo: d(5, 1), // «Порівняти дві»
  pickForTask: d(5, 2), // «Вибери хімію для задачі»
  verdictGood: d(5, 3, 0), // «добре / можна / погано»
  verdictOk: d(5, 3, 1),
  verdictBad: d(5, 3, 2),
  // 6 voltage-capacity
  dischargeCurrent: d(6, 0), // «Струм розряду»
  temperature: d(6, 1), // «Температура»
  runDischarge: d(6, 2), // «Розрядити»
  overCurrent: d(6, 3), // «понад паспортний тривалий струм — лише в лабораторії»
  showOcv: d(6, 5), // «Показати напругу спокою»
  // 7 charging
  ccCurrent: d(7, 0), // «Струм CC»
  voltageLimit: d(7, 1), // «Межа напруги»
  runCharge: d(7, 3), // «Зарядити»
  overcharge: d(7, 4), // «Перезаряд: ризик руйнування й займання»
  platingRisk: d(7, 5), // «Ризик осадження літію»
  // 8 pack
  presetPowerbank: d(8, 3), // «Павербанк»
  presetEbike: d(8, 4), // «Електровелосипед»
  presetHome5: d(8, 5), // «Домашня 5 kWh»
  presetHome16: d(8, 6), // «Домашня 16 kWh»
  presetEv: d(8, 7), // «Електромобіль»
  li6Ok: d(8, 8), // «Підходить»
  li6Partial: d(8, 9), // «Працюватиме не на всю глибину: інвертор вимкнеться на 40 V»
  li6Over: d(8, 10), // «Не підходить: перенапруга на вході»
  li6Under: d(8, 11), // «замала напруга»
  // 9 bms
  unbalance: d(9, 0), // «Розбалансувати»
  cell7Capacity: d(9, 1), // «Ємність комірки №7»
  usableCapacity: d(9, 4), // «корисна ємність збірки»
  balancing: d(9, 5, 'head'), // «Балансування: вимк. / пасивне 0,1 A / активне 2 A»
  balOff: d(9, 5, 0),
  balPassive: d(9, 5, 1),
  balActive: d(9, 5, 2),
  toEqual: d(9, 6), // «до вирівнювання»
  link: d(9, 7, 'head'), // «Зв’язок з інвертором: CAN / без зв’язку»
  can: d(9, 7, 0),
  linkNone: d(9, 7, 1),
  bmsEmergency: d(9, 9), // «аварійне відключення BMS»
  // 10 degradation
  storageTemp: d(10, 0), // «Температура зберігання/роботи»
  cyclesPerYear: d(10, 1), // «Циклів на рік»
  dod: d(10, 2), // «Глибина розряду»
  avgSoc: d(10, 3), // «Середній рівень заряду»
  habitHot: d(10, 5), // «Тримати на 100 % у спеці»
  habitCare: d(10, 6), // «Дбайливо»
  outOfModel: d(10, 7), // «поза межами моделі»
  // 11 safety
  ovenTemp: d(11, 0), // «Температура печі»
  start: d(11, 1), // «Старт»
  scenario: d(11, 3), // «сценарій»
  nail: d(11, 4), // «Цвях»
  overchargeScenario: d(11, 5), // «Перезаряд»
  bmsOn: d(11, 6), // «BMS увімк.»
  propagation: d(11, 7), // «Поширення»
  // 12 scale-and-future
  scale: d(12, 0), // «Масштаб»
  howLong: d(12, 2), // «Скільки протягне?»
  calcDod: d(12, 3), // «Глибина розряду»
  approxPrices: d(12, 4), // «наближено, у цінах 2025 р.»
  cost10kwh: d(12, 5), // «Скільки коштувала б батарея 10 kWh»

  /* ---- verbatim: wording of the document that the export does not list among the step's labels ---- */
  idealised:
    'ідеалізовано: стандартні потенціали (розчини 1 mol/L, 25 °C) — у реальній склянці напруга буде іншою',
  notRechargeable: 'у цій склянці зворотна реакція йде погано — тому це не акумулятор',
  fmtPrismatic: 'призматична',
  fmtPouch: 'пакетна',
  taskPhone: 'телефон',
  taskHome: 'домашній накопичувач',
  taskBus: 'міський автобус',
  taskDrone: 'дрон',
  taskPolar: 'полярна станція',
  whyPhone: 'енергія на об’єм',
  whyHome: 'ресурс, безпека, ціна',
  whyDrone: 'Wh/kg',
  whyPolar: 'мороз',
  bothCells: 'обидві',
  li6Caveat:
    'Напруга — лише перша умова. Справжню батарею добирають за списком сумісності інвертора й з’єднують із ним через BMS',
  toyModel: 'Ілюстративна модель: показує тенденції, а не прогноз для конкретної батареї',
  ovenChip: 'ілюстративна модель · час ×30 · пороги справжніх комірок інші',
  nailLfpNote:
    'так поводиться більшість LFP-комірок у тесті цвяхом; великі повністю заряджені теж можуть піти в розгін',
  noPlatingInModel: 'Модель не враховує шкоди від заряду на морозі (осадження літію)',
} as const;
