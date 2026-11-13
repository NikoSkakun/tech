# sim/magnetism — models for chapter `magnetism`

Import from `@electricity/sim/magnetism`. Table plane: x east, y north (m); fields in T.

| Step | Model | API |
|---|---|---|
| `magnet-field` (+ compass carpets) | М1 | `barMagnet(x, y, angle)`, `magnetField(magnets, x, y)`, `compassAngleRad(b)`, `createCompass()`, `traceMagnetLines(magnets)`, `magnetForce(a, b)`, `cutMagnet`, `flipMagnet`, `MAGNETS.snapDistanceM` |
| `domains` | М2 | `createDomains(seed)` → `update(h, T_C)` → `{magnetization, angles, aligned, jitter, aboveCurie}` |
| `oersted` | М3 | `wireFieldXY(I, x, y)`, `compassAngleFromNorth(I, x, y)`, `oerstedProbe(I, r)` |
| `solenoid` | М3 | `solenoid(N, I, core, reversed)` → `{fieldT, airFieldT, clips}` |
| `lorentz` | beam/swing | `electronBeam(U_a, B, particle)`, `ampereSwingAngle(I, flipped)` |
| `dc-motor` | М4 | `createDcMotor({voltageV, loadTorqueNm, mode, jammed})` → `step(dt)`; `motorSteadyState(U, τ)`, `startingTorqueNm(U)` |
| `induction` | М5 | `createInduction({turns, grade})` → `drag(z, dt)`, `startAutoDrop()`, `step(dt)`; `peakEmf`, `coilFlux` |
| `lenz` | М6 | `tubeFall(tube, t)`, `tubeTransitTime(tube)`, `terminalVelocity`, `lenzRingDeflectionDeg(v, slotted)` |
| `inductance` | М7 | `createRlCircuit({s1On, s2Closed, ironCore, breakTimeS})` → `step(dt)`, `set(...)` (S2 opening triggers the spark/neon) |
| `maxwell` | — | `emWave(f)` → `{wavelengthM, band}`, `poyntingCircuit(U, R)` |
| `to-generator` | М8 | `createRotatingCoil({drive: 'hand', handRpm})` (shared core model) |

```ts
import { createDcMotor } from '@electricity/sim/magnetism';
const motor = createDcMotor({ voltageV: 6, loadTorqueNm: 0.005 });
// update(dt): motor.step(dt); rotor.rotation = motor.state.angleRad; ammeter = motor.state.currentA
```
