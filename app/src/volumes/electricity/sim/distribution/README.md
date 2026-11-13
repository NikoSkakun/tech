# sim/distribution — models of the `distribution` chapter

Import from `@electricity/sim/distribution`.

| Model | Step | API |
|---|---|---|
| Р1 10 kV topology (radial / ring / mesh) | 1 | `normalState(topology)`, `applyFault(st, sectionId)`, `localize`, `restore`, `canRestore`, `energisedTps`, `customersWithoutPower`, `STAGE_TIME_MIN` |
| Р2 recloser | 2 | `runRecloser('temporary' \| 'permanent', withRecloser)` → timeline events |
| KTP 400 kVA loading, oil temperature | 3 | `solveKtp(loadShare)` |
| Р3 0,4 kV line | 4, 8 | `solveLvLine({ sourceV, crossSectionMm2, houses })`, `LV_PRESETS`, `SIP_OHM_PER_KM` |
| Р4 broken neutral, voltage relay | 5 | `solveNeutralBreak([P1, P2, P3], broken)`, `createNeutralWatch(relayEnabled)` (`step(dt, voltages)`) |
| Р7 allowed power, meter LED | 6 | `solveEntrance('single' \| 'three', items)`, `allowedPowerW`, `meterFlashHz` |
| Р5 selectivity, Р6 harmonics, disturbances | 7 | `faultSelectivity(point)`, `thd`, `distortedVoltageV(h, ωt)`, `crestV`, `buildingCurrents(k)`, `envelope(kind, t)` |
| Р8 street day (PV, EV, Volt-Watt) | 8 | `solveStreet({ time, pv, ev, inverters, smartCharging })` |

```ts
import { solveStreet } from '@electricity/sim/distribution';
const r = solveStreet({ time: 'noon', inverters: 'voltWatt' });
r.voltagesV.forEach((u, k) => voltmeter[k].set(u)); // red outside 207…253 V
```

Note: the model table of Р8 puts EV chargers on houses 3 and 6 by default (the control points use that); the step's
interactive text says «typically house 6» — see `docs/audits/sim-S2-sim.md` D1.
