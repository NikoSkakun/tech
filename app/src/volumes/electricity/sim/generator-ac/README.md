# sim/generator-ac — models for chapter `generator-ac`

Import from `@electricity/sim/generator-ac`.

| Step | Model | API |
|---|---|---|
| `rotating-loop` | Г1 | `rotatingLoop(n, B, N)` → `{emfMaxV, frequencyHz, scopeWindowS, visualSlowdown}`; time domain / hand crank: `createRotatingCoil` |
| `ac-anatomy` | — | `acWave(U_rms, 50 \| 60, t)`, `ledLit(f, t)` |
| `war-of-currents` | Г2 | `warOfCurrents(d_km)` → `{dc, ac}` each `{lineOhm, currentA, lampV, lossW, lossFraction, brightness}` |
| `three-phase` | Г3, Г3b | `neutralCurrent(I1, I2, I3)`, `threePhaseInstant(t, I)`, `instantaneousPower('single' \| 'three', U, I, t)`, `floatingNeutral(I)`, `phasePhasors()` |
| `star-delta` | Г3 | `lineVoltage(U_ph)`, `motorConnection('star' \| 'delta', U_L)` |
| `rotating-field` | Г4 | `inductionMotorPoint(load%, p)` → `{slip, speedRpm, zone, stalled}`, `rotatingFieldAngle(t, f, p, dir)`, `INDUCTION_MOTOR.startRampS` |
| `synchronous-generator` | — | `generatorSpeedRpm(p)`, `openCircuitEmfKV(i_f)` |
| `synchronization` | Г5 | `createSynchroscope(rng, {speedRpm, excitation})` → `step`, `set`, `close()`; `createSwing({mechanicalSetpointPu, emfPu})` → `step(dt)` (RK4, 1 ms, ramp 0,2 p.u./s), `equilibriumAngleDeg`, `maxPowerPu` |
| `rlc` | Г6 | `rlcCircuit({frequencyHz, resistanceOhm, inductanceH, capacitanceF, mode})`, `rlcCurrentCurve(p)` |
| `ac-power` | Г7 | `powerCompensation(cosφ, C)`, `bargeAnalogy(φ°)` |

```ts
import { createSwing } from '@electricity/sim/generator-ac';
const rotor = createSwing({ mechanicalSetpointPu: 0.5, emfPu: 2.2 });
rotor.set({ mechanicalSetpointPu: 1.0 });
// update(dt): rotor.step(dt); pole.rotation = rotor.state.deltaDeg; if (rotor.state.outOfStep) trip();
```

The step-11 teaser («Витки другої котушки» 1…20×) is a plain multiplication of the amplitude and has no model.
