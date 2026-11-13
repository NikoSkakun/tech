# sim/charge-field — models for chapter `charge-field`

Import from `@electricity/sim/charge-field`. SI units (table coordinates x, z in metres; charges of the sandbox in nC).

| Step | Model (doc §) | API |
|---|---|---|
| `charge` | transfer | `chargeTransfer(n)` → left/right charge, total = 0 |
| `coulomb` | §2 | `coulombPair(q1NC, q2NC, rM)` → `{forceN, kind, arrowLengthL0}`, `gravityComparison()` |
| `field` | §3 | `FIELD_PRESETS`, `traceFieldLines(charges)`, `probeField(charges, x, z)`, `fieldGrid(charges)`, `clampToTable`; release: `createMovingCharge({...RELEASE_DEFAULTS, charges: toPointCharges(c)}, start)` |
| `potential` | §4 | `landscapeHeight(charges, x, z, sign)`, `landscapePotential`, `probePotential`, `voltmeter(a, b, step)`, ball: `createMovingCharge({...BALL_DEFAULTS, …})`, `POTENTIAL_PRESETS` |
| `conductor-in-field` | (text) | `sphereInUniformField(E0, R, p)`, `inducedSurfaceDensity`, `inducedHemisphereCharge`, `inducedShiftFraction` |
| `static` | §5 | `createBalloon()` → `rub()`, `dragTo(x)`, `fingerAt(d)`; `stormState(s)`, `lightningTimeline(rng)` |
| `capacitor` | §6 | `parallelPlateCapacitor({voltageV, areaM2, gapM, dielectric})`, `DIELECTRICS` |
| `bridge-to-matter` | §7 | `createDischarge()` → `setClosed`, `step(dtScene)`, `recharge()` |

```ts
import { traceFieldLines, FIELD_PRESETS, probeField } from '@electricity/sim/charge-field';

const lines = traceFieldLines(FIELD_PRESETS.dipole);      // Streamline[] (points in m, y = 0)
const { magnitudeVPerM } = probeField(FIELD_PRESETS.dipole, 0, 0); // 4,49×10⁴ V/m
```

Recompute lines at ≤ 30 Hz while dragging (≈ 50 lines × 400 RK4 steps is a few ms; a worker is optional).
