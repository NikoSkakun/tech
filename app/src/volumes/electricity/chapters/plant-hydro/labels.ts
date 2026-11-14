/**
 * Scene labels the generated content does not carry: callouts, slider and readout captions, chart titles.
 * DECISIONS §54: plain Ukrainian; symbols and units international. `QUOTED` are wordings the document gives
 * in «Бачимо» / «Інтерактив» that the export does not list as labels — the test checks each still stands in
 * the document verbatim.
 */
export const QUOTED = {
  // step 2
  lift: 'водяний ліфт',
  over1000:
    'більше, ніж дає найпотужніший гідроагрегат світу (1000 MW, Baihetan): таку потужність ділять між кількома агрегатами',
  // step 3
  overflowWarn:
    'перелив — головна причина руйнування насипних гребель; щоб його не було, є водоскид (крок 7)',
  // step 6
  linearModel: 'лінеаризована модель: справжній провал менший, бо миттєво відкрити апарат неможливо',
  blackStartModel: 'спрощений сценарій: відновлення справжньої енергосистеми триває години',
  // step 8
  pump: 'Насос',
  turbine: 'Турбіна',
  stop: 'Стоп',
  stored: 'запасена енергія, MWh',
  illustrativePrices: 'умовна станція, ілюстративні ціни',
  // step 7
  beforeAfter: 'до/після',
} as const;

export const SCENE = {
  ...QUOTED,
  // step 1 — structures (callouts)
  cReservoir: 'Водосховище',
  cDam: 'Гребля',
  cSpillway: 'Водоскид',
  cPowerhouse: 'Будівля ГЕС',
  cTailwater: 'Нижній б’єф',
  cUpper: 'Верхня водойма ГАЕС',
  cFish: 'Рибохід',
  cYard: 'Підстанція',
  // step 2
  cycleSun: 'Сонце випаровує воду',
  cycleClouds: 'Хмари несуть її до гір',
  cycleRain: 'Дощ наповнює річку',
  head: 'Напір H',
  flow: 'Витрата Q',
  eta: 'ККД η',
  power: 'Потужність P',
  energyCube: 'Енергія 1 m³',
  preset: 'Приклади',
  cube: '1 m³ = 1 t',
  // step 3
  damType: 'Тип греблі',
  gravity: 'Гравітаційна',
  arch: 'Арочна',
  embankment: 'Ґрунтова',
  runOfRiver: 'ГЕС на стоку',
  pBottom: 'Тиск біля дна p',
  force: 'Сила на 1 m греблі F',
  person: 'Людина',
  house10: '10 поверхів',
  clayCore: 'Глиняне ядро',
  rock: 'Скеля',
  // step 4
  rack: 'Сміттєзатримувальна решітка',
  intakeGate: 'Швидкий затвор',
  penstock: 'Напірний водовід',
  spiral: 'Спіральна камера',
  wicket: 'Напрямний апарат',
  runner: 'Робоче колесо',
  draft: 'Відсмоктувальна труба',
  generator: 'Генератор',
  closeTime: 'Час закриття',
  fast: '0,5 s',
  slow: '10 s',
  gauge: 'Тиск у водоводі',
  flowNow: 'Витрата Q',
  etaNow: 'ККД η',
  // step 5
  kaplan: 'Турбіна Каплана',
  francis: 'Турбіна Френсіса',
  pelton: 'Турбіна Пелтона',
  mapTitle: 'Напір і витрата: яка турбіна',
  effTitle: 'ККД від навантаження',
  jet: 'Швидкість струменя v',
  nozzles: 'Активні сопла',
  orBulb: 'або капсульна',
  // step 6
  rpm: 'Частота обертання n',
  rotorD: 'Діаметр ротора',
  pmTitle: 'Механічна потужність P_m',
  gateSeries: 'відкриття G',
  phase: 'Етап',
  phaseDiesel: 'дизель запускає допоміжні системи',
  phaseSpin: 'розгін агрегата',
  phaseExcite: 'збудження, напруга',
  phaseSync: 'напруга на шинах',
  phaseRestore: 'підключаємо підстанції',
  phaseDone: 'систему відновлено',
  governor: 'Регулятор швидкості',
  thrust: 'Підп’ятник',
  // step 7
  gateOpen: 'Відкриття затворів',
  manual: 'вручну',
  levelRel: 'Рівень відносно НПР',
  qTurb: 'Витрата через турбіни',
  qSpill: 'Витрата через водоскид',
  inflowChart: 'Приплив і рівень',
  kakhovka: 'Каховське водосховище',
  before: 'до',
  after: 'після',
  methane: 'бульбашки метану',
  silt: 'мул',
  stilling: 'Водобійний колодязь',
  // step 8
  mode: 'Режим години',
  dayTitle: 'Доба ГАЕС: ціна і режими',
  priceSeries: 'ціна, €/MWh',
  energyIn: 'Спожито',
  energyOut: 'Видано',
  cycleEff: 'ККД циклу',
  upperLevel: 'Верхня чаша',
  pumpTurbine: 'Насос-турбіна',
  limitNote: 'Чаша повна або порожня — агрегат зупинився',
  brush: 'Що ставимо на графік',
  motorGenerator: 'Мотор-генератор',
  lowerReservoir: 'Нижня водойма',
  toGrid: 'У мережу',
  fromGrid: 'З мережі',
  // step 9
  station: 'Станція',
  cascadeOutput: 'Виробіток каскаду',
  records: 'Рекорди',
  pros: 'Плюси',
  cons: 'Мінуси',
} as const;
