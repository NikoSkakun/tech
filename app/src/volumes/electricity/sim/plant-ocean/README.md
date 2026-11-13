# sim/plant-ocean — «Енергія океану: припливи, течії і хвилі»

Models of `docs/volumes/electricity/chapters/plant-ocean.md` M1–M6 (reviewed barrage: filling while the sea is higher through gates
and idling turbines, throttled flow at the power cap). Units: m, s, m/s, W, MWh, kW/m.

| Step              | API                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2 `tides`         | `relativeRange(moonSunAngleDeg)`, `seaLevelM(t, H, springNeap)`, `TIDE_SCALE`                                                                                                                                                                    |
| 3 `barrage`       | `simulateBarrage({ rangeM, mode: 'ebb' / 'two-way', hStartM })` → per cycle/day, P_max, hours, basin range, `series`; live: `createBarrage({ …, mode: 'manual' })` → `command('gates' / 'turbines' / 'closed')`, `step(dt)`; `springNeapAverage` |
| 4 `tidal-stream`  | `streamPowerW(v)`, `streamSpeed(t)`, `streamCapacityFactor()`, `diameterForPower`, `equivalentWindMs`                                                                                                                                            |
| 5 `waves`         | `wavePowerWPerM(Hs, Te)`, `wavelengthM(T)`, `gerstnerComponents(Hs, Te)`, `SEA_PRESETS`                                                                                                                                                          |
| 6 `wave-devices`  | `pointAbsorber(Tn, Te)` → `{ pNorm, amplification, screenAmplification, inResonance }`                                                                                                                                                           |
| 7 `survival`      | `createStorm(survival)` → `step(dt)`, `setSurvival`, `repair`; `foulingFactor(years)` (illustrative)                                                                                                                                             |
| 8 `otec-salinity` | `otec(Ts, Td)`, `PRO_MEMBRANE_W_M2`                                                                                                                                                                                                              |

```ts
import { simulateBarrage } from '@electricity/sim/plant-ocean';

simulateBarrage({ rangeM: 8, mode: 'two-way' }).genHoursPerDay; // 16.9 h (ebb-only: 10.2 h), ≈ the same energy
```
