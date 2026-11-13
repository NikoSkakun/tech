// Test cases of `interaction.mjs`: per step, every control and every scene manipulation once.
// A case: { name, read({ value, read, position }) → observable state, do(act) → gesture, expect?(before, after) }.
// Without `expect` the observable state must simply differ. World points are [x, y, z] in scene units.
/** One field of a step's exposed state. */
const prop =
  (name, key) =>
  async ({ read }) =>
    (await read(name))[key];

const lattice = [
  { name: 'toggle «Елементарна комірка»', read: ({ value }) => value('cell1'), do: (a) => a.toggle('cell1') },
  {
    name: 'toggle «Море електронів» → ions push apart',
    read: prop('lattice', 'swell'),
    do: async (a) => (await a.toggle('sea1'), await a.step(120)),
    expect: (b, c) => c > b + 0.5,
  },
];

const sea = [
  {
    name: 'toggle «Поле»',
    read: prop('electron-sea', 'field'),
    do: (a) => a.toggle('field2'),
    expect: (b, c) => b === 0 && c > 0,
  },
  { name: 'slider E', read: prop('electron-sea', 'driftMmS'), do: (a) => a.slider('E2', 0.95) },
  {
    name: 'slider «Температура» → shorter τ',
    read: prop('electron-sea', 'tauFs'),
    do: (a) => a.slider('T2', 0.9),
    expect: (b, c) => c < b,
  },
  {
    name: 'toggle «Стежити за одним електроном» → the view follows',
    read: prop('electron-sea', 'centre'),
    do: async (a) => (await a.toggle('follow2'), await a.step(90)),
  },
];

const bands = [
  {
    name: 'slider «Кількість атомів» → 1',
    read: prop('bands', 'atoms'),
    do: (a) => a.slider('N3', 0),
    expect: (_b, c) => c === 1,
  },
  {
    name: 'material → Кремній',
    read: prop('bands', 'material'),
    do: (a) => a.segment('mat3', 'Si'),
    expect: (_b, c) => c === 'Si',
  },
  {
    name: 'slider «Температура» → n_i',
    read: prop('bands', 'niPerCm3'),
    do: (a) => a.slider('T3', 0.9),
    expect: (b, c) => c > b,
  },
];

const insulators = [
  {
    name: 'material → Скло',
    read: prop('insulators', 'material'),
    do: (a) => a.segment('mat4', 'glass'),
    expect: (_b, c) => c === 'glass',
  },
  {
    name: 'slider U → breakdown of glass',
    read: ({ read }) => read('insulators'),
    do: async (a) => (await a.slider('U4', 0.98), await a.step(30)),
    expect: (b, c) => c.fieldKVPerMm > b.fieldKVPerMm && c.breakdown && c.broken,
  },
  {
    name: 'button «Відновити»',
    read: prop('insulators', 'broken'),
    do: async (a) => (await a.slider('U4', 0.2), await a.button('fix4')),
    expect: (b, c) => b && !c,
  },
];

const resistance = [
  {
    name: 'metal → Ніхром',
    read: prop('resistance', 'metal'),
    do: (a) => a.segment('metal5', 'NiCr'),
    expect: (_b, c) => c === 'NiCr',
  },
  {
    name: 'slider t → ρ grows',
    read: prop('resistance', 'rhoOhmM'),
    do: (a) => a.slider('T5', 0.95),
    expect: (b, c) => c > b,
  },
  {
    name: 'slider «Домішки»',
    read: prop('resistance', 'impurity'),
    do: (a) => a.slider('imp5', 0.8),
    expect: (b, c) => c > b,
  },
  {
    name: 'button «Надпровідність»',
    read: prop('resistance', 'sc'),
    do: (a) => a.button('sc5'),
    expect: (b, c) => !b && c,
  },
  {
    name: 'slider T of mercury → ρ jumps',
    read: prop('resistance', 'hgRho'),
    do: (a) => a.slider('Thg5', 0.9),
    expect: (b, c) => b === 0 && c > 0,
  },
  {
    name: 'button «Назад до міді»',
    read: prop('resistance', 'sc'),
    do: (a) => a.button('back5'),
    expect: (b, c) => b && !c,
  },
];

