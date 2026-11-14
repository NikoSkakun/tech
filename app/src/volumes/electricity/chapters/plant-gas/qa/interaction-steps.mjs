// Test cases of interaction.mjs: per step, every control with the change it must cause.
// `read(see)` returns what is observed — `see.value(id)` (control), `see.read(name)` (state the scene exposes),
// `see.locate(probe)` (screen position), `see.position()` (address) —, `do(act)` performs the gesture,
// `expect(before, after)` decides (default: the observation changed).
const v = (id) => (see) => see.value(id);
const r = (name, key) => async (see) => (await see.read(name))[key];
/** Tapping a hotspot marker opens the card of that content hotspot (a second tap closes it again). */
const card = (id) => ({ name: `hotspot «${id}» opens its card`, read: (see) => see.read('hotspot'), do: async (a) => (await a.tap(`hs.${id}`), await a.tap(`hs.${id}`)), expect: (_b, a) => a === id });

export const STEPS = [
  {
    id: 'overview',
    cases: [
      { name: 'click on the boiler selects it', read: r('overview', 'selected'), do: (a) => a.tap('fac.hrsg', 30), expect: (_b, a) => a === 'hrsg' },
      { name: 'Режим острова → peak starts the engines', read: r('overview', 'engines'), do: (a) => a.segment('ov.mode', 'peak'), expect: (b, a) => b === 3 && a === 8 },
      { name: 'the peaker starts 3 s later', read: r('overview', 'peakerOn'), do: (a) => a.step(240), expect: (_b, a) => a === 1 },
      { name: 'Перейти до кроку goes to the selected step', read: (see) => see.position(), do: async (a) => (await a.tap('fac.hrsg', 30), await a.button('ov.go'), await a.step(120)), expect: (_b, a) => a.endsWith('/combined-cycle') },
    ],
  },
  { id: 'overview', cases: [card('hrsg'), card('peaker'), card('engine-hall'), card('gas-station')] },
  {
    id: 'natural-gas',
    cases: [
      { name: 'Паливо → coal changes the reaction', read: r('fuel', 'fuel'), do: (a) => a.segment('ng.fuel', 'coal'), expect: (_b, a) => a === 'coal' },
      { name: 'Паливо → hydrogen', read: r('fuel', 'fuel'), do: (a) => a.segment('ng.fuel', 'h2'), expect: (_b, a) => a === 'h2' },
      { name: '1 m³ газу shows the cube', read: r('fuel', 'cube'), do: async (a) => (await a.button('ng.cube'), await a.step(60)), expect: (b, a) => !b && a },
      card('odorant'),
      card('gas-booster-compressor'),
    ],
  },
  {
    id: 'gas-turbine',
    cases: [
      { name: 'Розрізати closes the casing', read: r('gt', 'cut'), do: (a) => a.slider('gt.cut', 0.1), expect: (b, a) => a < b },
      { name: 'Секція → компресор focuses it', read: r('gt', 'focus'), do: (a) => a.segment('gt.sec', 'compressor'), expect: (_b, a) => a === 'compressor' },
      { name: 'click on the turbine section focuses it', read: r('gt', 'focus'), do: (a) => a.tap('gt.turbine', 20), expect: (_b, a) => a === 'turbine' },
      { name: 'Порівняти з авіадвигуном shows the turbofan', read: r('gt', 'fan'), do: async (a) => (await a.button('gt.jet'), await a.step(90)), expect: (b, a) => !b && a },
      card('inlet-guide-vanes'),
      card('bleed-air'),
      card('starter'),
    ],
  },
  {
    id: 'brayton-sim',
    cases: [
      { name: 'r slider changes the model', read: r('gt', 'r'), do: (a) => a.slider('br.r', 0.85) },
      { name: 'TIT slider lowers the efficiency', read: r('gt', 'eta'), do: (a) => a.slider('br.tit', 0.1), expect: (b, a) => a < b },
      { name: 'preset «Клас E» sets r 12, 1100 °C', read: async (see) => [await see.value('br.r'), await see.value('br.tit')], do: (a) => a.segment('br.preset', 'classE'), expect: (_b, a) => a[0] === 12 && a[1] === 1100 },
      { name: 'preset «Авіапохідна» sets r 30', read: v('br.r'), do: (a) => a.segment('br.preset', 'aeroderivative'), expect: (_b, a) => a === 30 },
      card('t-s-diagram'),
    ],
  },
  {
    id: 'hot-section',
    cases: [
      { name: 'TBC off: +120 °C', read: r('blade', 'metal'), do: (a) => a.toggle('hs.tbc'), expect: (b, a) => Math.abs(a - b - 120) < 1 },
      { name: 'film off: creep', read: r('blade', 'state'), do: (a) => a.toggle('hs.film'), expect: (_b, a) => a === 'creep' },
      { name: 'internal off: melting', read: r('blade', 'state'), do: (a) => a.toggle('hs.int'), expect: (_b, a) => a === 'melting' },
      { name: 'Відновити brings the cooling back', read: r('blade', 'state'), do: (a) => a.button('hs.restore'), expect: (_b, a) => a === 'ok' },
      { name: 'TIT slider (linked to step 4)', read: async (see) => [await see.value('hs.tit'), await see.value('br.tit')], do: (a) => a.slider('hs.tit', 0.2), expect: (b, a) => a[0] < b[0] && a[1] === a[0] },
      card('cooling-holes'),
      card('single-crystal'),
    ],
  },
  {
    id: 'combined-cycle',
    cases: [
      { name: 'levels 3 → 1 lowers η', read: r('cc', 'eta'), do: (a) => a.slider('cc.levels', 0.02), expect: (b, a) => a < b },
      { name: 'Допалювання lights the burners', read: r('cc', 'firing'), do: async (a) => (await a.slider('cc.firing', 0.9), await a.step(30)), expect: (b, a) => a > b },
      { name: 'Котел-утилізатор off: bypass, ST stops', read: async (see) => [(await see.read('cc')).bypass, (await see.read('cc')).stTarget], do: (a) => a.toggle('cc.hrsg'), expect: (_b, a) => a[0] === 1 && a[1] === 0 },
      card('drum'),
      card('bypass-stack'),
      card('acc'),
    ],
  },
  {
    id: 'flexibility',
    cases: [
      { name: 'the clock runs (1 s = 1 min)', read: r('race', 'tMin'), do: (a) => a.step(120) },
      { name: 'Скільки годин стояла ПГУ → 72 h', read: r('race', 'start'), do: (a) => a.segment('fx.hours', 'h72'), expect: (_b, a) => a === 'cold' },
      { name: 'Старт усім restarts the race', read: r('race', 'tMin'), do: (a) => a.button('fx.start'), expect: (b, a) => a < b },
      { name: 'Аварія starts the frequency dip', read: r('race', 'trip'), do: (a) => a.button('fx.trip'), expect: (b, a) => !b && a },
      card('thermal-stress'),
    ],
  },
  {
    id: 'gas-engines',
    cases: [
      { name: 'Такт за тактом holds and steps the engine', read: r('engine', 'crank'), do: async (a) => (await a.button('eng.stroke'), await a.step(80)), expect: (b, a) => Math.abs(a - b) > 0.5 },
      { name: 'Тепло місту 0 % → ε 45 %', read: r('engine', 'eps'), do: (a) => a.slider('eng.heat', 0), expect: (_b, a) => Math.abs(a - 0.45) < 0.02 },
      { name: 'Вигляд → мапа району', read: v('eng.view'), do: async (a) => (await a.segment('eng.view', 'map'), await a.step(150)), expect: (_b, a) => a === 'map' },
      { name: 'one unit fails: 5 % off', read: r('engine', 'off'), do: (a) => a.button('eng.fail'), expect: (_b, a) => Math.abs(a - 0.05) < 1e-6 },
      card('container-unit'),
      { name: 'one station 200 MW: the same failure blacks out 100 %', read: r('engine', 'off'), do: async (a) => (await a.segment('eng.layout', 'single200'), await a.button('eng.fail')), expect: (_b, a) => a === 1 },
    ],
  },
  { id: 'gas-engines', cases: [card('turbocharger')] },
  {
    id: 'emissions-hydrogen',
    cases: [
      { name: 'ККД станції down: more CO₂', read: r('emis', 'total'), do: (a) => a.slider('em.eta', 0.1), expect: (b, a) => a > b },
      { name: 'Витоки метану up: the cloud swells', read: r('emis', 'total'), do: (a) => a.slider('em.leak', 0.9), expect: (b, a) => a > b },
      { name: 'horizon 20 years', read: r('emis', 'total'), do: (a) => a.segment('em.gwp', 'gwp20'), expect: (b, a) => a > b },
      { name: 'Водень у суміші 30 %: ≈ 11 % of the energy', read: r('emis', 'eH2'), do: (a) => a.slider('em.h2', 0.3), expect: (_b, a) => a > 0.05 && a < 0.2 },
      card('flare'),
      card('hydrogen-flame'),
    ],
  },
  {
    id: 'role',
    cases: [
      card('bridge-fuel'),
      card('plant-kyiv5'),
      // the hub and plant-nuclear may not be built yet: then their buttons are disabled and nothing happens
      {
        name: 'Назад до галереї opens the hub (or is disabled while it is not built)',
        read: async (see) => ({ built: (await see.read('role'))?.gallery, at: await see.position() }),
        do: async (a) => {
          if (!(await a.read('role'))?.gallery) return a.step(240);
          await a.button('role.gallery');
          // another chapter loads in real time: keep stepping until the hub is on screen (≤ 15 s)
          for (let i = 0; i < 60 && !(await a.position()).includes('/plants/'); i++) await a.wait(250, 20);
        },
        expect: (b, a) => (b.built ? a.at.includes('/plants/') : a.at === b.at),
      },
    ],
  },
];
