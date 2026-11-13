# sim/plant-solar — «Сонячні електростанції: PV-ферми і CSP»

Models of `docs/volumes/electricity/chapters/plant-solar.md` M1–M7 (local solar time, G_sc 1353 W/m², Kyiv 50.45° N unless stated).
Sun geometry comes from `sim/core/S3-sim/sun.ts`. Units: W/m², kW/kWp, kWh/kWp, GW, MW, °C.

| Step                   | API                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 `sunlight`           | `skyIrradiance(lat, dayOfYear, hour, 'clear' / 'partly' / 'overcast')` → `{ elevationDeg, dniWm2, dhiWm2, ghiWm2 }`; `airMassKastenYoung` from core |
| 3 `dc-array`           | `utilityString(n)`                                                                                                                                  |
| 4 `inverter-station`   | `clippingShare({ mount: 'fixed', dayOfYear, ambientC }, dcAc)`; `dayEnergy(...).profile` for the chart                                              |
| 5 `substation-control` | `createParkController()` → `setPoint(0.6)`, `setQ(q)`, `voltageDip()`, `step(dt)`                                                                   |
| 6 `trackers`           | `planeOfArray(sky, lat, { mount: 'tracker', rows: 'backtracking', bifacial, albedo })`, `dayEnergy`, `trackerGainPct`, `FIELD_MWP`                  |
| 7 `capacity-factor`    | `cityYield('Kyiv', summerC, washed)` → monthly bars, Y, CF                                                                                          |
| 8 `duck-curve`         | `duckCurve({ pvGw, bessGw, demandResponse })` → `{ netGw, netShapedGw, minGw, maxRamp3hGw, surplusGwh }`                                            |
| 9 `csp-types`          | `concentratorOptimum(C, RECEIVER_EMISSIVITY.selective)`, `concentratorEfficiency(T, C, ε)` for the η(T) chart                                       |
| 10 `csp-tower`         | `simulateCsp({ storageH, pSetMw, afternoonClouds })` → `{ dailyMwh, series[] (P_el, Q_rec, level), saltT }`                                         |

```ts
import { duckCurve, simulateCsp } from '@electricity/sim/plant-solar';

duckCurve({ pvGw: 20 }).maxRamp3hGw; // 11.6 GW
simulateCsp({ storageH: 12 }).dailyMwh; // 2400 MWh (100 MW all day)
```
