// Test cases of `interaction.mjs`: per step, every control and every scene manipulation once.
// A case: { name, read({ value, read }) → observable state, do(act) → gesture, expect?(before, after) }.
// Without `expect` the observable state must simply differ. World points are [x, y, z] in scene units.
/** One field of a step's exposed state. */
const prop =
  (name, key) =>
  async ({ read }) =>
    (await read(name))[key];

const charge = [
  {
    name: 'portion → 10⁹ e⁻',
    read: ({ value }) => value('portion'),
    do: (a) => a.segment('portion', 'giga'),
  },
  {
    name: 'button →',
    read: ({ read }) => read('charge'),
    do: (a) => a.button('toRight'),
    expect: (b, c) => c.electronsMoved === b.electronsMoved + 1e9 && c.totalChargeC === 0,
  },
  {
    name: 'button ←',
    read: ({ read }) => read('charge'),
    do: (a) => a.button('toLeft'),
    expect: (b, c) => c.electronsMoved === b.electronsMoved - 1e9,
  },
  { name: 'portion → 1 e⁻', read: ({ value }) => value('portion'), do: (a) => a.segment('portion', 'one') },
  {
    name: 'brush: drag left sample → right',
    read: ({ read }) => read('charge'),
    do: (a) => a.drag('cube-left', ['cube-right']),
    expect: (b, c) => c.electronsMoved === b.electronsMoved + 1,
  },
  {
    name: 'brush: drag right sample → left',
    read: ({ read }) => read('charge'),
    do: (a) => a.drag('cube-right', ['cube-left']),
    expect: (b, c) => c.electronsMoved === b.electronsMoved - 1,
  },
  {
    name: 'reset',
    read: ({ read }) => read('charge'),
    do: async (a) => (await a.button('toRight'), await a.button('chargeReset')),
    expect: (_b, c) => c.electronsMoved === 0,
  },
];

const coulomb = [
  {
    name: 'slider q₁',
    read: ({ read }) => read('coulomb'),
    do: (a) => a.slider('q1', 0.9),
    expect: (b, c) => c.q1NC > b.q1NC && c.forceN > b.forceN,
  },
  {
    name: 'slider q₂ → positive',
    read: ({ read }) => read('coulomb'),
    do: (a) => a.slider('q2', 0.8),
    expect: (b, c) => b.kind === 'attraction' && c.kind === 'repulsion',
  },
  {
    name: 'drag ball 2 away',
    read: ({ read }) => read('coulomb'),
    do: async (a) => (await a.drag('ball-2', [[3.2, 1.5, 0]]), await a.step(90)),
    // the frame follows the pair (wider shot), board and readout keep one unit in plain notation
    expect: (b, c) =>
      c.distanceM > b.distanceM * 1.5 &&
      c.forceN < b.forceN &&
      c.frame > b.frame &&
      c.forceText.endsWith(c.chartUnit) &&
      !c.forceText.includes('×'),
  },
  { name: 'toggle gravity comparison', read: prop('coulomb', 'compare'), do: (a) => a.toggle('compare') },
  {
    name: 'ride down the scale',
    read: async ({ read }) => (await read('coulomb')).compare,
    do: async (a) => (await a.button('ride'), await a.step(200)),
    expect: (b, c) => b === true && c === true,
  },
  {
    name: 'toggle back',
    read: prop('coulomb', 'compare'),
    do: async (a) => (await a.step(400), await a.toggle('compare')),
  },
];

