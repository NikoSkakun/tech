# sim/current — models for chapter `current`

Import from `@electricity/sim/current`. DC circuits use the shared MNA solver (`@electricity/sim/core/S1-sim/mna`).

| Step | Model (doc §) | API |
|---|---|---|
| `current` | counter | `electronsPerSecond(I)`, `CURRENT_STEP` |
| `drift` | §2 | `drift(I, A_mm2)` → `{driftMPerS, electronTimeS, signalTimeS, slowdown}`, `snailDistanceM`, `durationParts` |
| `source-emf` | §3 | `sourceEmfLamp(ℰ)` → `{currentA, powerW, brightness, labSupply}` |
| `ohm` | §4 | `ohmBench(U_set, {kind:'wire', material, lengthM, areaMm2} \| {kind:'lamp'})` → `{resistanceOhm, voltageV, currentA, powerW, constantCurrent, glow}`, `filamentResistanceOhm(U)` |
| `circuit` | §5 | `createShortCircuit({switchClosed, jumper:'none'\|'lamp'\|'battery', fuseInstalled})` → `step(dt)`, `set`, `replaceFuse()`; state has fuse/battery heating/warning |
| `power` | §6 | `appliancePower(ids, hours)`, `kettleBoil()`, `kettleTemperatureC(t)`, `KETTLE.sceneSpeedup` |
| `series-parallel` | §7 | `solveBuilder(parts)` → `{parts (burnt/tripped updated), solution}`; `BUILDER_PRESETS`, `gridNode(c, r)`, `builderVoltmeter`, `kvlWalk`, `repairLamps`, `resetSources` |
| `losses` | §8 | `lineLosses(U, A_mm2, L_oneWay)` |
| `measure` | §9 | `readMeter({battery, switchClosed, mode, red, black, milliFuseBlown})` → `{display, blowsFuse, batteryCurrentA, shortCircuit}`; `internalResistanceFromMeasurements` |
| `dc-ac` | §10 | `sourceVoltage(mode, t)`, `lampFlicker(mode, t)`, `oerstedDeflectionRad(I)`, `createOerstedCompass()` |

```ts
import { solveBuilder, BUILDER_PRESETS } from '@electricity/sim/current';

let parts = [...BUILDER_PRESETS.mixed];
const { parts: next, solution } = solveBuilder(parts); // keep `next` (lamps may have burnt)
parts = next;
solution.parts.get('R1')?.voltageV; // 6 V
if (solution.newlyTripped.length) showAlarm(); // «Коротке замикання!»
```

The multimeter caller keeps `milliFuseBlown` and sets it to true when a reading returns `blowsFuse`.
