/**
 * Scene labels the generated content does not carry: switch items, callouts, readout captions, chart titles.
 * DECISIONS §54: plain Ukrainian; an international abbreviation only where it is really needed, after the
 * Ukrainian words; symbols and units international.
 * `QUOTED` are wordings the document gives in `code` quotes («Інтерактив» switch items, «Бачимо» lane names) —
 * not exported as labels; the test checks that each of them still stands in the document.
 */
export const QUOTED = {
  // step 1 — «Режим острова»
  modeBase: 'Ніч (база)',
  modePeak: 'Ранковий пік',
  // step 2 — «Паливо»
  fuelGas: 'Газ',
  fuelCoal: 'Вугілля',
  fuelH2: 'Водень',
  // step 3 — the turbofan's caption
  jetCaption: 'той самий цикл Брайтона, але енергію забирає реактивний струмінь і вентилятор, а не генератор',
  // step 5 — three toggles
  internal: 'Внутрішнє охолодження',
  film: 'Плівка',
  tbc: 'Теплозахисне покриття',
  creepNote: 'Повзучість: лопатка видовжується… торкнеться корпусу за години',
  // step 7 — lanes of the start board and «Скільки годин стояла ПГУ»
  laneEngine: 'Газопоршнева',
  laneAero: 'ГТУ (авіапохідна)',
  laneHeavy: 'ГТУ (енергетична)',
  laneHot: 'ПГУ (гарячий пуск)',
  laneCold: 'ПГУ (холодний пуск)',
  h4: '4 h',
  h24: '24 h',
  h72: '72 h',
  // step 8 — «Мапа району»
  single200: 'Одна станція 200 MW',
  twenty10: '20 установок по 10 MW',
  // step 9 — horizon of the global-warming potential
  gwp100: 'За 100 років',
  gwp20: 'За 20 років',
} as const;

