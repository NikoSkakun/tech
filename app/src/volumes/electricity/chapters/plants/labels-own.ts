/**
 * Labels the chapter authors itself (the document does not carry them): part names for callouts, axis titles,
 * readout captions, short status words. Plain Ukrainian (DECISIONS §54 h); symbols and units international.
 * Captions that the document quotes «…» come from `doc()` in `labels.ts` instead; segmented items that the
 * document lists in backticks (`Пара` · `Газ` …) are copied here verbatim.
 */
export const OWN = {
  // islands (short names, the document's «Наскрізна візуальна ідея»)
  isl_coal: 'Вугільна ТЕС',
  isl_gas: 'Газова ПГУ',
  isl_nuclear: 'АЕС',
  isl_hydro: 'ГЕС і ГАЕС',
  isl_wind: 'ВЕС',
  isl_solar: 'СЕС',
  isl_geoBio: 'Геотермія і біомаса',
  isl_ocean: 'Припливна',
  isl_future: 'Майбутнє',
  ring: 'Спільна мережа',
  hall: 'Машинний зал',
  pickIsland: 'Торкніться острова, щоб дізнатися, яка це станція',
  notBuilt: 'Цей розділ ще готується',
  generator: 'Синхронний генератор',
  shelf: 'Полиця винятків: нічого не обертається',
  converter: 'Перетворювач',
  toGrid: 'У мережу',
  lossSum: 'Втрати разом',
  tHot: 'Температура нагрівника t_h',
  tCold: 'Температура холодильника t_c',
  carnotBoard: 'Межа Карно і реальні станції',
  carnotLimit: 'межа Карно',
  realUpTo: 'реальний ККД, до',
  hotRes: 'Гарячий резервуар',
  engine: 'Тепловий двигун',
  makeupClosed: 'майже не потрібен',
  makeupOpen: 'уся пара — в небо!',
  tsBoard: 'Діаграма T–s (ілюстративно)',
  boiler: 'Котел',
  turbine: 'Турбіна',
  generatorShort: 'Генератор',
  pressureRatio: 'Ступінь підвищення тиску r',
  etaReal: 'ККД реальної машини (з котлом-утилізатором — ПГУ)',
  exhaustT: 'Температура вихлопу',
  tsAirBoard: 'Діаграма T–s повітря (ідеальний цикл)',
  combustor: 'Камера згоряння',
  gasTurbineName: 'Турбіна',
  hrsg: 'Котел-утилізатор і паровий контур',
  steamTurbine: 'Парова турбіна HP → IP → LP',
  condenser: 'Конденсатор',
  pInst: 'Встановлена потужність P_inst',
  cf: 'КВВП (CF)',
  homes: 'Домогосподарств',
  mln: 'млн',
  metricsBoard: 'Рік роботи, вартість і CO₂',
  clock: 'Час від події',
  demand: 'Попит',
  raceBoard: 'Перегони потужності',
  lane: 'Станція',
  finishMin: 'Фініш, min',
  estimate: 'частина даних — оцінка (≈)',
  mixBoard: 'Частки у виробництві електроенергії',
  source: 'Джерело',
  dayPlus: 'доба+',
  nd: 'н/д',
  weather: 'залежить від погоди',
  sortBy: 'Сортувати за',
  nextTransmission: 'Далі: Магістральні мережі',
  shaftRpm: 'Оберти вала (ротора для вітру)',
} as const;

/** Lists of segmented items and per-option names (kept out of the content `labels`, which are plain strings). */
export const LISTS = {
  // 2 turbine-generator: the «Привід» items are the document's backticked words, in its order
  drives: ['Пара', 'Газ', 'Вода', 'Вітер', 'Без обертання'],
  driveName: ['Парова турбіна', 'Газова турбіна', 'Гідротурбіна', 'Вітроротор і мультиплікатор', ''],
  // 3 energy-chains: the tabs over the river, verbatim
  // 7 steam-island: the six miniatures, the document's cooling choices (backticks) and its figures
  sources: ['Вугільний котел', 'Реактор', 'Котел-утилізатор ПГУ', 'Розплавлена сіль (СЕС)', 'Геотермальна свердловина', 'Котел на біомасі'],
  steamTemp: ['≈ 600 °C', '≈ 280 °C, насичена', '≈ 565–600 °C', '≈ 540–565 °C', '≈ 150–250 °C', '≈ 450–540 °C'],
  cooling: ['Річка/ставок', 'Градирня', 'Повітря'],
  evaporation: ['≈ 0,4–1', '1,2–2,5', '≈ 0'],
  coolEta: ['типовий', '−0,3 пп', '−1,5 пп'],
  // comparison table rows (document «Таблиця „Порівняння“», column «Тип»): full and short names, in its order
  compareNames: ['Вугілля', 'Газ ПГУ', 'Газ ГТ (пікова)', 'Газопоршнева', 'АЕС', 'ГЕС', 'ГАЕС (накопичувач)', 'ВЕС наземна', 'ВЕС морська', 'СЕС з панелями', 'СЕС з концентраторами й накопичувачем', 'Геотермальна', 'Біомаса', 'Припливна (гребля)', 'Акумуляторний накопичувач (СНЕ)'],
  compareShort: ['Вугілля', 'ПГУ', 'ГТ', 'Двигуни', 'АЕС', 'ГЕС', 'ГАЕС', 'ВЕС', 'ВЕС-м', 'СЕС', 'СЕС-к', 'Геот.', 'Біом.', 'Прил.', 'СНЕ'],
  // 9 flexibility: lanes of the race (document M6 table, short)
  laneNames: ['Вугілля', 'ПГУ', 'ГТ', 'Двигуни', 'АЕС', 'ГЕС', 'ГАЕС', 'СНЕ', 'Вітер', 'Сонце'],
  // 10 mix: sectors (order of mix-data SECTORS), the document's names
  sectorNames: ['Вугілля', 'ТЕС і ТЕЦ', 'Газ', 'Інше викопне', 'Атом', 'ГЕС', 'Вітер', 'Сонце', 'Біо та інші ВДЕ', 'ВДЕ'],
  // 11 gallery: columns of the comparison table (document headers, shortened to fit) and dispatchability words
  compareCols: ['Тип', 'КВВП, %', 'ККД, %', 'CO₂, g/kWh', 'LCOE, $/MWh', 'Набір, %/min', 'Пуск', 'Диспетч.'],
  dispatch: ['так', 'ні', 'частково'],
  sankeyTabs: ['Вугілля', 'Газ (ПГУ)', 'Атом', 'ГЕС', 'Вітер', 'Сонце', 'Геотермія', 'Біомаса', 'Паливна комірка'],
} as const;

/** Short names of the forms of energy on the Sankey gates (step 3; the document's list of forms). */
export const FORM_NAMES = {
  chemical: 'Хімічна',
  gas: 'Хімічна',
  hydrogen: 'Хімічна (H₂)',
  nuclear: 'Ядерна',
  potential: 'Потенціальна',
  kinetic: 'Кінетична',
  radiant: 'Променева',
  thermal: 'Теплова',
  mechanical: 'Механічна',
  electric: 'Електрична',
  loss: 'Втрати (тепло)',
} as const;