const field = [
  {
    name: 'preset dipole',
    read: ({ read }) => read('field'),
    do: (a) => a.segment('fieldPreset', 'dipole'),
    // before: the step opens on the ±2 nC pair, 8·|q| = 16 lines
    expect: (b, c) =>
      b.charges.length === 2 && b.lineCount === 16 && c.charges.length === 2 && c.charges[1].chargeNC === -1,
  },
  {
    name: 'preset two like charges → null point',
    read: ({ read }) => read('field'),
    do: (a) => a.segment('fieldPreset', 'likeCharges'),
    expect: (b, c) => !b.nullPoint && c.nullPoint,
  },
  {
    name: 'preset quadrupole',
    read: ({ read }) => read('field'),
    do: (a) => a.segment('fieldPreset', 'quadrupole'),
    expect: (_b, c) => c.charges.length === 4,
  },
  {
    // «Свій набір» brings back the learner's own arrangement — at first the pair the step opens on (16 lines)
    name: 'own set → the opening pair',
    read: ({ read }) => read('field'),
    do: (a) => a.segment('fieldPreset', 'own'),
    expect: (_b, c) =>
      c.charges.length === 2 &&
      c.charges[0].chargeNC === 2 &&
      c.charges[1].chargeNC === -2 &&
      c.lineCount === 16,
  },
  {
    name: 'preset single',
    read: ({ read }) => read('field'),
    do: (a) => a.segment('fieldPreset', 'single'),
    expect: (_b, c) => c.charges.length === 1,
  },
  {
    name: 'drag the probe',
    read: ({ read }) => read('field'),
    do: (a) => a.drag('probe', [[-2.4, 0.45, 2]]),
    expect: (b, c) => c.probe.x !== b.probe.x && c.probe.strength !== b.probe.strength,
  },
  {
    name: 'tap the probe → pin',
    read: ({ read }) => read('field'),
    do: (a) => a.tap('probe'),
    expect: (b, c) => c.probe.pins === b.probe.pins + 1,
  },
  {
    name: 'clear pins',
    read: ({ read }) => read('field'),
    do: (a) => a.button('clearPins'),
    expect: (_b, c) => c.probe.pins === 0,
  },
  {
    name: 'drag a charge',
    read: ({ read }) => read('field'),
    do: (a) => a.drag('charge-0', [[2.1, 0.45, -1.5]]),
    expect: (b, c) => Math.abs(c.charges[0].x - 0.07) < 0.01 && b.charges[0].x === 0,
  },
  {
    name: 'drag a charge from the tray',
    read: ({ read }) => read('field'),
    do: (a) => a.drag('tray-2', [[-1.8, 0.45, 1.2]]),
    expect: (b, c) => c.charges.length === b.charges.length + 1 && c.charges.some((q) => q.chargeNC === -1),
  },
  {
    name: 'tap a tray charge',
    read: ({ read }) => read('field'),
    do: (a) => a.tap('tray-1'),
    expect: (b, c) => c.charges.length === b.charges.length + 1,
  },
  {
    name: 'drag a charge off the table',
    read: ({ read }) => read('field'),
    do: (a) => a.drag('charge-0', [[7.4, 0.45, -1.5]]),
    expect: (b, c) => c.charges.length === b.charges.length - 1,
  },
  {
    name: 'release the test charge',
    read: ({ read }) => read('field'),
    do: async (a) => (await a.button('release'), await a.step(40)),
    expect: (b, c) => b.run === null && c.run !== null && c.run.timeS > 0,
  },
  {
    name: 'toggle arrow grid',
    read: ({ read }) => read('field'),
    do: (a) => a.toggle('grid'),
    expect: (b, c) => !b.grid && c.grid,
  },
  { name: 'toggle probe off', read: ({ value }) => value('probe'), do: (a) => a.toggle('probe') },
];

