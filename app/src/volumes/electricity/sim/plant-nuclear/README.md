# sim/plant-nuclear — models of the `plant-nuclear` chapter

Import from `@electricity/sim/plant-nuclear`.

| Model | Step | API |
|---|---|---|
| M1 fission «slingshot», energy split | 2 | `shoot(energy, rand)`, `FISSION_PROBABILITY`, `FISSION_ENERGY_MEV`, `FISSION_TOTAL_MEV` |
| M2 k_eff sandbox | 3 | `kEff(enrichmentPct, moderator, rodsInserted, size)`, `generations(k, g)`, `neutronGenerations(k, g, seed)` |
| Delayed neutrons on/off | 4 | `promptOnlyPower(pcm, t)`, `promptGrowthPerSecond(pcm)`, `delayedStepResponse(pcm, t)` |
| M4 subcooling margin, pressurizer | 7 | `subcoolingMarginC(pMPa)`, `createPressurizer()` → `setMode('heaters' \| 'spray')`, `step(dt)` |
| M3 operator console (point kinetics + heat) | 8, 9 | `createReactor()` → `set({ rodTarget, load })`, `scram()`, `loseCooling()`, `startDiesels()`, `accumulators()`, `restore()`, `step(dt)`; state: `n`, `thermalMW`, `electricMW`, `tempC`, `reactivity`, `scramReason`, `alarm` |
| M5 decay heat | 9 | `decayHeatFraction(τ)` |
| M6 enrichment | 11 | `feedPerProduct(xP, xT)`, `tailsPerProduct` |

```ts
import { createReactor } from '@electricity/sim/plant-nuclear';
const reactor = createReactor();
reactor.set({ rodTarget: lever.value, load: knob.value });
reactor.step(dt * timeScale);          // ×1 / ×10 / ×60; fixed 10 ms internal step
if (reactor.state.scram) siren.play(reactor.state.scramReason);
```
