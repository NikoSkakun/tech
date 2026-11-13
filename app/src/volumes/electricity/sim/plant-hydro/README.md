# sim/plant-hydro — models of the `plant-hydro` chapter

Import from `@electricity/sim/plant-hydro`.

| Model | Step | API |
|---|---|---|
| M1 power, homes | 2, 7 | `hydroPowerMW(eta, Q, H)`, `homesForPowerMW`, `energyPerCubicMetreKWh(H)` |
| Dam water force | 3 | `damForcePerMetreN(depthM)` |
| M2 wicket gate (Francis station), M3 water hammer | 4 | `gateOperatingPoint(gate)`, `surgePressureMPa(closureS, tank)`, `gaugePressureMPa(closureS, tank, t)`, `surgeTankLevelM(t)`, `surgeColour` |
| M2 efficiency curves, M4 turbine choice | 5 | `turbineEfficiency(type, x)`, `peltonNozzles(x)`, `chooseTurbine(H, Q)`, `TURBINE_ZONES`, `jetVelocityMs(H)` |
| M5 governor response, rpm, black start | 6 | `stepResponse(g0, g1, t)`, `createHydroTurbine()` (`command(target, rampS)`, `step(dt)`), `generatorRpm(p)`, `blackStartScenario(t)` |
| M6 reservoir balance, storm | 7 | `createReservoir()` → `set({ inflowM3s, auto, gate })`, `startStorm()`, `step(dt·3600)`, `state` |
| M7 PSH day | 8 | `simulatePshDay(plan)`, `AUTO_PLAN`, `PSH_PRICES`, `fullCycle()`, `storedEnergyMWh(V)` |

```ts
import { createReservoir } from '@electricity/sim/plant-hydro';
const res = createReservoir();
res.set({ inflowM3s: slider.value, auto: autoToggle.on, gate: gateSlider.value });
res.step(dt * 3600);                  // «1 s = 1 h»
water.position.y = res.state.levelM;  // amber > 2 m, red > 4 m (res.state.status)
```
