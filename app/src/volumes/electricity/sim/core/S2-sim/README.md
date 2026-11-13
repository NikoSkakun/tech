# sim/core/S2-sim — shared simulation core (grid, protection, thermal)

Pure TypeScript, no three.js / DOM / timers. Import with `@electricity/sim/core/S2-sim/<file>`.

| File | What | Main API |
|---|---|---|
| `frequency.ts` | THE frequency model (DECISIONS §9): swing equation, FCR, aFRR, mFRR, LFSM-O, UFLS, BESS (FCR law of `plant-future` M4, FFR law of `grid` §А.6) | `createFrequencyModel(params)`, `simulateFrequency`, scenarios `islandScenario`, `continentScenario`, `ukraineInCeScenario`, `futureGridScenario`, `islandWithBessFcrScenario`, `bessFcrLaw`, `bessFfrLaw` |
| `quasiSteadyFrequency.ts` | settled Δf after the reserve pool, UFLS (grid §Б.4, §Е) | `solveQuasiSteady(imbalanceMW, params)` |
| `profiles.ts` | daily load, PV and wind profiles (grid §Б.1–Б.2) | `gridLoadMW`, `pvOutputMW`, `windOutputMW` |
| `meritOrder.ts` | uniform-price clearing | `clearMarket(offers, demandMW)` |
| `dcPowerFlow.ts` | DC power flow, islands, cascade, N-1 | `solveDcPowerFlow`, `runCascade`, `contingencyAnalysis` |
| `voltageDrop.ts` | short-line drop, 3-phase current, radial LV feeder with neutral | `shortLineReceivingKV`, `threePhaseCurrentA`, `solveRadialFeeder` |
| `thermal.ts` | exact first-order body, I² rise, transformer top oil | `firstOrderStep`, `createFirstOrderBody`, `steadyTempC`, `transformerTopOilC` |
| `protection.ts` | MCB B/C/D (thermal + magnetic), gG fuse, selectivity, RCD | `createMcb`, `mcbTripTime`, `fuseTripTimeS`, `selectivity`, `rcdTrips` |
| `shock.ts` | IEC 60479-1 zones (schematic) | `shockZone`, `curveIbA`, `curveIc1A`, `timeToFibrillationZoneS` |
| `house.ts` | the one house (`_shared-house.md`) | `APPLIANCES`, `CIRCUITS`, `MAIN_BREAKER`, `TARIFF_UAH_PER_KWH` |
| `math.ts` | helpers (clamp, interp1, bisect, solveLinear, FixedStepper, seeded RNG); AC phasors come from `@electricity/sim/core/S1-sim` | |

`plant-future` (S3-sim) usage of the frequency model:

```ts
import { createFrequencyModel, islandWithBessFcrScenario } from '@electricity/sim/core/S2-sim/frequency';
const m = createFrequencyModel(islandWithBessFcrScenario(H, bessMW)); // H 2…6 s, BESS 0…1000 MW
m.addEvent(1000);                // «Вимкнути блок 1000 MW»
m.step(dt);                      // fixed 5 ms internal Euler step, any frame dt
m.state.fHz; m.state.pBessMW; m.state.nadirHz; m.state.pShedMW;
```
