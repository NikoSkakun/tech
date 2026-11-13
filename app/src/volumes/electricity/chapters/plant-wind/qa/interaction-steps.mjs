// Test cases of interaction.mjs: per step, every control with the change it must cause.
// `read(see)` returns what is observed — `see.value(id)` (control), `see.read(name)` (state the scene exposes),
// `see.locate(probe)` (screen position), `see.position()` (address) —, `do(act)` performs the gesture,
// `expect(before, after)` decides (default: the observation changed).
const v = (id) => (see) => see.value(id);
const live = (key) => async (see) => (await see.read('live'))[key];
const both = (id, key) => async (see) => [await see.value(id), (await see.read('live'))[key]];
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
/** Tapping a hotspot marker opens the card of that content hotspot (a second tap closes it again). */
const card = (id) => ({ name: `hotspot «${id}» opens its card`, read: (see) => see.read('hotspot'), do: async (a) => (await a.tap(`hs.${id}`), await a.tap(`hs.${id}`)), expect: (_b, a) => a === id });
const HERE = 'electricity/plant-wind/role';

const first = [
  {
    id: 'overview',
    cases: [
      { name: 'День / Ніч switches the night on', read: both('ov.night', 'nightTarget'), do: (a) => a.toggle('ov.night'), expect: (_b, a) => a[0] === true && a[1] === 1 },
      { name: 'Обліт острова moves the camera', read: async (see) => round((await see.locate('hero.hub')).x, 0), do: async (a) => (await a.button('ov.fly'), await a.step(300)), expect: (b, a) => Math.abs(a - b) > 4 },
      card('wind-turbine'),
    ],
  },
  {
    id: 'wind-power',
    cases: [
      { name: 'v slider drives the wind', read: both('wp.v', 'windTarget'), do: (a) => a.slider('wp.v', 0.8), expect: (b, a) => a[0] > b[0] && a[1] === a[0] },
      { name: 'D slider resizes the rotor', read: both('wp.d', 'rotorScaleTarget'), do: (a) => a.slider('wp.d', 0.2), expect: (b, a) => a[0] < b[0] && a[1] < 1 },
      { name: 'T slider changes the temperature', read: v('wp.t'), do: (a) => a.slider('wp.t', 0.15), expect: (b, a) => a < b },
      { name: '×2 button doubles the speed', read: v('wp.v'), do: async (a) => (await a.slider('wp.v', 0.2), await a.button('wp.double'), await a.step(150)), expect: (_b, a) => a >= 9 },
      card('anemometer'),
    ],
  },
  {
    id: 'betz',
    cases: [
      { name: 'a slider moves the induction factor', read: v('bz.a'), do: (a) => a.slider('bz.a', 0.9) },
      { name: 'preset «Не гальмує» → a = 0', read: v('bz.a'), do: (a) => a.button('bz.free'), expect: (_b, a) => a === 0 },
      { name: 'preset «Стіна» stops the rotor', read: live('heroRpm'), do: async (a) => (await a.button('bz.block'), await a.step(240)), expect: (_b, a) => a < 0.5 },
      { name: 'preset «Оптимум» → a = 1/3', read: v('bz.a'), do: (a) => a.button('bz.betz'), expect: (_b, a) => Math.abs(a - 1 / 3) < 1e-6 },
      card('stream-tube'),
    ],
  },
  {
    id: 'blade',
    cases: [
      { name: 'α slider into the stall: the flow separates', read: async (see) => [await see.value('bl.alpha'), round((await see.read('blade')).attached)], do: (a) => a.slider('bl.alpha', 0.85), expect: (b, a) => b[1] === 1 && a[0] > 14 && a[1] < 0.8 },
      { name: 'span slider turns the section', read: async (see) => [await see.value('bl.span'), round((await see.read('blade')).foilAngle, 3)], do: (a) => a.slider('bl.span', 0.1), expect: (b, a) => a[0] < b[0] && a[1] !== b[1] },
      card('leading-edge-protection'),
      card('lightning-receptor'),
    ],
  },
  {
    id: 'nacelle',
    cases: [
      { name: 'Розріз / Зовнішній вигляд closes the cover', read: both('nc.cut', 'coverTarget'), do: (a) => a.toggle('nc.cut'), expect: (_b, a) => a[0] === false && a[1] === 0 },
      { name: 'Шлях енергії reopens the cutaway', read: both('nc.cut', 'coverTarget'), do: async (a) => (await a.button('nc.path'), await a.step(60)), expect: (_b, a) => a[0] === true && a[1] === 1 },
      card('gearbox'),
      card('generator'),
    ],
  },
  {
    id: 'drivetrain',
    cases: [
      { name: 'segmented → direct drive', read: (see) => see.read('variant'), do: async (a) => (await a.segment('dt.set', 'B_DIRECT'), await a.step(60)), expect: (_b, a) => a === 'B_DIRECT' },
      { name: 'v slider drives the wind', read: both('dt.v', 'windTarget'), do: (a) => a.slider('dt.v', 0.75), expect: (b, a) => a[0] > b[0] && a[1] === a[0] },
      { name: 'B-field toggle', read: v('dt.field'), do: (a) => a.toggle('dt.field'), expect: (_b, a) => a === false },
      card('dc-link'),
    ],
  },
];

