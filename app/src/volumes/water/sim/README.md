# `water/sim` — the molecular model of the volume «Вода»

Pure TypeScript, no three.js, no platform imports. Unit tests: `__tests__/water.test.ts` (`pnpm vitest run src/volumes/water`).

| File | What |
|---|---|
| `md.ts` | `WaterMd` — the solver: rigid H₂O molecules in a thin slab (see below). No imports: runs under plain Node |
| `lattice.ts` | initial states: `iceSheet` (one basal layer of ice Ih, hydrogens placed by the ice rules), `scatter`, `orient` |
| `scale.ts` | model temperature ↔ °C (`toCelsius`, `fromCelsius`); heat of a real gram of water (`heated`, `heatTo`, `HEAT`) |
| `process.ts` | `Process` — a road the reader scrubs: live forward, kept frames backward, alive at rest |
| `setups.ts` | the volume's samples and roads: `iceSample`, `liquidSample`, `meltProcess`, `boilProcess`, box sizes |
| `snowflake.ts` | Reiter's cellular model of a snow crystal growing from vapour; five «weathers» |
| `fixtures/liquid.json` | 252 molecules of water at +20 °C: the end of the melting road (positions, quaternions) |

## The model in one paragraph

Each molecule is a rigid body with a position and a quaternion. It carries four unit «arms» in the true geometry:
two hydrogens 104.5° apart and two lone pairs on the other side (tetrahedral). A pair of molecules feels (1) a
Lennard-Jones core between the oxygens (ε = 0.35, σ = 0.84) and (2) a hydrogen bond for every hydrogen arm of one
that points at a lone-pair arm of the other: −exp(−(r − 1)²/2w_r²) · A(c₁) · A(c₂), A(c) = exp(−(1 − c)/w_a²), with
r the O···O distance and c the cosines between each arm and the line of the oxygens (w_r = 0.11, w_a = 0.36 rad).
Molecules live in a slab (free for |z| < 0.2), between two walls and a floor, under an optional lid (fixed, open or
a piston), with an optional pull to the floor. Heat comes from a Berendsen bath (whole sample, the layer near the
floor, or two halves) or a constant power. Velocity Verlet, dt = 0.006; ≈ 0.08 ms per step for 252 molecules.

Units: length 0.276 nm (O···O in ice), energy one hydrogen bond (≈ 23 kJ/mol), mass one molecule, k_B = 1;
time unit ≈ 0.25 ps. The chapters show ≈ 5 time units per second (13 while a road is walked forward).

## What emerges, and what is put in by hand

Emerges (nothing scripted): the open hexagonal sheet with proton disorder; its collapse into a denser liquid
(area per molecule 1.15 → ≈ 1.05); bonds breaking and re-forming; melting from the edges; cavities over a hot
plate, clusters and single molecules leaving; cooling when the fastest molecules escape; heat levelling between a
hot and a cold half.

Put in by hand — stated simplifications, each also told to the reader in «Докладніше» of the step that shows it:

1. **One layer.** A flat honeycomb cannot give two hydrogens to every molecule; a basal slice of real ice can —
   the fourth arm of each molecule points out of the layer. So orientations are 3D, positions nearly 2D.
2. **°C by a map** (`scale.ts`): a sample of 252 molecules loses its order gradually between T = 0.092 and 0.115;
   that whole range stands for 0 °C. Below it the scale is absolute (no motion = −273.15 °C); above it linear with
   100 °C at T = 0.168. The model's boiling point is set by this map, not predicted.
3. **The thermometer of the roads is a real gram of water** (`heated`): exact plateaus at 0 °C and 100 °C with the
   real heats (334 and 2 260 J/g). The sample is driven through its own melting range while that thermometer
   stands; a few hundred molecules cannot hold a temperature to a degree (their own reading wanders by ± 10 °C).
4. **Freezing is the melting replayed backward** (`Process`): the model, like real water, supercools and
   crystallises far too slowly to wait for. Forward, every frame is the live solver.
5. **Boiling is steered:** the plate under the sample is held hotter by as much as the sample lags behind the
   share of steam the real gram has at that heat (`boilProcess`).
6. Classical rigid molecules: no vibration inside a molecule, no quantum zero-point motion; one moment of inertia
   for all axes (equilibrium structure does not depend on it); the pull to the floor is far stronger than gravity
   at this size (it only keeps the water on the bottom of the box).

## For a chapter builder

```ts
import { meltProcess } from '@water/sim/setups';
const road = meltProcess();                       // ice at −20 °C … water at +20 °C
// every frame: `want` = the slider (0 … 1); the second argument = simulated time this frame may spend
const shown = road.update(want, Math.min(13 * dt, 40 * road.md.dt));
molecules.sync(road, dt);                         // @water/shared/molecules — draws pos / quat / bonds
```

A live sample without a road: `const md = iceSample(-20)`; each frame `md.heating = { mode: 'bath', temperature:
fromCelsius(c), tau: 0.7 }; md.step(n); molecules.sync(md, dt)`. `md.temperature` is the sample's own kinetic
temperature; `toCelsius` turns it into degrees. Retuning a parameter: re-run the tests (ice must hold at −20 °C,
the melted sample must be lower than the ice) and regenerate `fixtures/liquid.json` (the end state of
`meltProcess()` — positions to 3 decimals, quaternions to 4).
