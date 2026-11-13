# sim/plant-future — «Водень, генератори, накопичувачі, термояд і екзотика»

Models of `docs/volumes/electricity/chapters/plant-future.md` M1–M6. M4 runs on the shared power-system frequency model of S2-sim
(DECISIONS §9–10): `bess.ts` runs `simulateFrequency(islandWithBessFcrScenario(H, bessMW), …)` from
`@electricity/sim/core/S2-sim/frequency`.

| Step               | API                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2 `fuel-cell`      | `cellPoint(i, PEMFC / SOFC)` → `{ voltageV, powerWcm2, efficiency, activationV, ohmicV, concentrationV }`, `maxPowerPoint`, `stack(nCells, i)`         |
| 3 `electrolysis`   | `hydrogenLoop(uEl, uFc, compression)` → `{ electrolyserKwhPerKg, roundTrip, sankey }`                                                                  |
| 4 `gensets`        | `gensetOperatingPoint(GENSETS.diesel10, pKw)`, `startCheck(g, runningKw, 'pump')`, `loadStepResponse(g, ΔP, t)`, `GENSET_APPLIANCES`, `ATS_TRANSFER_S` |
| 5 `bess`           | `bessSizing(powerMw, hours)`                                                                                                                           |
| 6 `bess-services`  | `bessFrequencyRun(H, bessMw)` → `{ samples (f, P_FCR, P_BESS, P_shed), nadirHz, nadirTimeS, shedMw, rocofHzPerS }`; `arbitrageProfit(noon, evening)`   |
| 7 `fusion-physics` | `fusionBalance(n, T, τ_E)` → `{ pFusWm3, q, ignition, tripleProduct }`, `sigmaV(T)`                                                                    |
| 8 `tokamak`        | `magneticPressureMpa(B)`                                                                                                                               |
| 9 `inertial`       | `nifYieldMj(W_L)`, `NIF_SHOTS`, `engineeringGain(yield, W_L, η_laser)`                                                                                 |
| 10 `exotic`        | `voyagerRtgW(year)`, `piezoWh(steps)`                                                                                                                  |

```ts
import { bessFrequencyRun } from '@electricity/sim/plant-future';

const r = bessFrequencyRun(4, 500); // nadir 49.13 Hz at 8.2 s, no UFLS (0 MW shed)
```
