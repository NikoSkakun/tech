# sim/lab-hybrid-home — «Гібридний будинок: світло, що не боїться відключень»

Deterministic 24 h energy-flow model of `docs/volumes/electricity/chapters/lab-hybrid-home.md` §M1–§M7 (dt = 5 min, 288 steps, 3 days,
day 3 reported). The model lives in `sim/core/S3-sim/home/` and is re-exported here. It reproduces every fixture of
`tools/ref-models/C6-labs/home_model.py --check` (CP1–CP12 × 18 columns, 6 SOC traces, 9 challenges, load sums,
zero-capacity battery). Units: kW, kWh, %, UAH. A full 3-day run takes ≈ 1 ms.

| Step                  | API                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 3, 4               | `simulateHome(params).trace[stepIndexAtHour(h)]` → flows at an hour (sun, pulses, SOC ring)                                                                       |
| 5 `blackout`          | `createHomeLive(params, { startMin, socPct })` → `setGrid(false)`, `step(dtMin)`; `transferVerdicts(ms)`, `createIslandScene({ invKw, batKwh })`, `autonomyHours` |
| 6 `grid-return`       | `setGrid(true)` on the live stepper; `rechargeHours(batKwh, soc, 100, pChKw)`                                                                                     |
| 7 `generator`         | params `genKw`, `genStartPct`, `genStopPct`; `live.startGenerator()`                                                                                              |
| 8 `simulator`         | `simulateHome(params)` → `{ totals: { pv, imp, exp, curt, cost, darkH, selfSufficiency, … }, trace }`                                                             |
| 9 `sizing`            | `batterySize`, `inverterSize`, `pvSize`, `loadTableSummary`                                                                                                       |
| 12 `microgrid-finale` | `microgridPeak(share, smart)`                                                                                                                                     |

```ts
import { simulateHome } from '@electricity/sim/lab-hybrid-home';

const { totals, trace } = simulateHome({
  season: 'winter',
  weather: 'overcast',
  outage: 'two_queues',
  mode: 'backup',
});
// totals.imp 6.43 kWh, totals.cost 23.28 UAH, totals.socMin 79.03 % (CP1); trace[k] = flows of 5-min step k
```

Params (`HomeParams`, defaults = §M4): `kwp`, `batKwh` (0 = no battery), `invKw`, `season`, `weather`, `outage`
(preset or `outageFromHours(bool[24])`), `mode` (`backup` / `self_use` / `tou`), `enabled` (appliance ids),
`wholeHomeBackup`, `exportAllowed`, `reservePct`, `gridChargeKw`, `genKw`, `genStartPct`, `genStopPct`, `multiDay`.
