# sim/plant-gas — models of the `plant-gas` chapter

Import from `@electricity/sim/plant-gas`. All functions are pure.

| Model | Step | API |
|---|---|---|
| «1 m³ газу» | 2 | `electricityFromCubicMetreKWh(eta)` |
| M1 gas turbine (Brayton with losses), presets | 3, 4 | `gasTurbine(r, titC)` → η, t₂, t₄, w_net, compressor share, flags; `airFlowKgS(MW, result)`, `GT_PRESETS` |
| M2 blade metal temperature (illustrative) | 5 | `bladeMetalTempC(tbc, film, internal, titC)`, `bladeState` |
| M3 combined cycle | 6 | `combinedCycle({ pressureRatio, titC, levels, hrsg, firingMW })` |
| M4 start race | 7 | `lanePowerPct(lane, tMin, ccgtStart)`, `finishMin`, `ccgtStartFromStandstillH(h)` |
| M5 gas-engine CHP, district map | 8 | `engineChp(heatUse)`, `districtOutageShare(layout, outages)` |
| M6 CO₂, methane leaks, hydrogen | 9 | `directCo2GPerKWh`, `leakGPerKWh`, `totalGPerKWh(eta, L, horizon)`, `leakParityWithCoal`, `hydrogenEnergyShare(x)` |

```ts
import { combinedCycle } from '@electricity/sim/plant-gas';
const cc = combinedCycle({ pressureRatio: 20, titC: 1600, levels: 3, hrsg: true, firingMW: 0 });
etaCounter.set(cc.eta); powerCounter.set(cc.totalMW); // ≈ 62 %, ≈ 811 MW
```
