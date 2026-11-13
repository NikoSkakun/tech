# sim/lab-inverter — «Інвертори: як постійний струм стає змінним»

Pure TypeScript models for `docs/volumes/electricity/chapters/lab-inverter.md` §M1–§M7. Waveforms / FFT / THD / LC filter / dead time /
efficiency / phasors live in `sim/core/S3-sim/inverter.ts` and are re-exported. Units: V, A, W, Hz, s, H, F.

| Step                       | API                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 `switches`               | `tapLosses(u, i)`, `switchLosses(u, i, fSw)`                                                                                                  |
| 3 `h-bridge`               | `createHBridge({ mode, keys, protection, deadTimeS, load })` → `state.{uLoadV, iLoadA, conducting, fault, blocked, inDeadTime}`               |
| 4 `pwm`                    | `analyseWave({ kind, udcV, ma, fcHz, alphaDeg })` → `{ samples, u1RmsV, uRmsV, thd, thd50 }`, `harmonicBars(spectrum, 1000)`                  |
| 5 `lc-filter`              | `filterWave(wave, L, C, loadResistanceOhm(P))`, `lcGainDb(f, L, C, R)`, `filterWarning(L, C, fc)`, `inverseSpectrum(...)` for the scope       |
| 6 `dc-link`                | `boostDuty(uIn)`, `efficiency(P, LI6_LOSSES.pvToAc / batToAc)`, `euroEfficiency`, `peakEfficiency`                                            |
| 7 `mppt-controller`        | `createMpptController({ gWm2, tcC, auto, clipping })`, `eastWestMismatch()`, `clippedPoint()`                                                 |
| 8 `grid-tie`               | `createGridTie()` → `enablePll()`, `setPhaseErrorDeg()`, `closeRelay()`, `setGrid(false)`; `dispatchPQ(P, Q)`, `phasorFromPU`, `pllLockTimeS` |
| 10 `ups`                   | `holdUpTimeS(P)`, `pcSurvives(tTr, P)`, `UPS_TRANSFER_S`, `upsSagResponse(kind)`                                                              |
| 11 `three-phase-and-scale` | `vfdPump(f)`, `analyseWave({ kind: 'ladder', levels, ma: 1, udcV })`                                                                          |
| 12 `choosing`              | `createLoadTester()` → `add(id)`, `start(key)`, `remove(key)`, `step(dt)`; `TESTER_APPLIANCES`, `IDLE_KWH_PER_DAY`                            |

```ts
import { analyseWave, filterWave, loadResistanceOhm } from '@electricity/sim/lab-inverter';

const w = analyseWave({ kind: 'spwm_uni', udcV: 400, ma: 0.8125, fcHz: 20000 }); // THD 75.4 %, THD₅₀ 0.32 %
const f = filterWave(w, 1.5e-3, 10e-6, loadResistanceOhm(2000)); // f₀ 1299 Hz, U₁ 229.9 V, THD 0.41 %
```

`analyseWave` uses 65 536 samples per period (≈ 5 ms per call on lenovo); pass `n: 4096` for a cheap live preview.
