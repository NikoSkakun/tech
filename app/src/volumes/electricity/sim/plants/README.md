# sim/plants — models of the `plants` hub

Import from `@electricity/sim/plants`.

| Model | Step | API |
|---|---|---|
| M4 Sankey (flow graph per plant type) | 3 | `SANKEY[type]` (`{ from, to, value, loss }[]`), `sankeySummary(type)` |
| M1 Carnot + real band, markers | 4 | `carnotEfficiency(hotC, coldC)`, `realBand(…)`, `PLANT_MARKERS`, `markerRatio` |
| M2 Rankine (IAPWS-IF97 constants) | 5 | `rankine(superheat, reheat, condenser)` → η, moisture, turbine/pump work, warning; `RANKINE_IAPWS` |
| M3 ideal Brayton | 6 | `braytonIdealEfficiency(r)` |
| M5 energy, CF, day tiles | 8 | `annualEnergyTWh(P, CF)`, `homesSupplied(TWh)`, `dayTiles('nuclear' \| 'wind' \| 'solar', cf)` |
| M6 power race | 9 | `createPowerRace()` → `demandJump()`, `blackout()`, `step(dtMin)`, `lane(id)`; `nominalFinishMin(id)` |
| Comparison table | 11 | `COMPARE_ROWS`, `sortRows(rows, key, desc)` |

The Rankine constants come from `tools/rankine_iapws.py` (run with `/srv/electricity/venv/bin/python`); the
document's hand-computed values differ by up to 1,1 pp (see `docs/audits/sim-S2-sim.md` P1).

```ts
import { rankine } from '@electricity/sim/plants';
const r = rankine(superheatToggle, reheatToggle, condenserToggle);
etaCounter.set(r.shownEta); moistureCounter.set(r.moisture, r.moistureWarning ? 'amber' : 'normal');
```
