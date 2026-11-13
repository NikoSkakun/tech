# sim/lab-battery — «Li-Ion акумулятори: енергія в кишені й у підвалі»

Pure TypeScript models for `docs/volumes/electricity/chapters/lab-battery.md` §M1–§M8. Cell (OCV, R₀ + 1RC, temperature), CC/CV, pack
builder and ageing live in `sim/core/S3-sim/battery.ts` and are re-exported. Units: V, A, Ah, Wh, kWh, °C, s.
Fixed-step explicit Euler (dt = 1 s cells, 0.5 s thermal) as the document prescribes — curves are computed once
and revealed progressively by the scene («прискорений час»).

| Step                  | API                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 `what-is-battery`   | `galvanicPair('Zn', 'Cu')` → `{ emfV, cathode, anode, reactsWithWater }`                                                                          |
| 3 `intercalation`     | `socRatePctPerS(cRate)`, `platingRisk(tC, cRate)`                                                                                                 |
| 4 `why-lithium`       | `cellMassKg(kWh, 'leadAcid' / 'lfp' / 'nmc')`                                                                                                     |
| 6 `voltage-capacity`  | `discharge(CELLS['21700-NMC'], cRate, tC)` → `{ ah, wh, minutes, meanVoltageV, heatJ, curve, overCurrent }`                                       |
| 7 `charging`          | `chargeCcCv(cell, cRate, { uMaxV, tC })` → `{ ccMinutes, minutesTo80, totalMinutes, curve, plating, overcharge }`                                 |
| 8 `pack`              | `buildPack(CELLS['LFP-100'], 16, 2)` → `{ uNomV, energyKwh, …, li6: { verdict: 'ok' / 'partial' / 'fail' } }`                                     |
| 9 `bms`               | `createBms({ socPct, capacitiesAh, balancing, link })` → `start('charge')`, `step(dt)`, `state.stop/stopCell`; `usableCapacityAh`, `balanceTimeH` |
| 10 `degradation`      | `stateOfHealth({ chem, years, fecPerYear: fecPerYearFromCycles(n, dod), dodPct, tempC, socAvgPct })`, `yearsToSoh`, `AGEING_MODEL_FLOOR`          |
| 11 `safety`           | `runOven(chem, ovenC)`, `runOvercharge(chem, bms)`, `nailScenarioC(chem, soc, t)`, `runModule(chem, barrier)`; `ThermalCell` for live stepping    |
| 12 `scale-and-future` | `runtimeHours(kWh, dod, kW)`, `packCostUsd(kWh, year, stationary)`, `PACK_PRICE_USD_PER_KWH`                                                      |

```ts
import { CELLS, discharge, runOven } from '@electricity/sim/lab-battery';

const d = discharge(CELLS['LFP-100'], 0.5, -10); // 78.68 Ah, 243.78 Wh; d.curve → V(Ah) chart
const oven = runOven('NMC', 200); // events { sei: 139, separator: 272, vent: 313, cathode: 410, runaway: 410 }
```

## M3 helpers (additive; fixtures unchanged)

- `CellSample.wh` / `.heatJ` — running energy (Wh) and overpotential heat (J) on every `discharge` / `chargeCcCv` sample.
- `createBms(...).setCellSoc(i, pct)` — one cell's SOC; `reset()` still returns to `params.socPct`.
- `createLiveModule(chem, { barrier, nCells, ambientC })` — `runModule` stepped live (`step(dt)`, `ignite(j)`,
  `setBarrier`, `tempsC`); stepping it by `tMaxS` reproduces `runModule`.
- `runOvercharge(chem, true).cutoffS` = `BMS_OVERCHARGE_CUTOFF_S[chem]` (240 model s, illustrative scenario value).
- `nailScenarioC(...).vent` — valve open: at `ventC` on the runaway path, at `NAIL_SMOKE_VENT_C` (90 °C) otherwise;
  stays open once opened.