export const SCENE = {
  ...QUOTED,
  // names of the island's buildings (step 1 outline + tooltip, callouts elsewhere)
  ccgt: 'Парогазова установка',
  mainHall: 'Головний будинок: ГТ + генератор + ПТ',
  hrsgName: 'Котел-утилізатор',
  stack: 'Димова труба',
  accName: 'Повітряний конденсатор',
  gasStation: 'Газорозподільний пункт',
  airIntake: 'Повітрязабірник з фільтрами',
  peaker: 'Пікова ГТУ',
  engineHall: 'Газопоршнева станція',
  substation: 'Трансформатори й розподільна установка',
  town: 'Місто з теплотрасою',
  islandPower: 'Потужність острова',
  goToStep: 'Перейти до кроку',
  // step 2 — natural-gas ({} = a number filled in by `fill`)
  moleculesEnlarged: 'молекули збільшено ≈ ×10¹⁰',
  filter: 'Фільтр-сепаратор',
  heater: 'Підігрівник газу',
  meter: 'Вузол обліку',
  cubeHeat: '≈ {} kWh тепла',
  cubeCcgt: '≈ {} kWh електрики на ПГУ (η 57 %)',
  cubeGt: '≈ {} kWh на ГТУ (η 35 %)',
  // steps 3–5 — gas turbine
  compressor: 'Компресор',
  combustor: 'Камера згоряння',
  turbine: 'Турбіна',
  section: 'Секція',
  allSections: 'Уся машина',
  pressure: 'p, MPa: вхід → вихід',
  temperature: 't, °C: вхід → вихід',
  workTurbine: 'Робота турбіни',
  workCompressor: 'Компресору · {}',
  workGenerator: 'Генератору · {}',
  airIn: 'Повітря · 15 °C',
  exhaustOut: 'Вихлоп · {}',
  shaftSlowed: 'сповільнено ≈ ×140',
  gtTable: 'Тиск і температура в машині',
  // step 4 — brayton-sim
  r: 'Ступінь підвищення тиску r',
  titLong: 'Температура перед турбіною (TIT)',
  eta: 'ККД ГТ',
  wNet: 'Питома робота',
  t2: 't₂ після компресора',
  t4: 't₄ вихлопу',
  compShare: 'Частка компресора',
  presets: 'Покоління машин',
  tsTitle: 'T–s діаграма',
  balance: 'Баланс роботи, kJ/kg',
  toCompressor: 'компресору',
  toGenerator: 'генератору',
  cycle: 'цикл',
  workArea: 'робота',
  // step 5 — hot-section
  layerGas: 'газ',
  layerCoat: 'покриття',
  layerMetal: 'метал',
  layerChannels: 'канали',
  metalNow: 'Метал лопатки · {}',
  bladeEnlarged: 'лопатку збільшено ≈ ×14',
  estimate: 'оцінка',
  hotGas: 'Розпечений газ · {}',
  coolAir: 'Повітря з компресора',
  // step 6 — combined-cycle
  energyOfGas: 'Куди йде енергія газу, %',
  fuelIn: 'газ',
  gtEl: 'ГТ',
  stEl: 'ПТ',
  losses: 'втрати',
  etaCC: 'ККД установки',
  powerTotal: 'Потужність',
  powerGt: 'Газова турбіна',
  powerSt: 'Парова турбіна',
  stackTemp: 'У трубу',
  exhaustIn: 'Вихлоп ГТ · {}',
  toStack: 'У трубу · {}',
  steamToSt: 'Пара до парової турбіни',
  superheater: 'Перегрівник',
  evaporator: 'Випарник',
  economiser: 'Економайзер',
  bypassOn: 'Обвідна труба: ГТ працює в простому циклі',
  // step 7 — flexibility
  laneWarm: 'ПГУ (теплий пуск)',
  ccgtShort: 'ПГУ (за перемикачем)',
  hot: 'гарячий',
  warm: 'теплий',
  cold: 'холодний',
  raceTitle: 'Перегони запуску',
  lane: 'Установка',
  powerNow: 'P, %',
  fullAt: 'Повна за',
  demand: 'ранковий пік попиту',
  clock: 'Годинник',
  clockScale: '1 s = 1 min',
  frequency: 'Частота після аварії (ілюстративно)',
  // step 8 — gas-engines
  view: 'Вигляд',
  viewEngine: 'Двигун',
  strokeIntake: 'Такт 1 · впуск',
  strokeCompression: 'Такт 2 · стиснення',
  strokePower: 'Такт 3 · іскра + робочий хід',
  strokeExhaust: 'Такт 4 · випуск',
  runNormally: 'Звичайний хід',
  fuelUse: 'Використання палива ε',
  etaEl: 'Електричний ККД',
  generator: 'Генератор',
  heatOut: 'Тепло вихлопу й охолодження → місто',
  bigStation: 'Одна велика станція 200 MW',
  restoreDistrict: 'Відновити живлення',
  winterNight: 'зимова ніч',
  failedUnit: 'Установка вийшла з ладу',
  // step 9 — emissions-hydrogen
  horizon: 'Горизонт потепління',
  direct: 'З труби',
  upstream: 'Видобуток і транспорт',
  leakShare: 'Витоки метану',
  total: 'Разом за життєвий цикл',
  coalLife: 'Вугілля (життєвий цикл)',
  co2Cut: 'Менше CO₂ завдяки водню',
  h2Energy: 'Частка енергії водню',
  h2Chart: 'Об’єм ≠ енергія: водень у суміші',
  parity: 'Хмари зрівнялися: з такими витоками газ «брудний», як вугілля',
  cloudLabel: '{} · {}',
  cloudArea: 'площа хмари ∝ g/kWh',
  // step 10 — role
  records: 'Рекорди і цифри',
  kyiv5: 'Київська ТЕЦ-5',
  kyiv6: 'Київська ТЕЦ-6',
  kharkiv5: 'Харківська ТЕЦ-5',
  chpType: 'ТЕЦ на газі: тепло й електрика',
  plantCard: '{} · проєктна електрична потужність {} · {}',
  mapNote: 'Карта: міжнародно визнані кордони України',
} as const;

/** Put values into the `{}` slots of a label, in order. */
export function fill(template: string, ...values: readonly string[]): string {
  let i = 0;
  return template.replace(/\{\}/g, () => values[i++] ?? '');
}