const silicon = [
  {
    name: 'slider «Температура» → n_i',
    read: prop('silicon', 'niPerCm3'),
    do: (a) => a.slider('T6', 0.8),
    expect: (b, c) => c > b,
  },
  {
    name: 'toggle «Поле»',
    read: prop('silicon', 'field'),
    do: (a) => a.toggle('field6'),
    expect: (b, c) => b === 0 && c === 1,
  },
  {
    name: 'button «Посвітити» → photons make pairs',
    read: prop('silicon', 'free'),
    do: async (a) => (await a.button('light6'), await a.step(90)),
    expect: (b, c) => c > b,
  },
  {
    name: 'drag a hole → it moves bond by bond',
    read: prop('silicon', 'holeSlots'),
    do: async (a) => {
      const s = await a.read('silicon');
      const [x, y, z] = s.hole;
      await a.drag(
        [x, y, z],
        [
          [x + 0.62, y, z],
          [x + 1.24, y, z],
        ],
        30,
      );
    },
  },
];

const doping = [
  {
    name: 'slider N_D → 1 donor',
    read: prop('doping', 'donors'),
    do: (a) => a.slider('ND7', 0),
    expect: (b, c) => c < b,
  },
  {
    name: 'slider N_A → 1 acceptor',
    read: prop('doping', 'acceptors'),
    do: (a) => a.slider('NA7', 0),
    expect: (b, c) => c < b,
  },
  {
    name: 'drag P from the tray',
    read: prop('doping', 'donors'),
    do: (a) => a.drag('trayP', ['node7'], 90),
    expect: (b, c) => c === b + 1,
  },
  {
    name: 'drag B from the tray',
    read: prop('doping', 'acceptors'),
    do: (a) => a.drag('trayB', ['nodeB7'], 90),
    expect: (b, c) => c === b + 1,
  },
];

const pn = [
  {
    name: 'slider U_s → forward current',
    read: prop('pn-junction', 'currentA'),
    do: (a) => a.slider('Us8', 0.85),
    expect: (b, c) => c > b + 1e-3,
  },
  {
    name: 'button «Перевернути діод»',
    read: ({ read }) => read('pn-junction'),
    do: async (a) => (await a.button('flip8'), await a.step(60)),
    expect: (b, c) => c.flipped && c.currentA < 1e-9,
  },
];

const devices = [
  {
    name: 'tab «Світлодіод»',
    read: prop('devices', 'tab'),
    do: (a) => a.segment('dev9', 'led'),
    expect: (_b, c) => c === 'led',
  },
  {
    name: 'slider E_g → colour',
    read: async ({ read }) => (await read('devices')).led.wavelengthNm,
    do: (a) => a.slider('eg9', 0.8),
    expect: (b, c) => c < b,
  },
  {
    name: 'tab «Сонячний елемент»',
    read: prop('devices', 'tab'),
    do: (a) => a.segment('dev9', 'solar'),
    expect: (_b, c) => c === 'solar',
  },
  {
    name: 'slider G → pairs, fan',
    read: prop('devices', 'solar'),
    do: (a) => a.slider('g9', 0.1),
    expect: (b, c) => c < b,
  },
  {
    name: 'tab «Транзистор»',
    read: prop('devices', 'tab'),
    do: (a) => a.segment('dev9', 'mosfet'),
    expect: (_b, c) => c === 'mosfet',
  },
  {
    name: 'slider U_GS → channel',
    read: async ({ read }) => (await read('devices')).mosfet.channelFraction,
    do: (a) => a.slider('ugs9', 0.6),
    expect: (b, c) => b === 0 && c > 0,
  },
  {
    name: 'tab «Діод»',
    read: prop('devices', 'tab'),
    do: (a) => a.segment('dev9', 'diode'),
    expect: (_b, c) => c === 'diode',
  },
  {
    name: 'input → постійна',
    read: prop('devices', 'mode'),
    do: (a) => a.segment('ac9', 'dc'),
    expect: (_b, c) => c === 'dc',
  },
  {
    name: 'button «Далі: Електричне коло →»',
    read: async ({ position }) => (await position()).chapterId,
    do: async (a) => {
      await a.button('next9');
      for (let k = 0; k < 10; k++) {
        await a.wait(400);
        await a.step(30);
      }
    },
    expect: (_b, c) => c === 'current',
  },
];

export const STEPS = [
  { id: 'lattice', cases: lattice },
  { id: 'electron-sea', cases: sea },
  { id: 'bands', cases: bands },
  { id: 'insulators', cases: insulators },
  { id: 'resistance', cases: resistance },
  { id: 'silicon', cases: silicon },
  { id: 'doping', cases: doping },
  { id: 'pn-junction', cases: pn },
  { id: 'devices', cases: devices },
];
