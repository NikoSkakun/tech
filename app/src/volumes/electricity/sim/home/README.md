# sim/home — models of the `home` chapter

Import from `@electricity/sim/home`. The house data (circuits, appliances, tariff) are the shared `@electricity/sim/core/S2-sim/house`.

| Model | Step | API |
|---|---|---|
| §А MCB B/C/D (thermal θ + magnetic) | 3, 4, 8 | `createMcb(16, 'C')` → `step(dt, currentA)`, `state.{theta, bend, closed, tripReason, timeToTripS}`, `close()`; `mcbTripTime(I, In, curve)`; `shortCircuitCurrentA(In)`, `COMPRESSOR` |
| §Б cable heating | 4 | `cableSteady(cable, installation, breakerA, currentA, badJoint)`, `createCableCircuit(…)` (`step(dt, loadA)`), `insulationState(θ)` |
| §В fault, body current, RCD, IEC 60479 zones | 5, 6 | `shockScenario({ peConnected, person, rcdA, backgroundA })`, `rcdTest`, `shockZone(I, t)` (zone chart: `curveIbA`, `curveIc1A`) |
| Travel (P = U²/R) | 7 | `resistivePowerRatio(ratedV, socketV)` |
| §Г house, breakers, bill | 8 | `createHousePanel()` → `switchOn(id)`, `step(dt·10)`, `currents()`, `breaker(id)`, `reclose(id)`; `groupCurrents`, `monthlyBill(hours, tariff)`, `useCost` |
| §Д SMPS | 9 | `smpsOperatingPoint(device)`, `transformerSize(fHz)`, `PD_PROFILES`, `PD_REQUEST` |
| §Е lighting | 10 | `lightingCost(type, count, hoursPerDay, tariff)` |
| §Ж final flight | 11 | `energyChain(source)`, `linkCurrentA(U, threePhase)`, `FINALE_LINKS`, `oscillationAmplitudeM(I)`, `driftVelocityRmsMps(I)`, `signalDelayS()` |
| §З backup autonomy | 12 | `autonomy(source, loads)` → hours, overload and its reason |

```ts
import { createMcb } from '@electricity/sim/home';
const mcb = createMcb(16, 'C');
// in update(dt): model time runs ×10 in the UI
mcb.step(dt * 10, sliderMultiple * 16);
bimetal.rotation.z = mcb.state.bend * maxBend;
if (!mcb.state.closed) playTrip(mcb.state.tripReason);
```
