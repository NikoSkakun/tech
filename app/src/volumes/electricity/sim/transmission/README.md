# sim/transmission — models of the `transmission` chapter

Import from `@electricity/sim/transmission`. All functions are pure (no time-domain state).

| Model | Step | API |
|---|---|---|
| Unit currents I = P/(√3·U·cos φ) | 1 | `plantExitCurrents(powerMW)` → `{ generatorKA, lineA }` |
| Tower / voltage-class table, natural power | 2 | `VOLTAGE_CLASSES`, `naturalPowerMW(kV, zcOhm)` |
| ЛЕП-2 sag and heating | 4 | `solveSag({ currentA, airTempC, wind, overgrown })` → θ, D, margin, violation, colour stop |
| ЛЕП-1 lossless line, Ferranti, collapse | 5 | `solveLosslessLine({ lengthKm, loadPu, reactor })`, `voltageProfile(…)`, `coronaLevel(bundled, rain)` |
| ЛЕП-3 cable charging current | 6 | `chargingCurrent(lengthKm, 'cable' \| 'overhead', dc?, reactorsBothEnds?)` |
| ЛЕП-4 AC vs DC (illustrative) | 7 | `compareAcDc(distanceKm, 'overhead' \| 'cable')`, `desyncState(on)` |
| Switching with interlocking | 8 | `operate(state, apparatus, interlocking)`, `IN_SERVICE`, `isInRepair` |
| ЛЕП-5 protection and auto-reclose | 9 | `runAutoReclose(scenario, pauseS, arrester)`, `lineCurrentKA(result, t)` |

```ts
import { solveLosslessLine, voltageProfile } from '@electricity/sim/transmission';
const r = solveLosslessLine({ lengthKm: 400, loadPu: 0.2, reactor: false });
if (r.collapse) showChip('Колапс напруги!'); else gauge.set(r.receivingKV!);
const curve = voltageProfile({ lengthKm: 400, loadPu: 0.2, reactor: false }, 64);
```
