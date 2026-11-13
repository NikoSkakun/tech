# sim/plant-wind — «Вітрова електростанція (ВЕС)»

Models of `docs/volumes/electricity/chapters/plant-wind.md` M1–M6 (reviewed: Gaussian wake cross profile, shear reference 8.5 m/s at
200 m). Power curve, Weibull energy and shear live in `sim/core/S3-sim/wind.ts`. Units: m/s, m, W, °C, rpm.

| Step                | API                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2 `wind-power`      | `windPowerW(v, D, airDensity(T))`, `sweptArea(D)`, `ROTOR_SILHOUETTES`                                                                           |
| 3 `betz`            | `actuatorDisk(a)` → `{ cp, ct, vRotorRel, vWakeRel, d1Rel, d2Rel, atBetz }`                                                                      |
| 4 `blade`           | `airfoil(alphaDeg)` → `{ cl, cd, liftToDrag, stalled }`; `bladeSection(rOverR)` → `{ phiDeg, twistDeg }`                                         |
| 5 `nacelle`         | `DRIVETRAIN_EFFICIENCY`                                                                                                                          |
| 6 `drivetrain`      | `drivetrain('A_DFIG' / 'B_DIRECT' / 'C_MEDIUM', v)` (illustrative constants, see audit)                                                          |
| 7 `power-curve`     | `turbinePowerW(TURBINE_6MW, v, stormControl)`, `rotorRpm`, `pitchDeg`; `createTurbineSim()` → `gust()`, `storm()`, `step(dt)`                    |
| 8 `wind-farm`       | `simulateFarm({ windFromDeg, rowSpacingD, steering, vMs })` → `{ turbines[], efficiency }`; `wakeDeficit` for drawing                            |
| 9 `capacity-factor` | `annualEnergy(TURBINE_6MW, vMean)` → `{ capacityFactor, aepWh }`; `shearMeanSpeed(h, TERRAIN_ALPHA.forest)`; `syntheticYear(vMean)`, `histogram` |
| 10 `offshore`       | `TURBINE_15MW` with the same functions                                                                                                           |

```ts
import { simulateFarm, annualEnergy, TURBINE_6MW } from '@electricity/sim/plant-wind';

simulateFarm({ rowSpacingD: 7, steering: true }).efficiency; // 0.756 (0.726 without steering)
annualEnergy(TURBINE_6MW, 7).capacityFactor; // 0.357
```
