# sim/grid — models of the `grid` chapter

Import everything from `@electricity/sim/grid`. All models are pure TS; time-domain ones are `create…() → { state, step(dt), set, reset }`.

| Model (grid.md) | API |
|---|---|
| §А frequency balance (steps 2, 3, 4, 10, 14) | `createFrequencyModel(islandScenario({ inertiaH, fcr, afrr, ufls, lfsmO }))`, `continentScenario()`, `ukraineInCeScenario()`, `futureGridScenario(x, bessMW)`; `model.addEvent(+1000)`, `model.activateMfrr()`, `model.step(dt)`; `simulateFrequency(params, events, durationS)` for charts/shadows; `balanceTiltDeg`, `step2ShouldPause`, `initialRocofHzPerS`, `kineticEnergyMWs` |
| §А.5 black start (step 12) | `newBlackStartGame()`, `playBlock(game, blockMW)`, `synchroniseThermal(game)`, `connectBlock(stage, loadMW, blockMW)` |
| step 12 synchroscope | `createSynchroscope()` → `set({ islandFHz, islandUPu })`, `step(dt)`, `close()` → `{ ok, failures }` |
| §Б day dispatcher (step 6) | `createDispatcher({ mode: 'normal' \| 'hard', season, pvInstalledMW… }, auto)` → `setControls`, `suggestion()` (cyan hints), `stepOnce()`, `runToEnd()`, `report()` |
| §В line voltage (step 7) | `solveLineVoltage({ pMW, qLoadMvar, capacitor, reactor, statcom })` |
| §Г auction (steps 5, 9) | `runAuction({ demandMW, windy, sunny })` |
| §Д N-1 and cascade (steps 8, 11) | `n1Flows(s, outages)`, `checkN1(s)`, `tripAndCascade(s, lineId, rescue)` |
| §Е deficit evening (step 13) | `deficitMinute(deficitMW, strategy, minute)`, `runDeficitEvening(deficitMW, strategy)` |

```ts
import { createFrequencyModel, islandScenario } from '@electricity/sim/grid';
const m = createFrequencyModel(islandScenario({ inertiaH: 4 }));
m.addEvent(1000);                // «Аварія: −1000 MW»
m.step(dt);                      // in update(dt): any dt, fixed 5 ms internal step
m.state.fHz; m.state.nadirHz; m.state.pShedMW; m.state.blackout;
```

Deviations from the document (auto-dispatcher rules, rounding of Q_C/2, the N-1 boundary at 60 %) are listed in
`docs/audits/sim-S2-sim.md`.