const potential = [
  {
    name: 'preset two hills',
    read: ({ read }) => read('potential'),
    do: (a) => a.segment('potPreset', 'twoHills'),
    expect: (_b, c) => c.charges[1].chargeNC === 2,
  },
  {
    name: 'preset hill and well',
    read: ({ read }) => read('potential'),
    do: (a) => a.segment('potPreset', 'hillAndWell'),
    expect: (_b, c) => c.charges[1].chargeNC === -2,
  },
  {
    name: 'ball sign −: relief flips',
    read: ({ read }) => read('potential'),
    do: async (a) => (await a.segment('ballSign', 'minus'), await a.step(80)),
    expect: (b, c) => b.sign === 1 && c.sign === -1,
  },
  {
    name: 'ball sign +',
    read: ({ read }) => read('potential'),
    do: async (a) => (await a.segment('ballSign', 'plus'), await a.step(80)),
    expect: (_b, c) => c.sign === 1,
  },
  {
    name: 'isoline step',
    read: ({ read }) => read('potential'),
    do: (a) => a.slider('isoStep', 0.02),
    expect: (b, c) => b.stepV === 50 && c.stepV === 10,
  },
  {
    name: 'drag voltmeter probe A',
    read: ({ read }) => read('potential'),
    do: async (a) => (await a.drag('needle-a', [[0, 0.05, 3.6]]), await a.step(60)),
    // the first probe move brings in the voltage "lift" board with its seven example floors
    expect: (b, c) =>
      Math.abs(c.voltageV - b.voltageV) > 1 && !b.lift.shown && c.lift.shown && c.lift.floors.length === 7,
  },
  {
    name: 'drag voltmeter probe B onto the same isoline',
    read: ({ read }) => read('potential'),
    do: (a) => a.drag('needle-b', [[0.03, 0.05, -3]]),
    // U = 0: the cabin of the lift stands under the lowest floor
    expect: (b, c) =>
      c.sameIsoline && Math.abs(c.voltageV) < 0.5 && c.lift.cabin === 7 && b.lift.cabin < c.lift.cabin,
  },
  {
    name: 'drag and release the ball',
    read: ({ read }) => read('potential'),
    do: async (a) => (await a.drag('test-ball', [[-0.6, 0.6, 3.4]], 4), await a.step(20)),
    expect: (_b, c) => c.ball.status === 'moving' && c.ball.timeS > 0 && c.ball.z > 0.05,
  },
  {
    name: 'button: roll the ball',
    read: ({ read }) => read('potential'),
    do: async (a) => (await a.button('roll'), await a.step(10)),
    expect: (_b, c) => c.ball.timeS < 1 && Math.abs(c.ball.z - 0.05) < 0.02,
  },
  {
    name: 'drag a charge over the relief',
    read: ({ read }) => read('potential'),
    do: (a) => a.drag('charge-0', [[-3, 1.2, 2]]),
    expect: (b, c) => c.charges[0].z > b.charges[0].z + 0.03,
  },
  {
    name: 'preset two hills again',
    read: ({ read }) => read('potential'),
    do: (a) => a.segment('potPreset', 'twoHills'),
    expect: (b, c) => b.charges[0].z > 0.03 && c.charges[0].z === 0 && c.charges[1].chargeNC === 2,
  },
  {
    name: 'own set → the dragged arrangement is back',
    read: ({ read }) => read('potential'),
    do: (a) => a.segment('potPreset', 'own'),
    expect: (_b, c) => c.charges[0].z > 0.03 && c.charges[1].chargeNC === -2,
  },
];

const conductor = [
  {
    name: 'slider E₀',
    read: ({ read }) => read('conductor'),
    do: (a) => a.slider('e0', 0.95),
    expect: (b, c) => c.e0 > b.e0 && c.shift > b.shift,
  },
  {
    name: 'drag the ball',
    read: ({ read }) => read('conductor'),
    do: (a) => a.drag('conductor', [[2.2, 1.35, 1]]),
    expect: (b, c) => c.x > b.x + 1 && c.inside,
  },
  {
    name: 'drag the ball out of the field',
    read: ({ read }) => read('conductor'),
    do: async (a) => (await a.drag('conductor', [[2.2, 1.35, 4.4]]), await a.step(60)),
    expect: (b, c) => b.inside && !c.inside && c.shift < 0.05,
  },
  {
    name: 'drag the ball back',
    read: ({ read }) => read('conductor'),
    do: async (a) => (await a.drag('conductor', [[0, 1.35, 0]]), await a.step(60)),
    expect: (_b, c) => c.inside && c.shift > 0.5,
  },
  { name: 'toggle cutaway', read: prop('conductor', 'cut'), do: (a) => a.toggle('cut') },
  { name: 'tab cage', read: prop('conductor', 'shape'), do: (a) => a.segment('shape', 'cage') },
  {
    name: 'phone into the cage',
    read: ({ read }) => read('conductor'),
    do: async (a) => (await a.button('phone'), await a.step(80)),
    expect: (b, c) => b.signal === 1 && c.signal === 0 && c.phoneIn > 0.9,
  },
  {
    name: 'phone out',
    read: ({ read }) => read('conductor'),
    do: async (a) => (await a.button('phoneOut'), await a.step(80)),
    expect: (_b, c) => c.signal === 1,
  },
  { name: 'tab tip', read: prop('conductor', 'shape'), do: (a) => a.segment('shape', 'tip') },
];

