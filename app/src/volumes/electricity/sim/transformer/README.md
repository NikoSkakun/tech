# sim/transformer — models for chapter `transformer`

Import from `@electricity/sim/transformer`.

| Step | Model | API |
|---|---|---|
| `mutual-induction` | Т1 (frequency demo, DC) | `teachingTransformer({…, supply: 'dc'})`, `frequencyDemoEmfV(f, ℰ₅₀)` |
| `turns-ratio` | Т1 | `teachingTransformer({primaryTurns, secondaryTurns, loadOhm, loadConnected, supply})` → `{secondaryV, secondaryA, primaryA, inputW, outputW, saturated, overload, tripped, voltsPerTurn}` |
| `why-high-voltage` | Т2 | `transmission(P_MW, U_kV)` → `{currentA, lossW, lossFraction, dropFraction, impossible, stationW, wireTemperatureC}`, `TRANSMISSION.voltagesKV` |
| `anatomy` | Т3 | `createOilThermal(β)` → `setLoad(β)`, `step(dt)` → `{thermometerC, fansOn}`; `topOilTemperatureC(β, fans)` |
| `tap-changer` | Т4 | `createTapChanger()` → `step(dt, {hvKV, loadPu, auto})`, `manual(±1, …)`; `lowVoltageKV`, `autoTapSteadyState` |
| `losses-efficiency` | Т5 | `transformerEfficiency('old' \| 'modern', β)`, `optimumLoad(gen)`, `eddyLossWPerKg(d_mm)` |
| `three-phase-groups` | Т6 | `vectorGroup(hv, lv)` → `{label, clock, lvAngleCwDeg, unbalanceCoefficient}`, `unbalancedVoltages(hv, lv, a)`, `limbFluxes(t)` |
| `types` | CT, SMPS | `currentTransformer(I_bus, open)`, `smpsCoreVolume(f)` |

```ts
import { createTapChanger } from '@electricity/sim/transformer';
const oltc = createTapChanger();
// update(dt): const s = oltc.step(dt, { hvKV, loadPu, auto: true }); if (s.changed) playClick(); bus.text = s.lvKV;
```
