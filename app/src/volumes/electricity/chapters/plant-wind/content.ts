/**
 * All text of the chapter. Panel pages, terms, formulas, facts, hotspot cards, misconceptions, glossary and
 * quiz come from the generated runtime content (never retyped). `labels` holds what the generated file does
 * not carry: UI labels quoted «…» in the document's «Інтерактив» items (verbatim) and short scene labels
 * (tooltips, callouts, readout captions) in the house style «International term — український відповідник».
 */
import { defineContent } from '@/content';
import raw from '@electricity/content/generated/plant-wind.json';

export const L = {
  // step 1 — overview
  dayNight: 'День / Ніч',
  turbineTip: 'Вітрова турбіна · 6 MW',
  chainWind: 'вітер',
  chainRotor: 'ротор',
  chainGrid: 'мережа',
  // step 2 — wind-power
  v: 'Швидкість вітру v',
  d: 'Діаметр ротора D',
  t: 'Температура T',
  pWind: 'P_{wind}',
  area: 'Площа ротора A',
  rho: 'Густина повітря ρ',
  double: '×2 швидкості',
  airSecond: 'Повітря за 1 s',
  // step 3 — betz
  a: 'Осьова індукція a',
  cp: 'C_{p}',
  betzChip: 'Межа Беца 59,3 %',
  aHint:
    'Тут модель ідеального диска вже не працює: при a = 0,5 повітря за ротором мало б зупинитися, а при більших — текти назад',
  presetFree: 'Не гальмує',
  presetBlock: 'Стіна',
  presetBetz: 'Оптимум',
  vIn: 'v перед ротором',
  vRotor: 'v у площині ротора',
  vWake: 'v за ротором',
  // step 4 — blade
  alpha: 'Кут атаки α',
  span: 'Позиція вздовж лопаті',
  glide: 'Якість профілю C_{L}/C_{D}',
  twist: 'Кут установлення θ',
  windV: 'v — вітер',
  windOmega: 'ω·r — зустрічний потік',
  windRel: 'v_{rel} — уявний вітер',
  lift: 'F_{L} — lift, підіймальна сила',
  drag: 'F_{D} — drag, лобовий опір',
  torque: 'Тягне лопать уперед',
  stall: 'Stall — зрив потоку',
  section: 'Airfoil — аеродинамічний профіль',
  // step 5 — nacelle
  energyPath: 'Шлях енергії',
  cutaway: 'Розріз / Зовнішній вигляд',
  total: 'разом ≈ 90–93 %',
  technician: 'Технік — для масштабу',
  // step 6 — drivetrain
  rotorRpm: 'Оберти ротора',
  genRpm: 'Оберти генератора',
  rawHz: '«Сира» частота',
  outHz: 'На виході',
  nacelleMass: 'Маса гондоли (умовно)',
  movingParts: 'Рухомих частин',
  converterShare: 'Через перетворювач',
  fieldB: 'Магнітне поле B',
  scopeRaw: 'Генератор: частота «пливе»',
  scopeGrid: 'Мережа: рівно 50 Hz',
  // step 7 — power-curve
  gust: 'Порив',
  storm: 'Шторм',
  stormControl: 'Пряме вимкнення / Storm control',
  stormChip: 'Захист від шторму',
  zone1: 'I · штиль',
  zone2: 'II · ловимо максимум',
  zone3: 'III · номінал, скидаємо зайве',
  zone4: 'IV · шторм — стоп',
  pitch: 'Pitch β',
  power: 'Потужність P',
  // step 8 — wind-farm
  windDir: 'Напрямок вітру',
  rowSpacing: 'Відстань між рядами',
  steering: 'Wake steering',
  farmEff: 'Ефективність ВЕС = ΣP / (N·P_одинокої)',
  steeringHint: 'Керування слідом вмикають тільки для „поганих“ напрямків',
  farmPower: 'Потужність ВЕС',
  xray: 'Collector system — збірна мережа 33 kV',
  // step 9 — capacity-factor
  vMean: 'Середня швидкість v̄',
  hubHeight: 'Висота маточини',
  terrainSea: 'море α=0,10',
  terrainSteppe: 'степ α=0,14',
  terrainForest: 'ліс α=0,25',
  cf: 'КВВП',
  aep: 'AEP',
  dayOfYear: 'День року',
  histogram: 'Години за рік',
  energyBars: 'Енергія за рік',
  shearNote: 'На висоті 200 m вітер узято однаковим над будь-якою місцевістю',
  // step 10 — offshore
  depth: 'Глибина',
  shoreDistance: 'Відстань до берега',
  compare: 'Порівняти розміри',
  eiffel: 'Ейфелева вежа · 330 m',
  motherland: 'Батьківщина-Мати · 102 m',
  a380: 'Airbus A380 · розмах 80 m',
  person: 'Людина',
  turbine15: 'Турбіна 15 MW · ≈ 260 m',
  exportAc: 'Export cable — експортний кабель AC 220 kV',
  exportDc: 'HVDC — постійний струм ±320 kV',
  monopile: 'Monopile — монопаля',
  jacket: 'Jacket — ґратчаста основа',
  floating: 'Floating — плавуча платформа',
  // step 11 — role
  pros: 'Плюси',
  cons: 'Мінуси/виклики',
  gridMode: 'Grid-following (мережевідомий) / Grid-forming (мережоформувальний)',
  simplifiedChip: 'спрощено',
  trip: 'Вимкнути великий блок',
  portalHub: 'Хаб: Електростанції',
  portalSolar: 'Далі: Сонячна СЕС',
  portalGrid: 'Енергосистема: як балансувати вітер',
  frequency: 'Частота f',
} as const;

export default defineContent(raw, { labels: L });

/** Display names of a step's hotspots in document order — `stepUi` looks the card text up by this name. */
export function hotspotNames(stepId: string): string[] {
  return raw.steps.find((s) => s.id === stepId)?.hotspots.map((h) => h.name) ?? [];
}
