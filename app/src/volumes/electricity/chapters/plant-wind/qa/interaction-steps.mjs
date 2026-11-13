// Test cases of interaction.mjs: per step, every control with the change it must cause.
// `read` returns what is observed (control values through `value(id)`, scene state through `wind('<expr on w>')`),
// `do` performs the gesture, `expect(before, after)` decides (default: the observation changed).
const v = (id) => ({ value }) => value(id);
const live = (key) => ({ wind }) => wind(`w.live.${key}`);
const both = (id, key) => async ({ value, wind }) => [await value(id), await wind(`w.live.${key}`)];
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export const STEPS = [
  {
    id: 'overview',
    cases: [{ name: 'День / Ніч switches the night on', read: both('ov.night', 'nightTarget'), do: (a) => a.toggle('ov.night'), expect: (_b, a) => a[0] === true && a[1] === 1 }],
  },
  {
    id: 'wind-power',
    cases: [
      { name: 'v slider drives the wind', read: both('wp.v', 'windTarget'), do: (a) => a.slider('wp.v', 0.8), expect: (b, a) => a[0] > b[0] && a[1] === a[0] },
      { name: 'D slider resizes the rotor', read: both('wp.d', 'rotorScaleTarget'), do: (a) => a.slider('wp.d', 0.2), expect: (b, a) => a[0] < b[0] && a[1] < 1 },
      { name: 'T slider changes the temperature', read: v('wp.t'), do: (a) => a.slider('wp.t', 0.15), expect: (b, a) => a < b },
      { name: '×2 button doubles the speed', read: v('wp.v'), do: async (a) => (await a.slider('wp.v', 0.2), await a.button('wp.double'), await a.step(150)), expect: (_b, a) => a >= 9 },
    ],
  },
  {
    id: 'betz',
    cases: [
      { name: 'a slider moves the induction factor', read: v('bz.a'), do: (a) => a.slider('bz.a', 0.9) },
      { name: 'preset «Не гальмує» → a = 0', read: v('bz.a'), do: (a) => a.button('bz.free'), expect: (_b, a) => a === 0 },
      { name: 'preset «Стіна» stops the rotor', read: live('heroRpm'), do: async (a) => (await a.button('bz.block'), await a.step(240)), expect: (_b, a) => a < 0.5 },
      { name: 'preset «Оптимум» → a = 1/3', read: v('bz.a'), do: (a) => a.button('bz.betz'), expect: (_b, a) => Math.abs(a - 1 / 3) < 1e-6 },
    ],
  },
  {
    id: 'blade',
    cases: [
      { name: 'α slider (into stall)', read: v('bl.alpha'), do: (a) => a.slider('bl.alpha', 0.85), expect: (b, a) => a > 14 && a !== b },
      { name: 'span slider', read: v('bl.span'), do: (a) => a.slider('bl.span', 0.1), expect: (b, a) => a < b },
    ],
  },
  {
    id: 'nacelle',
    cases: [
      { name: 'Розріз / Зовнішній вигляд closes the cover', read: both('nc.cut', 'coverTarget'), do: (a) => a.toggle('nc.cut'), expect: (_b, a) => a[0] === false && a[1] === 0 },
      { name: 'Шлях енергії reopens the cutaway', read: both('nc.cut', 'coverTarget'), do: async (a) => (await a.button('nc.path'), await a.step(60)), expect: (_b, a) => a[0] === true && a[1] === 1 },
    ],
  },
  {
    id: 'drivetrain',
    cases: [
      { name: 'segmented → direct drive', read: ({ wind }) => wind('w.variant()'), do: async (a) => (await a.slider('dt.v', 0.3), await a.segmentNear('dt.field', 36, 1, 3)), expect: (_b, a) => a === 'B_DIRECT' },
      { name: 'v slider drives the wind', read: both('dt.v', 'windTarget'), do: (a) => a.slider('dt.v', 0.75), expect: (b, a) => a[0] > b[0] && a[1] === a[0] },
      { name: 'B-field toggle', read: v('dt.field'), do: (a) => a.toggle('dt.field'), expect: (_b, a) => a === false },
    ],
  },
  {
    id: 'power-curve',
    cases: [
      { name: 'v slider → rated power', read: async ({ value, wind }) => [await value('pc.v'), round(await wind('w.live.heroPower'))], do: async (a) => (await a.slider('pc.v', 0.5), await a.step(120)), expect: (_b, a) => a[0] > 12 && a[1] === 1 },
      { name: 'Storm control toggle', read: v('pc.sc'), do: (a) => a.toggle('pc.sc'), expect: (_b, a) => a === true },
      { name: 'Порив raises the wind', read: async ({ wind }) => round(await wind('w.live.wind'), 1), do: async (a) => (await a.button('pc.gust'), await a.step(60)), expect: (b, a) => a > b + 4 },
      { name: 'Шторм: storm control keeps producing at 28 m/s', read: async ({ wind }) => [round(await wind('w.live.wind'), 0), round(await wind('w.live.heroPower'))], do: async (a) => (await a.button('pc.storm'), await a.step(420)), expect: (_b, a) => a[0] >= 27 && a[1] > 0.6 && a[1] < 0.8 },
      { name: 'Пряме вимкнення: the turbine stops in the storm', read: async ({ wind }) => round(await wind('w.live.heroPower')), do: async (a) => (await a.toggle('pc.sc'), await a.step(60)), expect: (_b, a) => a === 0 },
    ],
  },
  {
    id: 'wind-farm',
    cases: [
      { name: 'row spacing slider re-lays the farm', read: async ({ wind }) => [await wind('w.farmParams().rowSpacingD'), round(await wind('w.farm().efficiency'), 3)], do: (a) => a.slider('wf.s', 0.9), expect: (b, a) => a[0] > b[0] && a[1] > b[1] },
      { name: 'row spacing back to 5 D', read: ({ wind }) => wind('w.farmParams().rowSpacingD'), do: (a) => a.slider('wf.s', 2 / 9), expect: (_b, a) => a === 5 },
      { name: 'Wake steering raises the efficiency along the rows', read: async ({ wind }) => round(await wind('w.farm().efficiency'), 3), do: (a) => a.toggle('wf.steer'), expect: (b, a) => b === 0.639 && a === 0.679 },
      { name: 'dragging the wind arrow turns the wind', read: ({ wind }) => wind('w.farmParams().windFromDeg'), do: (a) => a.dragWorld([-18, 40.2, -34], [-9.2, 40.2, -55.2]), expect: (b, a) => b === 270 && a > 290 && a < 340 },
    ],
  },
  {
    id: 'capacity-factor',
    cases: [
      { name: 'mean speed slider', read: v('cf.vmean'), do: (a) => a.slider('cf.vmean', 0.2), expect: (b, a) => a < b },
      { name: 'hub height recomputes v̄ and grows the tower', read: both('cf.vmean', 'towerScaleTarget'), do: (a) => a.slider('cf.h', 0.98), expect: (_b, a) => Math.abs(a[0] - 8.5) < 0.11 && a[1] > 1.15 },
      { name: 'terrain «ліс» lowers v̄ at 60 m', read: v('cf.vmean'), do: async (a) => (await a.slider('cf.h', 0.02), await a.segmentNear('cf.h', 50, 2, 3)), expect: (_b, a) => Math.abs(a - 6.3) < 0.11 },
    ],
  },
  {
    id: 'offshore',
    cases: [
      { name: 'Відстань до берега beyond the HVDC threshold', read: v('of.km'), do: (a) => a.slider('of.km', 0.8), expect: (_b, a) => a > 80 },
      { name: 'Глибина → 150 m', read: v('of.depth'), do: async (a) => (await a.segmentNear('of.compare', 58, 3, 4), await a.step(120)), expect: (_b, a) => a === 'd150' },
      { name: 'Порівняти розміри', read: v('of.compare'), do: async (a) => (await a.toggle('of.compare'), await a.step(120)), expect: (_b, a) => a === true },
    ],
  },
  {
    id: 'role',
    cases: [
      { name: 'Grid-forming', read: v('rl.mode'), do: (a) => a.segmentNear('rl.trip', -42, 1, 2), expect: (_b, a) => a === 'forming' },
      { name: 'trip button plays the frequency answer', read: v('rl.mode'), do: async (a) => (await a.button('rl.trip'), await a.step(300)), expect: (_b, a) => a === 'forming' },
    ],
  },
];
