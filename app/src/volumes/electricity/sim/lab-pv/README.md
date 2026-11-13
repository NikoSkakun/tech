# sim/lab-pv — «Сонячні панелі: від фотона до масиву»

Pure TypeScript models for `docs/volumes/electricity/chapters/lab-pv.md` §M1–§M5. The I-V model, MPPT and sun geometry live in
`sim/core/S3-sim/` and are re-exported here. Units: V, A, W, W/m², °C; azimuth from south, + west.

| Step               | API                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 `sunlight`       | `atmosphere(elevationDeg)` → `{ airMass, dniWm2, beamHorizontalWm2, pathLength }`                                                                           |
| 2 `pv-effect`      | `photon(wavelengthNm)` → `{ energyEv, absorbed, usefulFraction, heatEv }`, `cutoffWavelengthNm()`                                                           |
| 4 `module`         | `cellAssembly(nSeries, nParallel)`                                                                                                                          |
| 5 `iv-curve`       | `new PvString(uniformString(1000, 25)).operatingPointR(rOhm)`; `.analyse()` for the curve                                                                   |
| 6 `light-and-heat` | `analyseString(uniformString(g, cellTemperatureC(ta, g)))`, `LIGHT_HEAT_PRESETS`                                                                            |
| 7 `shading`        | `shadeFromShapes(shapes)` → `sectionIrradianceFromShade(g, shade)` → `analyseString({ modules, tcC, bypass })`; `hotSpots(str, iA)`; `optimiserPowerW(cfg)` |
| 8 `orientation`    | `orientationYield(tilt, azimuth)`, `sunArc('june21', tilt, azimuth)`, `KYIV_MONTHLY_60`, `CITY_YIELDS`, `snowBehaviour`                                     |
| 9 `array`          | `checkString({ nSeries, nParallel, tMinC, tMaxC, orientations })`                                                                                           |
| 10 `mppt`          | `createMpptSim({ deltaVV, frequencyHz })` → `step(dt)`, `startCloud()`, `globalScan()`, `state.etaLast10s`                                                  |
| 11 `lifecycle`     | `relativePower(years, tech)`, `cumulativeEnergyKwh(years, tech)`                                                                                            |

```ts
import { PvString, sectionIrradianceFromShade, hotSpots } from '@electricity/sim/lab-pv';

const g = sectionIrradianceFromShade(1000, shadePerHalfCell); // e.g. [1000, 1000, 500]
const str = new PvString({ modules: [g], tcC: 25, bypass: true });
const a = str.analyse(300); // a.points (I-V), a.mpp (287.9 W @ 21.66 V), a.localMaxima (flags)
const spots = hotSpots(str, a.mpp.iA); // one 'orange' spot: section 2 is bypassed at −0.4 V
```
