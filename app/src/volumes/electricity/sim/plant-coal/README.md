# sim/plant-coal — models of the `plant-coal` chapter

Import from `@electricity/sim/plant-coal`. All functions are pure.

| Model | Step | API |
|---|---|---|
| M1 fuel: t/h, wagons, CO₂ | 2, 5, 8, 9 | `fuelUse(coal, netMW, eta)`, `COALS`, `co2PerTonneKg`, `co2PerMWhHeatKg` |
| Grinding fineness → unburnt loss | 3 | `unburntLossPct(finenessPct)` |
| M2 unit efficiency, class, saturation limit, presets | 5, 6, 7 | `unitEfficiency({ pressureMPa, tempC, reheat, regeneration, coolingWaterC, aged, doubleReheat })`, `steamClass`, `clampLiveSteamTempC`, `UNIT_PRESETS` |
| M3 flue-gas cleaning | 8 | `flueGasCleaning({ coal, sulphurPct, netMW, eta, scr, esp, fgd })` |
| M4 CCS | 9 | `ccs(coal, netMW, eta, enabled)` |
| M5 CHP, M6 morning ramp | 10 | `chpOperatingPoint(heatMW)`, `actualPct(t)`, `targetPct(t)`, `shortfallMWh(t)` |

```ts
import { unitEfficiency, fuelUse, steamClass } from '@electricity/sim/plant-coal';
const eta = unitEfficiency({ pressureMPa: p, tempC: t });
badge.set(steamClass(p, t)); etaCounter.set(eta);
gramsCounter.set(fuelUse('bituminous', 1000, eta).co2GPerKWh);
```
