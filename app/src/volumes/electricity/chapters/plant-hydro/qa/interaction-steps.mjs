// Test cases of interaction.mjs: per step, every control with the change it must cause.
// `read(see)` returns what is observed — `see.value(id)` (control), `see.read(name)` (state the scene exposes),
// `see.locate(probe)` (screen position), `see.position()` (address) —, `do(act)` performs the gesture,
// `expect(before, after)` decides (default: the observation changed).
const v = (id) => (see) => see.value(id);
const rd = (name, key) => async (see) => (await see.read(name))[key];
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
/** Tapping a hotspot marker opens the card of that content hotspot (a second tap closes it again). */
const card = (id) => ({
  name: `hotspot «${id}» opens its card`,
  read: (see) => see.read('hotspot'),
  do: async (a) => (await a.tap(`hs.${id}`), await a.tap(`hs.${id}`)),
  expect: (_b, a) => a === id,
});

export const STEPS = [
  {
    id: 'overview',
    cases: [
      {
        name: 'Рівень водосховища lowers the water',
        read: async (see) => round((await see.read('live')).levelTarget, 1),
        do: (a) => a.slider('ov.level', 0.1),
        expect: (b, a) => a < b - 5,
      },
      card('dam'),
      card('powerhouse'),
    ],
  },
  {
    id: 'water-energy',
    cases: [
      {
        name: 'H slider changes the power',
        read: rd('we', 'power'),
        do: (a) => a.slider('we.h', 0.9),
        expect: (b, a) => a > b * 2,
      },
      {
        name: 'Q slider changes the power',
        read: rd('we', 'power'),
        do: (a) => a.slider('we.q', 0.3),
        expect: (b, a) => a < b,
      },
      {
        name: 'η slider changes the power',
        read: rd('we', 'power'),
        do: (a) => a.slider('we.eta', 0.05),
        expect: (b, a) => a < b,
      },
      {
        name: 'preset «Мала ГЕС у Карпатах» → 0,33 MW',
        read: rd('we', 'power'),
        do: (a) => a.segment('we.preset', 'small'),
        expect: (_b, a) => Math.abs(a - 0.334) < 0.01,
      },
      card('net-head'),
    ],
  },
  {
    id: 'dams',
    cases: [
      {
        name: 'type switch morphs to the embankment',
        read: rd('dams', 'to'),
        do: (a) => a.segment('dm.type', 'embankment'),
        expect: (_b, a) => a === 'embankment',
      },
      {
        name: 'Рівень води changes the depth',
        read: rd('dams', 'depth'),
        do: (a) => a.slider('dm.level', 0.98),
        expect: (b, a) => a > b,
      },
      card('grout-curtain'),
    ],
  },
  {
    id: 'water-path',
    cases: [
      {
        name: 'gate opening changes the flow',
        read: rd('path', 'flow'),
        do: async (a) => (await a.slider('wp.gate', 0.3), await a.step(120)),
        expect: (b, a) => a < b - 50,
      },
      {
        name: 'surge tank toggle shows the tower',
        read: rd('path', 'tank'),
        do: (a) => a.toggle('wp.tank'),
        expect: (_b, a) => a === true,
      },
      {
        name: 'closing time 10 s selected',
        read: v('wp.tc'),
        do: (a) => a.segment('wp.tc', 'slow'),
        expect: (_b, a) => a === 'slow',
      },
      {
        name: 'Аварійне закриття (0,5 s) raises the penstock pressure',
        read: rd('path', 'peak'),
        do: async (a) => (
          await a.segment('wp.tc', 'fast'),
          await a.toggle('wp.tank'),
          await a.button('wp.trip'),
          await a.step(60)
        ),
        expect: (_b, a) => a > 5,
      },
      card('stay-vanes'),
    ],
  },
  {
    id: 'turbines',
    cases: [
      {
        name: 'low load shows the vortex rope and fewer nozzles',
        read: async (see) => [(await see.read('turbines')).rope, (await see.read('turbines')).nozzles],
        do: (a) => a.slider('tb.load', 0.15),
        expect: (_b, a) => a[0] === true && a[1] <= 2,
      },
      {
        name: 'H slider to the mountains picks the Pelton',
        read: rd('turbines', 'chosen'),
        do: async (a) => (await a.slider('tb.h', 0.97), await a.slider('tb.q', 0.15)),
        expect: (_b, a) => a.includes('pelton'),
      },
      {
        name: 'Q slider changes the point',
        read: v('tb.q'),
        do: (a) => a.slider('tb.q', 0.8),
        expect: (b, a) => a > b,
      },
      card('deflector'),
      card('kaplan-blade-servo'),
    ],
  },
  {
    id: 'generator-governor',
    cases: [
      {
        name: 'pole pairs → rpm',
        read: rd('gov', 'rpm'),
        do: (a) => a.slider('gg.p', 0.02),
        expect: (b, a) => a > b * 5,
      },
      {
        name: 'Різко: P_m dips to 0,6 first',
        read: rd('gov', 'pmMin'),
        do: async (a) => (await a.button('gg.sharp'), await a.step(30)),
        expect: (_b, a) => a !== null && a < 0.62,
      },
      {
        name: 'Плавно: almost no dip',
        read: rd('gov', 'pmMin'),
        do: async (a) => (await a.button('gg.smooth'), await a.step(120)),
        expect: (_b, a) => a !== null && a > 0.78,
      },
      {
        name: 'Блекаут → пуск з нуля starts the scenario',
        read: rd('gov', 'black'),
        do: async (a) => (await a.button('gg.black'), await a.step(60)),
        expect: (_b, a) => a > 0,
      },
      card('excitation'),
    ],
  },
  {
    id: 'reservoir-environment',
    cases: [
      {
        name: 'Приплив raises the spillway discharge',
        read: rd('res', 'spillM3s'),
        do: async (a) => (await a.slider('re.qin', 0.85), await a.step(240)),
        expect: (b, a) => a > b + 1000,
      },
      {
        name: 'manual mode with shut gates lets the level climb',
        read: rd('res', 'levelM'),
        do: async (a) => (
          await a.segment('re.mode', 'manual'),
          await a.slider('re.gate', 0),
          await a.step(600)
        ),
        expect: (b, a) => a > b + 0.5,
      },
      {
        name: 'Злива starts the storm inflow',
        read: rd('res', 'inflowM3s'),
        do: async (a) => (await a.segment('re.mode', 'auto'), await a.button('re.storm'), await a.step(400)),
        expect: (b, a) => a > b,
      },
      {
        name: 'Каховське водосховище card drains «після»',
        read: rd('res', 'drain'),
        do: async (a) => (
          await a.toggle('re.kakhovka'),
          await a.segment('re.ka', 'after'),
          await a.step(400)
        ),
        expect: (b, a) => a > b + 0.5,
      },
      card('fish-ladder'),
    ],
  },
  {
    id: 'pumped-storage',
    cases: [
      {
        name: 'painting the chart changes the plan',
        read: rd('psh', 'plan'),
        do: async (a) => (await a.segment('ps.brush', 'turbine'), await a.scrub('ps.day', 0.08, 0.16)),
        expect: (b, a) => a !== b,
      },
      {
        name: 'Автоплан restores the document plan',
        read: rd('psh', 'plan'),
        do: (a) => a.button('ps.auto'),
        expect: (_b, a) => a.startsWith('pump,pump,pump,pump,pump,pump,stop,turbine'),
      },
      {
        name: 'Відтворити добу plays the day',
        read: rd('psh', 'fill'),
        do: async (a) => (await a.button('ps.play'), await a.step(360)),
        expect: (b, a) => a > b + 0.2,
      },
      card('reversal'),
    ],
  },
  {
    id: 'role-ukraine',
    cases: [
      {
        name: 'clicking a station pin selects it',
        read: rd('ru', 'selected'),
        do: (a) => a.tap('ru.pin'),
        expect: (_b, a) => a === 2,
      },
      {
        name: 'station slider selects another',
        read: v('ru.st'),
        do: (a) => a.slider('ru.st', 0.95),
        expect: (b, a) => a !== b,
      },
      {
        name: 'water year switches',
        read: v('ru.year'),
        do: (a) => a.segment('ru.year', 'dry'),
        expect: (_b, a) => a === 'dry',
      },
      card('kakhovka'),
      {
        name: '«Далі: вітрова станція» opens plant-wind',
        read: (see) => see.position(),
        do: async (a) => (
          await a.button('ru.wind'),
          await a.wait(4000),
          await a.step(240),
          await a.wait(2000)
        ),
        expect: (_b, a) => a.startsWith('electricity/plant-wind'),
      },
    ],
  },
];