const HOME = [0.4, 2.9, 0.4]; // balloon rest position
const statics = [
  {
    name: 'button: one rubbing pass',
    read: ({ read }) => read('static'),
    do: (a) => a.button('rubOnce'),
    expect: (b, c) => c.passes === b.passes + 1 && c.chargeC < b.chargeC,
  },
  {
    name: 'rub the balloon on the sweater',
    read: ({ read }) => read('static'),
    do: (a) =>
      a.drag('balloon', [
        [-1.0, 2.0, 0.4],
        [-1.0, 4.0, 0.4],
        [-1.0, 2.0, 0.4],
        [-1.0, 4.0, 0.4],
        [-1.0, 2.0, 0.4],
        [-1.0, 4.0, 0.4],
      ]),
    expect: (b, c) => c.passes >= b.passes + 3 && Math.abs(c.chargeC) >= 60e-9 - 1e-12,
  },
  {
    name: 'stick the balloon to the wall: it squashes on the wall',
    read: ({ read }) => read('static'),
    do: async (a) => (await a.step(120), await a.drag('balloon', [[3.4, 3.2, 0.4]]), await a.step(60)),
    expect: (b, c) => c.mode === 'stuck' && b.squash < 0.01 && c.squash > 0.1,
  },
  {
    name: 'take the balloon off the wall',
    read: ({ read }) => read('static'),
    do: async (a) => (await a.drag('balloon', [HOME]), await a.step(60)),
    expect: (b, c) => b.mode === 'stuck' && c.mode === 'free',
  },
  {
    name: 'finger to the balloon → spark',
    read: ({ read }) => read('static'),
    do: (a) =>
      a.drag('finger', [
        [-0.9, 2.2, 0.4],
        [-0.66, 2.9, 0.4],
      ]),
    expect: (b, c) => b.chargeC < 0 && c.chargeC === 0,
  },
  {
    name: 'tab storm',
    read: prop('static', 'phase'),
    do: async (a) => (await a.segment('phase', 'storm'), await a.step(150)),
  },
  {
    name: 'slider charge separation',
    read: ({ read }) => read('static'),
    do: async (a) => (await a.slider('separation', 0.7), await a.step(120)),
    expect: (b, c) => c.separation > b.separation + 0.3 && !c.striking,
  },
  { name: 'toggle lightning rod off', read: prop('static', 'toRod'), do: (a) => a.toggle('rod') },
  {
    name: 'button lightning',
    read: ({ read }) => read('static'),
    do: async (a) => (await a.button('bolt'), await a.step(30)),
    expect: (b, c) => c.strikes === b.strikes + 1 && c.striking,
  },
  {
    name: 'strike ends, cloud relaxes',
    read: ({ read }) => read('static'),
    do: (a) => a.step(400),
    expect: (b, c) => b.striking && !c.striking && c.separation < 0.4,
  },
  {
    name: 'slider to 100 % strikes by itself',
    read: ({ read }) => read('static'),
    do: async (a) => (await a.slider('separation', 1.06), await a.step(20)),
    expect: (b, c) => c.strikes === b.strikes + 1,
  },
];

