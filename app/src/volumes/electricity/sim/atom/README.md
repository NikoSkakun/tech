# sim/atom — models for chapter `atom`

Import from `@electricity/sim/atom`. Pure TypeScript, no three.js; tests in `__tests__/`.

| Step | Model (doc §) | API |
|---|---|---|
| `dive-in` | scale wheel | `SCALE_STOPS_M`, `scaleAtWheel(pos)` |
| `nucleus` | §1 forces | `nucleonForces(rFm)` → `{coulombN, strongN, ratio, dominant, escapesOnRelease}`, `FORCE_CROSSOVER_FM` (≈ 4,45), `coulombForceN`, `strongForceN` |
| `quarks` | §5 string | `quarkPull(distFromCentreFm)`, `hadronCharge(PROTON_QUARKS)`, `protonMassBudget()` |
| `electron` | balance | `electronBalance(N, maxTiltRad)` |
| `models` | §2 orbitals | `sampleOrbital(id, count, seed)`, `createOrbitalCloud({orbital, targetCount, seed})`, `orbitalDensity`, `mostProbableRadiusA0`, `bohrRadiusA0(n)` |
| `shells` | configurations | `neutralConfiguration(z)`, `configurationText`, `shellCounts`, `valenceElectrons(z)`, `fillingSequence(z)`, `GROUP_11`, `ELEMENTS` |
| `ions-photons` | §3 photon gun | `createHydrogenAtom({rng})` → `fire(E)`, `step(dt)` → emitted photons; `photonOutcome`, `GROUND_RESONANCES_EV`, `wavelengthToRgb`, `photonBand` |
| `atom-builder` | §4 | `buildAtom({protons, neutrons, electrons})`, `BUILDER_PRESETS` |
| `standard-model` | §6 cards | `STANDARD_MODEL`, `cardMass(card)`, `participantsOf(interaction)` |

```ts
import { createHydrogenAtom } from '@electricity/sim/atom';

const atom = createHydrogenAtom({ rng: ctx.random }); // any { next(): number }
const result = atom.fire(12.09);                     // { kind: 'absorbed', from: 1, to: 3, … }
// in update(dt):
for (const photon of atom.step(dt)) spawnPhoton(photon.wavelengthNm, photon.band);
```

Lengths in orbitals are in units of a₀; energies in eV; half-lives as `{ value, unit: 'y'|'d'|'h'|'min'|'s', approx }`.
Ukrainian display text (names of particles, hotspot copy) comes from the content export, not from here — the only
Ukrainian strings here are element names that the document's model section defines as data.
