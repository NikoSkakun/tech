// Test cases of interaction.mjs: per step, every control with the change it must cause.
// `read(see)` returns what is observed — `see.value(id)` (control), `see.read(name)` (state the scene exposes),
// `see.locate(probe)`, `see.position()` —, `do(act)` performs the gesture, `expect(before, after)` decides
// (default: the observation changed).
const v = (id) => (see) => see.value(id);
const r = (name, key) => async (see) => (await see.read(name))[key];
/** Tapping a hotspot marker opens the card of that content hotspot (a second tap closes it again). */
const card = (id) => ({ name: `hotspot «${id}» opens its card`, read: (see) => see.read('hotspot'), do: async (a) => (await a.tap(`hs.${id}`), await a.tap(`hs.${id}`)), expect: (_b, a) => a === id });

export const STEPS = [
  {
    id: 'overview',
    cases: [
      card('spray-ponds'),
      card('diesel-generators'),
      card('dry-storage'),
      { name: 'Зазирнути всередину dives into step 2', read: (see) => see.position(), do: async (a) => (await a.button('ov.inside'), await a.step(260)), expect: (_b, a) => a.endsWith('/fission') },
    ],
  },
  {
    id: 'fission',
    cases: [
      { name: 'Пустити нейтрон: a thermal neutron splits U-235', read: r('fission', 'fission'), do: async (a) => (await a.button('fi.fire'), await a.step(300)), expect: (b, a) => a === b + 1 },
      { name: 'energy 2 MeV', read: r('fission', 'energy'), do: (a) => a.segment('fi.energy', 'fast'), expect: (_b, a) => a === 'fast' },
      { name: 'Порівняти з горінням shows C + O₂', read: v('fi.burn'), do: (a) => a.toggle('fi.burn'), expect: (_b, a) => a === true },
      { name: 'slingshot: drag the neutron and let go', read: r('fission', 'phase'), do: async (a) => (await a.step(200), await a.dragProbe('fission.handle', -0.06, 0.02)), expect: (_b, a) => a !== 'ready' },
      card('u-238'),
      card('antineutrino'),
    ],
  },
  {
    id: 'chain-reaction',
    cases: [
      { name: 'rods out raise k', read: r('sandbox', 'k'), do: (a) => a.slider('cr.rods', 0.1), expect: (b, a) => a > b + 0.1 },
      { name: 'no water: the chain dies (k < 1)', read: r('sandbox', 'k'), do: (a) => a.toggle('cr.mod'), expect: (_b, a) => a < 0.8 },
      { name: '90 % enrichment', read: v('cr.e'), do: (a) => a.segment('cr.e', 'e90'), expect: (_b, a) => a === 'e90' },
      { name: 'small zone lowers k', read: r('sandbox', 'k'), do: (a) => a.segment('cr.size', 'small') , expect: (b, a) => a < b },
      { name: 'Скинути stops the run', read: r('sandbox', 'running'), do: (a) => a.button('cr.reset'), expect: (_b, a) => a === false },
      { name: 'Запустити 1 нейтрон starts a run', read: r('sandbox', 'running'), do: (a) => a.button('cr.one'), expect: (_b, a) => a === true },
      card('neutron-generation-time'),
    ],
  },
  {
    id: 'control',
    cases: [
      { name: 'Сповільнити нейтрон: collisions with hydrogen', read: r('control', 'hits'), do: async (a) => (await a.button('co.slow'), await a.step(150)), expect: (_b, a) => a > 0 },
      { name: 'delayed neutrons off', read: r('control', 'delayed'), do: (a) => a.segment('co.delayed', 'off'), expect: (_b, a) => a === false },
      { name: 'reactivity slider', read: r('control', 'pcm'), do: (a) => a.slider('co.rho', 0.95), expect: (b, a) => a > b },
      card('b-c'),
      card('negative-feedback'),
    ],
  },
  {
    id: 'fuel',
    cases: [
      card('guide-tubes'),
      { name: 'Масштаб → pellet', read: r('fuel', 'level'), do: async (a) => (await a.slider('fu.scale', 0), await a.step(240)), expect: (_b, a) => a < 0.3 },
      { name: 'tap the pellet: «≈ 0,6 t вугілля»', read: r('fuel', 'chip'), do: (a) => a.tap('fuel.pellet'), expect: (_b, a) => a === true },
      { name: 'Порівняти brings the coal heap', read: r('fuel', 'compare'), do: (a) => a.button('fu.compare'), expect: (_b, a) => a === true },
      { name: 'Карта зони: top view of the core', read: r('fuel', 'tilt'), do: async (a) => (await a.toggle('fu.map'), await a.step(150)), expect: (_b, a) => a > 0.5 },
      { name: 'Перевантаження reshuffles the core', read: r('fuel', 'ages'), do: async (a) => (await a.button('fu.reload'), await a.step(360)) },
    ],
  },
  {
    id: 'reactor',
    cases: [
      { name: 'Розріз closes the vessel', read: r('reactor', 'cut'), do: (a) => a.slider('re.cut', 0), expect: (b, a) => a < b },
      { name: 'layer: core', read: r('reactor', 'layer'), do: (a) => a.segment('re.layer', 'core'), expect: (_b, a) => a === 'core' },
      { name: 'Знеструмити приводи drops the rods', read: r('reactor', 'rodsY'), do: async (a) => (await a.button('re.scram'), await a.step(240)), expect: (b, a) => a < b - 3 },
      { name: 'Відновити роботу lifts them again', read: r('reactor', 'dropT'), do: (a) => a.button('re.restore'), expect: (_b, a) => a < 0 },
      { name: 'cut open again for the cards', read: r('reactor', 'cut'), do: (a) => a.slider('re.cut', 1), expect: (b, a) => a > b },
      card('surveillance-specimens'),
      card('in-core-instrumentation'),
    ],
  },
  {
    id: 'primary-loop',
    cases: [
      { name: 'low pressure: boiling in the hot legs', read: r('loop', 'boiling'), do: (a) => a.slider('pl.p', 0.05), expect: (_b, a) => a === true },
      { name: 'Нагрівачі raise the pressure', read: r('loop', 'p'), do: async (a) => (await a.button('pl.heat'), await a.step(240)), expect: (b, a) => a > b },
      { name: 'Розпилення lowers it', read: r('loop', 'mode'), do: (a) => a.button('pl.spray'), expect: (_b, a) => a === 'spray' },
      { name: 'show the second circuit', read: r('loop', 'circuit'), do: (a) => a.segment('pl.c', 'second'), expect: (_b, a) => a === 'second' },
      card('horizontal-steam-generator'),
      card('loop-isolation-valves'),
    ],
  },
  {
    id: 'reactor-sim',
    cases: [
      { name: 'load 80 %: the reactor follows', read: r('console', 'load'), do: async (a) => (await a.slider('rs.L', 0.71), await a.step(60)), expect: (b, a) => a < b },
      { name: 'rod lever slider', read: r('console', 'rodTarget'), do: (a) => a.slider('rs.h', 0.9), expect: (b, a) => a > b },
      { name: 'time ×60', read: v('rs.speed'), do: (a) => a.segment('rs.speed', 'x60'), expect: (_b, a) => a === 'x60' },
      { name: 'drag the lever in the scene', read: r('console', 'rodTarget'), do: (a) => a.dragProbe('rs.lever', 0, 0.12), expect: (b, a) => a < b },
      { name: 'scram button in the scene', read: r('console', 'scram'), do: (a) => a.tap('rs.button'), expect: (_b, a) => a === true },
      { name: 'Відновити роботу', read: r('console', 'scram'), do: (a) => a.button('rs.restore'), expect: (_b, a) => a === false },
      { name: 'Скинути', read: r('console', 'timeS'), do: (a) => a.button('rs.reset'), expect: (b, a) => a < b },
      card('shift-supervisor'),
    ],
  },
  {
    id: 'safety',
    cases: [
      { name: 'АЗ', read: r('safety', 'scram'), do: (a) => a.button('sa.scram'), expect: (_b, a) => a === true },
      { name: 'Втратити охолодження', read: r('safety', 'coolingLost'), do: (a) => a.button('sa.lose'), expect: (_b, a) => a === true },
      { name: 'the coolant heats up', read: r('safety', 'tempC'), do: (a) => a.step(600), expect: (b, a) => a > b },
      { name: 'Запустити дизелі: cooling is back after 15 s', read: r('safety', 'coolingLost'), do: async (a) => (await a.button('sa.diesels'), await a.step(60)), expect: (b, a) => b === true && a === false },
      { name: 'Гідроємності САОЗ', read: r('safety', 'accumulatorUsed'), do: (a) => a.button('sa.acc'), expect: (_b, a) => a === true },
      { name: 'Бар’єри explode the shells', read: r('safety', 'spread'), do: async (a) => (await a.toggle('sa.barriers'), await a.step(90)), expect: (b, a) => a > b + 0.5 },
      { name: 'pick the cladding', read: v('sa.pick'), do: (a) => a.segment('sa.pick', 'clad'), expect: (_b, a) => a === 'clad' },
      card('hydro-accumulator'),
      card('hydrogen-recombiners'),
      card('new-safe-confinement'),
    ],
  },
  {
    id: 'reactor-types',
    cases: [
      { name: 'pick RBMK in the dock', read: r('types', 'pick'), do: (a) => a.segment('rt.pick', 'rbmk'), expect: (_b, a) => a === 'rbmk' },
      { name: 'tap the sodium reactor', read: r('types', 'pick'), do: (a) => a.tap('type.fast'), expect: (_b, a) => a === 'fast' },
      { name: 'Порівняти температури виходу', read: r('types', 'compare'), do: (a) => a.toggle('rt.cmp'), expect: (_b, a) => a === true },
      card('positive-void-coefficient'),
    ],
  },
  {
    id: 'fuel-cycle',
    cases: [
      { name: 'Рік: the assembly cools in the pool', read: r('cycle', 'heat'), do: (a) => a.slider('fc.year', 0.6), expect: (b, a) => a < b },
      { name: 'Скільки займає?', read: r('cycle', 'how'), do: (a) => a.button('fc.how'), expect: (_b, a) => a === true },
      { name: 'x_P lower → less natural uranium', read: r('cycle', 'feed'), do: (a) => a.slider('fc.xp', 0.05), expect: (b, a) => a < b },
      { name: 'x_T higher → more natural uranium', read: r('cycle', 'feed'), do: (a) => a.slider('fc.xt', 0.95), expect: (b, a) => a > b },
      card('centrifuge'),
      card('onkalo'),
    ],
  },
  {
    id: 'role-ukraine',
    cases: [
      { name: 'pick the South Ukraine plant', read: r('role', 'plant'), do: (a) => a.segment('ru.plant', 'south'), expect: (_b, a) => a === 'south' },
      { name: 'tap Rivne on the map', read: r('role', 'plant'), do: (a) => a.tap('npp.rivne'), expect: (_b, a) => a === 'rivne' },
      { name: 'share: France', read: r('role', 'share'), do: (a) => a.segment('ru.share', 'fr'), expect: (_b, a) => a === 'fr' },
      card('znpp-status'),
    ],
  },
];