const capacitor = [
  {
    name: 'slider U: more charges on the plates, the callout carries Q',
    read: ({ read }) => read('capacitor'),
    do: async (a) => (await a.slider('capU', 0.5), await a.step(10)),
    expect: (b, c) =>
      c.voltageV > b.voltageV &&
      c.energyJ > b.energyJ &&
      c.plateCharges > b.plateCharges &&
      b.callout !== c.callout,
  },
  {
    name: 'slider A',
    read: ({ read }) => read('capacitor'),
    do: (a) => a.slider('capA', 0.9),
    expect: (b, c) => c.areaM2 > b.areaM2 && c.capacitanceF > b.capacitanceF && !b.wide && c.wide,
  },
  {
    name: 'slider d',
    read: ({ read }) => read('capacitor'),
    do: (a) => a.slider('capD', 0.6),
    expect: (b, c) => c.gapM > b.gapM && c.capacitanceF < b.capacitanceF,
  },
  {
    name: 'dielectric glass: C × 6',
    read: ({ read }) => read('capacitor'),
    do: async (a) => (await a.segment('dielectric', 'glass'), await a.step(80)),
    expect: (b, c) => Math.abs(c.capacitanceF / b.capacitanceF - 6 / 1.0006) < 0.01 && c.blockIn > 0.9,
  },
  {
    name: 'discharge through the lamp',
    read: ({ read }) => read('capacitor'),
    do: async (a) => (await a.button('discharge'), await a.step(6)),
    expect: (b, c) => c.flashes === b.flashes + 1 && c.lamp > 0.1 && c.phase === 'discharge',
  },
  {
    name: 'recharged after the flash',
    read: ({ read }) => read('capacitor'),
    do: (a) => a.step(240),
    expect: (_b, c) => c.phase === 'hold' && c.level > 0.9,
  },
  {
    name: 'dielectric ceramic',
    read: ({ value }) => value('dielectric'),
    do: (a) => a.segment('dielectric', 'ceramic'),
  },
  {
    name: 'dielectric PTFE',
    read: ({ value }) => value('dielectric'),
    do: (a) => a.segment('dielectric', 'ptfe'),
  },
  {
    name: 'dielectric air',
    read: ({ value }) => value('dielectric'),
    do: async (a) => (await a.segment('dielectric', 'air'), await a.step(60)),
  },
  {
    name: 'breakdown: thin air gap at high voltage → spark, U rebounds',
    read: async ({ read, value }) => ({ ...(await read('capacitor')), slider: await value('capU') }),
    do: async (a) => (await a.slider('capD', -0.06), await a.slider('capU', 1.06), await a.step(30)),
    expect: (b, c) => c.breakdowns > b.breakdowns && c.gapM === 1e-4 && c.slider === 270 && !c.breakdown,
  },
];

const bridge = [
  {
    name: 'close the switch (toggle)',
    read: ({ read }) => read('bridge'),
    do: async (a) => (await a.toggle('key'), await a.step(120)),
    expect: (b, c) => !b.closed && c.closed && c.voltageV < b.voltageV && c.lampOn && c.points > b.points,
  },
  {
    name: 'open the switch (lever in the scene)',
    read: ({ read }) => read('bridge'),
    do: (a) => a.tap('lever'),
    expect: (b, c) => b.closed && !c.closed && c.currentA === 0,
  },
  {
    name: 'recharge',
    read: ({ read }) => read('bridge'),
    do: (a) => a.button('recharge'),
    expect: (b, c) => b.voltageV < 2.7 && c.voltageV === 2.7 && c.modelTimeS === 0,
  },
  {
    name: 'discharge until the lamp goes out',
    read: ({ read }) => read('bridge'),
    do: async (a) => (await a.tap('lever'), await a.step(300, 1 / 30)),
    expect: (_b, c) => c.closed && !c.lampOn && c.moved > 1e19,
  },
  {
    name: 'look inside the wire: the set grows out of the wire to full size',
    read: ({ read }) => read('bridge'),
    do: async (a) => (await a.button('look'), await a.step(170)),
    expect: (b, c) => !b.looking && b.dive === 0 && c.looking && c.dive === 1 && c.scale === 1,
  },
  {
    name: 'back to the table: the set shrinks back into the wire',
    read: ({ read }) => read('bridge'),
    do: async (a) => (await a.button('lookBack'), await a.step(150)),
    expect: (b, c) => b.looking && !c.looking && c.dive === 0 && c.scale < 0.1,
  },
];

export const STEPS = [
  { id: 'charge', cases: charge },
  { id: 'coulomb', cases: coulomb },
  { id: 'field', cases: field },
  { id: 'potential', cases: potential },
  { id: 'conductor-in-field', cases: conductor },
  { id: 'static', cases: statics },
  { id: 'capacitor', cases: capacitor },
  { id: 'bridge-to-matter', cases: bridge },
];