const farm = (see) => see.read('farm');
const eff = async (see) => round((await see.read('farm')).efficiency, 3);
const second = [
  {
    id: 'power-curve',
    cases: [
      { name: 'v slider → rated power', read: async (see) => [await see.value('pc.v'), round((await see.read('live')).heroPower)], do: async (a) => (await a.slider('pc.v', 0.5), await a.step(120)), expect: (_b, a) => a[0] > 12 && a[1] === 1 },
      { name: 'Штормове регулювання selected', read: v('pc.sc'), do: (a) => a.segment('pc.sc', 'control'), expect: (_b, a) => a === 'control' },
      { name: 'Порив raises the wind', read: async (see) => round((await see.read('live')).wind, 1), do: async (a) => (await a.button('pc.gust'), await a.step(60)), expect: (b, a) => a > b + 4 },
      { name: 'Шторм: storm control keeps producing at 28 m/s', read: async (see) => [round((await see.read('live')).wind, 0), round((await see.read('live')).heroPower)], do: async (a) => (await a.button('pc.storm'), await a.step(420)), expect: (_b, a) => a[0] >= 27 && a[1] > 0.6 && a[1] < 0.8 },
      { name: 'Пряме вимкнення: the turbine stops in the storm', read: async (see) => round((await see.read('live')).heroPower), do: async (a) => (await a.segment('pc.sc', 'cut'), await a.step(60)), expect: (_b, a) => a === 0 },
      card('aviation-light'),
    ],
  },
  {
    id: 'wind-farm',
    cases: [
      { name: 'row spacing 7 D → 11 D: 0,726 → 0,829', read: async (see) => [(await farm(see)).rowSpacingD, await eff(see)], do: (a) => a.slider('wf.s', 0.9), expect: (b, a) => b[1] === 0.726 && a[0] === 11 && a[1] === 0.829 },
      { name: 'row spacing back to 5 D', read: async (see) => (await farm(see)).rowSpacingD, do: (a) => a.slider('wf.s', 2 / 9), expect: (_b, a) => a === 5 },
      { name: 'Керування слідом along the rows: 0,639 → 0,679', read: eff, do: (a) => a.toggle('wf.steer'), expect: (b, a) => b === 0.639 && a === 0.679 },
      { name: 'wind-speed slider changes the farm wind', read: async (see) => (await farm(see)).vMs, do: async (a) => (await a.slider('wf.v', 0.9), await a.step(240)), expect: (b, a) => b === 8 && a > 12 },
      { name: 'direction slider swings the wakes', read: async (see) => (await farm(see)).windFromDeg, do: async (a) => (await a.slider('wf.dir', 0.9), await a.step(300)), expect: (b, a) => b === 270 && a > 300 },
      { name: 'dragging the wind arrow turns the wind', read: v('wf.dir'), do: (a) => a.dragProbe('farm.arrow', 0.16, 0.12) },
      card('substation-transformer'),
      card('underground-cable'),
    ],
  },
  {
    id: 'capacity-factor',
    cases: [
      { name: 'mean speed slider', read: v('cf.vmean'), do: (a) => a.slider('cf.vmean', 0.2), expect: (b, a) => a < b },
      { name: 'hub height recomputes v̄ and grows the tower', read: both('cf.vmean', 'towerScaleTarget'), do: (a) => a.slider('cf.h', 0.98), expect: (_b, a) => Math.abs(a[0] - 8.5) < 0.11 && a[1] > 1.15 },
      { name: 'terrain «ліс» lowers v̄ at 60 m', read: v('cf.vmean'), do: async (a) => (await a.slider('cf.h', 0.02), await a.segment('cf.terrain', 'forest')), expect: (_b, a) => Math.abs(a - 6.3) < 0.11 },
      { name: '«День року» slider picks a day and its wind', read: both('cf.day', 'windTarget'), do: (a) => a.slider('cf.day', 0.75), expect: (b, a) => a[0] > 200 && a[1] !== b[1] },
      { name: 'scrubbing the year strip picks a day', read: v('cf.day'), do: (a) => a.scrub('cf.year', 0.3, 0.45), expect: (b, a) => a !== b && a > 100 && a < 200 },
      card('lidar'),
    ],
  },
  {
    id: 'offshore',
    cases: [
      { name: 'Відстань до берега beyond 80 km: HVDC platform', read: async (see) => [await see.value('of.km'), (await see.read('offshore')).hvdc], do: async (a) => (await a.slider('of.km', 0.8), await a.step(60)), expect: (b, a) => b[1] === false && a[0] > 80 && a[1] === true },
      card('hvdc-platform'),
      { name: 'Глибина → 150 m', read: v('of.depth'), do: async (a) => (await a.segment('of.depth', 'd150'), await a.step(120)), expect: (_b, a) => a === 'd150' },
      { name: 'Порівняти розміри raises the yardsticks', read: async (see) => [await see.value('of.compare'), (await see.read('offshore')).yardsticks], do: async (a) => (await a.toggle('of.compare'), await a.step(120)), expect: (_b, a) => a[0] === true && a[1] === true },
    ],
  },
  {
    id: 'role',
    cases: [
      { name: 'trip, wind follows the grid: deep dip, rotors unaffected', read: async (see) => { const r = await see.read('role'); return [round(r.f), round(r.spinDip)]; }, do: async (a) => (await a.button('rl.trip'), await a.step(50)), expect: (b, a) => b[0] === 50 && a[0] < 49.3 && a[1] === 0 },
      { name: 'Мережоформувальний selected', read: v('rl.mode'), do: (a) => a.segment('rl.mode', 'forming'), expect: (_b, a) => a === 'forming' },
      { name: 'trip, grid-forming wind: rotors lend their spin', read: async (see) => round((await see.read('role')).spinDip), do: async (a) => (await a.button('rl.trip'), await a.step(70)), expect: (_b, a) => a > 0.05 },
      { name: 'the 30 s answer plays to its end', read: async (see) => round((await see.read('role')).played, 0), do: (a) => a.step(600), expect: (_b, a) => a === 30 },
      // a portal / chip to a chapter that is not built yet does nothing (and logs nothing); a built one navigates
      { name: 'portal «Далі: Сонячна СЕС»', read: async (see) => [await see.position(), (await see.read('portals'))[1].built], do: (a) => a.tap('portal1', 90), expect: (_b, a) => (a[0] === HERE) === !a[1] },
      { name: '«Див. також» chip → plants', read: async (see) => [await see.position(), (await see.read('portals'))[0].built], do: (a) => a.node('xref-electricity/plants/gallery'), expect: (_b, a) => (a[0] === HERE) === !a[1] },
      card('repowering'),
      card('bird-radar'),
    ],
  },
];

export const STEPS = [...first, ...second];
