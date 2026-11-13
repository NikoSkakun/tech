/**
 * Scene labels of `lab-battery` (control captions, chips, callouts). Two groups:
 *
 * - `DOC` (`labels-doc.ts`) — UI copy of the chapter document's «Інтерактив» items, read from the generated
 *   content (`steps[].labels`) or, for the few phrases the export does not list, copied verbatim and tested.
 * - `OWN` — short labels the document does not quote (part names for callouts, axis titles, units). Plain
 *   Ukrainian (DECISIONS §54): an abbreviation (SOC, DoD, SOH, CC/CV, BMS, NMC, LFP …) only after the step
 *   text has introduced it. Keep them minimal; anything longer belongs in the chapter document.
 *
 * Step text (panels, terms, facts, hotspots, quiz) is NOT here — it comes from the generated content file.
 */
import { fmtNumber } from '@/content';
import { DOC } from './labels-doc';

export { DOC };

/** Labels that are not quoted in the document: part names, axis titles, units — plain Ukrainian (§54). */
export const OWN = {
  // shared
  reset: 'Скинути',
  time: 'Час',
  soc: 'Рівень заряду',
  socShort: 'SOC', // after step 6 has introduced «рівень заряду (SOC)»
  // 1 what-is-battery
  hint1: 'Драбина потенціалів: оберіть будь-які два метали',
  emf: 'ЕРС ℰ',
  anode: 'Анод (−)',
  cathode: 'Катод (+)',
  porous: 'Пориста перегородка',
  electronsWire: 'e⁻ — електрони в дроті',
  niMh: 'Нікелеві акумулятори',
  liIon1991: 'Літій-іонна · 1991',
  // 2 cell-anatomy
  hint2: 'Розмотайте рулон і роздивіться шари',
  capacityAh: 'Ємність Q',
  energyWh: 'Енергія W',
  jellyRoll: 'Рулон електродів',
  anodeSheet: 'Анод: графіт на Cu',
  cathodeSheet: 'Катод на Al',
  partGasket: 'Ізолятор',
  partCid: 'Переривач струму',
  partPtc: 'Термістор-шайба',
  partVent: 'Клапан скидання тиску',
  partCap: 'Кришка «+»',
  // 3 intercalation
  hint3: 'Заряджайте й розряджайте: стежте, куди йдуть іони, а куди — електрони',
  ionsInAnode: 'Li⁺ в аноді',
  graphite: 'Графіт (анод)',
  oxide: 'Шаруватий оксид (катод)',
  separator: 'Сепаратор',
  cuFoil: 'Мідна фольга',
  alFoil: 'Алюмінієва фольга',
  electrons: 'e⁻ — електрони',
  // 4 why-lithium
  hint4: 'Змініть потрібну енергію — порівняйте масу трьох батарей',
  leadAcid: 'Свинцева',
  valence: 'Валентний електрон',
  liAtom: 'Li: 3 p⁺',
  // 5 chemistries
  hint5: 'Натисніть на п’єдестал, щоб порівняти хімії',
  whyBus: 'нічне / швидке заряджання',
  // one-row captions of the task selector (the verdict spells the document's task names out)
  tabHome: 'дім',
  tabBus: 'автобус',
  tabPolar: 'станція',
  axisEnergy: 'енергія',
  axisPower: 'потужність',
  axisLife: 'ресурс',
  axisSafety: 'безпека',
  axisPrice: 'ціна',
  solidState: 'Твердотільна',
  naIon: 'Натрій-іонна',
  // 6 voltage-capacity
  hint6: 'Задайте струм і температуру та натисніть «Розрядити»',
  cellNmc: '21700 NMC',
  cellLfp: 'LFP 100 Ah',
  boardDischarge: 'U(Q) — крива розряду',
  axisCapacity: 'Q, %',
  axisVoltage: 'U, V',
  statAh: 'Q, Ah',
  statWh: 'W, Wh',
  statMin: 't, min',
  statMeanV: 'Ū, V',
  statHeat: 'тепло',
  load: 'Електронне навантаження',
  internalR: 'R_i — внутрішній опір (гріє)',
  socTube: 'Рівень заряду (SOC)',
  // 7 charging
  hint7: 'Задайте струм, межу напруги й температуру та натисніть «Зарядити»',
  boardCharge: 'Заряд у часі: CC → CV',
  axisTime: 't, min',
  axisPercent: '%',
  seriesU: 'U, V',
  seriesI: 'I, % I_cc',
  seriesSoc: 'SOC, %',
  statCc: 't_{CC}, min',
  stat80: 't_{80 %}, min',
  statTotal: 't, min',
  statSocEnd: 'SOC, %',
  charger: 'Зарядний пристрій',
  lens: 'Анод під лупою',
  // 8 pack
  hint8: 'Зберіть батарею: змінюйте S і P або оберіть готовий варіант',
  seriesS: 'S — послідовно',
  parallelP: 'P — паралельно',
  cell18650: '18650',
  cell21700: '21700',
  cellLfp100: 'LFP 100',
  cellLfp314: 'LFP 314',
  boardPack: 'sS·pP — табло батареї',
  asBlocks: 'понад 1000 комірок — показано блоками',
  inverter: 'ЛІ-6 — гібридний інвертор',
  homeBattery: 'Домашня батарея 51,2 V',
  busbar: 'Шина',
  // 9 bms
  hint9: 'Потягніть «склянку» будь-якої комірки, щоб розбалансувати батарею, і запустіть заряд',
  boardBms: 'Напруги 16 комірок',
  lineOvp: 'перезаряд',
  lineUvp: 'переразряд',
  axisCell: '№',
  statPackU: 'U, V',
  statPackI: 'I, A',
  statModelTime: 't, h',
  bmsBoard: 'Плата BMS',
  balanceResistors: 'Резистори балансування',
  canCable: 'CAN: U, I, SOC, ліміти струму',
  cellGlass: 'Заряд комірки — тягніть',
  // 10 degradation
  hint10: 'Змініть умови життя правої комірки й порівняйте, як тане її ємність',
  boardSoh: 'Стан здоров’я (SOH) за роками',
  axisYears: 't, роки',
  axisSoh: 'SOH, %',
  refScenario: '25 °C · 20–80 %',
  yourScenario: 'ваш сценарій',
  eol: 'кінець ресурсу 80 %',
  statT80: 't_{80 %}, р.',
  statSohNow: 'SOH, %',
  year: 'рік',
  noPlating: `${DOC.noPlatingInModel} — див. крок 7`,
  seiLens: 'Плівка SEI на графіті',
  // 11 safety
  hint11: 'Підніміть температуру печі й натисніть «Старт»',
  ctaNail: 'Задайте рівень заряду комірок і натисніть «Старт»',
  ctaOvercharge: 'Увімкніть або вимкніть BMS і натисніть «Старт»',
  ctaPropagation: 'Поставте або заберіть теплобар’єри й натисніть «Старт»',
  ovenCold: 'За кімнатної температури з комірками нічого не відбувається — підніміть температуру печі',
  realTime: 'у реальному часі',
  plottedCell: 'На графіку — комірка № 2 кожного ряду: сусідка тієї, що вже в розгоні',
  scenarioOven: 'Піч',
  boardThermal: 'T(t) — температура комірок',
  axisTimeS: 't, s',
  axisTemp: 'T, °C',
  seriesOven: 'T печі',
  barrier: 'Теплобар’єри (аерогель)',
  bmsCut: 'BMS відключила заряд',
  statModelMin: 't, min',
  stageSei: 'Плівка SEI ≈ 90 °C',
  stageSeparator: 'Сепаратор ≈ 130 °C',
  stageVent: 'Клапан',
  stageRunaway: 'Тепловий розгін',
  // 12 scale-and-future
  hint12: 'Пересувайте «Масштаб» — від телефона до накопичувальної станції',
  stopPhone: 'Телефон',
  stopLaptop: 'Ноутбук',
  stopEbike: 'Електровелосипед',
  stopStation: 'Зарядна станція',
  stopHome: 'Домашній накопичувач',
  stopEv: 'Електромобіль',
  stopBess: 'Контейнерний накопичувач',
  stopPlant: 'Накопичувальна станція',
  stopRecycling: 'Переробка, «чорна маса»',
  boardPrice: 'Ціна пакета, $/kWh',
  axisYear: 'рік',
  axisUsdKwh: '$/kWh',
  calcEnergy: 'Енергія W',
  calcPower: 'Навантаження P',
  calcHours: 't ≈ W·DoD·η / P',
  stationary2025: 'стаціонарні, 2025',
  // OWN:steps (appended per step below)
} as const;

/** All scene labels, typed. `content.ts` hands the same object to `defineContent`. */
export const L = { ...DOC, ...OWN } as const;
export type LabelKey = keyof typeof L;

/**
 * Honesty note with the real time lapse of the run on screen (model seconds per screen second, two
 * significant digits) — for steps where the factor depends on the sliders, so a fixed chip would lie.
 */
export const spedUp = (factor: number): string =>
  factor >= 1.5 ? `прискорено ×${fmtNumber(Number(factor.toPrecision(2)))}` : 'у реальному часі';
