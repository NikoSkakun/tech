// Test cases of interaction.mjs: per step, every control with the change it must cause, every hotspot card, and
// the direct manipulations (buildings, lumps, plant dots). `read(see)` returns what is observed — `see.value(id)`
// (control), `see.read(name)` (state the scene exposes) —, `do(act)` performs the gesture, `expect(before, after)`
// decides (default: the observation changed).
const st = (name, key) => async (see) => (await see.read(name))[key];
const pair = (id, name, key) => async (see) => [await see.value(id), (await see.read(name))[key]];
const r3 = (x) => Math.round(x * 1000) / 1000;
/** Tapping a hotspot marker opens the card of that content hotspot (a second tap closes it again). */
const card = (id) => ({ name: `hotspot «${id}» opens its card`, read: (see) => see.read('hotspot'), do: async (a) => (await a.tap(`hs.${id}`), await a.tap(`hs.${id}`)), expect: (_b, a) => a === id });

export const STEPS = [
  {
    id: 'overview',
    cases: [
      { name: 'Час доби → night lights follow the hour', read: async (see) => [await see.value('ov.hour'), r3((await see.read('live')).nightTarget)], do: (a) => a.slider('ov.hour', 0.5), expect: (b, a) => a[0] < b[0] && a[1] < b[1] },
      { name: 'tap the boiler house selects it', read: st('overview', 'picked'), do: (a) => a.tap('ov.boiler'), expect: (_b, a) => a === 'boiler' },
      { name: '«Перейти до кроку…» opens the boiler step', read: (see) => see.position(), do: async (a) => (await a.tap('ov.boiler'), await a.button('ov.go'), await a.step(200)), expect: (_b, a) => a.endsWith('/boiler') },
    ],
  },
  { id: 'overview', cases: ['stack', 'cooling-tower', 'boiler-house', 'turbine-hall', 'switchyard'].map(card) },
  {
    id: 'coal',
    cases: [
      { name: 'Тип вугілля → lignite needs ≈ 309 wagons', read: async (see) => [await see.value('c.type'), (await see.read('coal')).target], do: (a) => a.segment('c.type', 'lignite'), expect: (_b, a) => a[0] === 'lignite' && a[1] === 309 },
      { name: 'tap the anthracite lump selects it (≈ 114 wagons)', read: st('coal', 'target'), do: async (a) => (await a.tap('coal.anthracite'), await a.step(90)), expect: (_b, a) => a === 114 },
      card('coal-seam'),
    ],
  },
  {
    id: 'coal-to-dust',
    cases: [
      { name: 'Тонкість помелу 40 % → unburnt loss 4 %', read: st('dust', 'unburnt'), do: (a) => a.slider('d.fine', 0), expect: (_b, a) => Math.abs(a - 4) < 0.05 },
      { name: 'Порівняти з волосиною shows the magnifier', read: st('dust', 'lens'), do: async (a) => (await a.toggle('d.hair'), await a.step(40)), expect: (_b, a) => a === true },
      { name: 'Пройти шляхом вугілля starts the trip', read: st('dust', 'trips'), do: (a) => a.button('d.trip'), expect: (b, a) => a === b + 1 },
    ],
  },
  {
    id: 'coal-to-dust',
    cases: [
      // the dumper is the first stop of the trip along the coal's way (the final shot is the mill)
      card('classifier'),
      card('stacker-reclaimer'),
    ],
  },
  {
    id: 'coal-to-dust',
    cases: [
      { name: 'hotspot «car-dumper» opens its card (first stop of the trip)', read: (see) => see.read('hotspot'), do: async (a) => (await a.button('d.trip'), await a.step(150), await a.tap('hs.car-dumper'), await a.tap('hs.car-dumper')), expect: (_b, a) => a === 'car-dumper' },
    ],
  },
  {
    id: 'boiler',
    cases: [
      { name: 'Показати шлях → flue gas', read: pair('b.path', 'boiler', 'path'), do: (a) => a.segment('b.path', 'gas'), expect: (_b, a) => a[0] === 'gas' && a[1] === 'gas' },
      { name: 'Прямоточний hides the drum', read: st('boiler', 'drum'), do: async (a) => (await a.segment('b.type', 'once'), await a.step(40)), expect: (b, a) => b === true && a === false },
      { name: 'Без екранів removes the tubes for 3 s', read: st('boiler', 'wallsOff'), do: (a) => a.button('b.noWalls'), expect: (b, a) => b === false && a === true },
      card('burner'),
      card('soot-blowers'),
      card('bottom-ash-hopper'),
    ],
  },
  {
    id: 'steam-params',
    cases: [
      { name: 'Тиск пари above critical → supercritical fluid', read: async (see) => [(await see.read('steam')).cls, (await see.read('steam')).phase], do: (a) => a.slider('sp.p', 0.8), expect: (_b, a) => a[1] === 'fluid' && a[0] !== 'subcritical' },
      { name: 'Температура raises η', read: st('steam', 'eta'), do: (a) => a.slider('sp.t', 0.9), expect: (b, a) => a > b },
      { name: 'preset Pingshan II → η 49,4 %', read: st('steam', 'eta'), do: (a) => a.button('sp.pingshan'), expect: (_b, a) => Math.abs(a - 0.494) < 0.002 },
      { name: 'preset old 200 MW → subcritical', read: st('steam', 'cls'), do: (a) => a.button('sp.old200'), expect: (_b, a) => a === 'subcritical' },
      { name: 'preset 300 MW (Україна)', read: st('steam', 'p'), do: (a) => a.button('sp.ua300'), expect: (_b, a) => a === 23.5 },
      { name: 'preset ultra-supercritical 1000 MW → 44,9 %', read: st('steam', 'eta'), do: (a) => a.button('sp.usc1000'), expect: (_b, a) => Math.abs(a - 0.449) < 0.001 },
      card('critical-point'),
      card('alloy'),
    ],
  },
  {
    id: 'turbine',
    cases: [
      { name: 'без проміжного перегріву: −3 points, loop gone', read: async (see) => [r3((await see.read('turbine')).eta), (await see.read('turbine')).loop], do: async (a) => (await a.segment('t.reheat', 'off'), await a.step(60)), expect: (b, a) => Math.abs(b[0] - a[0] - 0.03) < 0.001 && a[1] === false },
      { name: 'Навантаження 30 % lowers the load', read: st('live', 'loadTarget'), do: (a) => a.slider('t.load', 0), expect: (_b, a) => Math.abs(a - 0.3) < 0.01 },
      card('turning-gear'),
      card('stop-and-control-valves'),
      card('hydrogen-cooling'),
    ],
  },
  {
    id: 'feedwater',
    cases: [
      { name: 'Регенерація вимкнено: η 44,9 → 38,9 %', read: st('feed', 'eta'), do: (a) => a.segment('f.regen', 'off'), expect: (b, a) => Math.abs(b - 0.449) < 0.001 && Math.abs(a - 0.389) < 0.001 },
      { name: 'warmer cooling water lowers η', read: st('feed', 'eta'), do: (a) => a.slider('f.cw', 1), expect: (b, a) => a < b },
      card('vacuum-pump-ejector'),
      card('water-treatment'),
    ],
  },
  {
    id: 'flue-gas',
    cases: [
      { name: 'Каталізатор off → NOₓ 600 mg/Nm³', read: st('fluegas', 'nox'), do: (a) => a.toggle('g.scr'), expect: (_b, a) => Math.abs(a - 600) < 1 },
      { name: 'Електрофільтр off → dust soars, the plume darkens', read: st('fluegas', 'dust'), do: async (a) => (await a.toggle('g.esp'), await a.step(120)), expect: (b, a) => a > 100 * b },
      { name: 'Сіркоочищення off → SO₂ over the limit, no gypsum', read: st('fluegas', 'gypsum'), do: (a) => a.toggle('g.fgd'), expect: (b, a) => b > 16 && a === 0 },
      { name: 'Вугілля 2,5 % sulphur', read: st('fluegas', 'so2'), do: (a) => a.segment('g.s', '2.5'), expect: (b, a) => a > b },
      { name: 'CO₂ never changes', read: st('fluegas', 'co2'), do: (a) => a.toggle('g.esp'), expect: (b, a) => b === a },
      card('rapping'),
      card('stack'),
      card('gypsum'),
    ],
  },
  {
    id: 'ash-co2',
    cases: [
      { name: 'Уловлювання увімкнено: 750 MW, ≈ 101 g/kWh', read: async (see) => [(await see.read('carbon')).netMW, Math.round((await see.read('carbon')).gPerKWh)], do: (a) => a.segment('a.ccs', 'on'), expect: (_b, a) => a[0] === 750 && a[1] === 101 },
      { name: 'ККД блока 30 % raises g/kWh', read: st('carbon', 'gPerKWh'), do: (a) => a.slider('a.eta', 0), expect: (b, a) => a > b },
      card('ash-pond'),
      card('storage-formation'),
    ],
  },
  {
    id: 'chp-flex',
    cases: [
      { name: 'Тепло місту 480 MW → 220 MW, ε 84 %', read: async (see) => [Math.round((await see.read('chp')).el), Math.round((await see.read('chp')).eps * 100)], do: (a) => a.slider('h.q', 1), expect: (_b, a) => a[0] === 220 && a[1] === 84 },
      { name: 'Ранковий пік fills the shortfall', read: st('chp', 'shortfall'), do: async (a) => (await a.button('h.peak'), await a.step(600)), expect: (_b, a) => Math.abs(a - 9) < 0.05 },
      card('heat-exchanger'),
      card('heat-accumulator'),
    ],
  },
  {
    id: 'role-ukraine',
    cases: [
      { name: 'tap a plant dot shows its card', read: st('role', 'picked'), do: (a) => a.tap('station.trypilska'), expect: (_b, a) => a === 'trypilska' },
      { name: 'scrub the share bars → 2010', read: st('role', 'year'), do: (a) => a.scrub('r.share', 0.98, 0.42), expect: (_b, a) => a < 2025 },
      card('map-marker'),
    ],
  },
];
