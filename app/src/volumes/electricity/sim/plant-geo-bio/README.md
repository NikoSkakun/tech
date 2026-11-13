# sim/plant-geo-bio — «Геотермальні станції, біомаса, біогаз і сміттєспалювання (WtE)»

Models of `docs/volumes/electricity/chapters/plant-geo-bio.md` M1–M6b. Units: °C, km, kg/s, MW, MJ/kg, t/day, m³/day, years.

| Step                | API                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 2 `earth-heat`      | `reservoirTemperatureC(REGIONS.Kyiv, depthKm)`, `plantTypeFor(T, region)`                                                   |
| 3 `geo-plant-types` | `geothermalPower(T, massFlow, 'binary' / 'flash' / 'dry-steam')` → `{ qThMw, eta, pElMw, steamFraction, mismatch }`         |
| 4 `geo-field`       | `fieldPressure(years, reinjection 0 / 0.9)`, `breakthrough(distanceKm, years)`                                              |
| 5 `egs`             | `createEgs(rng, pressure)` → `setPressure(p)`, `step(dt)` → fired events with magnitude and traffic light                   |
| 6 `biomass-fuel`    | `lhvWet(w)`, `biomassLogistics(10, 0.28, w)`                                                                                |
| 7 `biomass-chp`     | `BIOMASS_SANKEY`, `heatDemandShare(T_out)` (P_el follows it in CHP mode)                                                    |
| 8 `biogas`          | `biogasPlant({ feed: { cattleManure, maizeSilage, foodWaste }, tempC, culture, hrtDays })`, `digesterActivity`, `hrtFactor` |
| 9 `biogas-chp`      | `flexibleEngineFactor(hour)`, `gasHolderLevel()`, `biogasPlant(...).biomethaneM3PerDay`                                     |
| 10 `wte`            | `wasteToEnergy({ organic, paper, plastic, inert }, tPerDay, chp)`                                                           |
| 11 `carbon`         | `carbonDebt(t, CARBON_TAU_Y.residues, beccs)`, `carbonPaybackYears`, `biogasCo2ePerKwh(leak)`, `LIFECYCLE_G_PER_KWH`        |

```ts
import { biogasPlant, createEgs } from '@electricity/sim/plant-geo-bio';
import { mulberry32 } from '@electricity/sim/plant-wind';

biogasPlant({ feed: { cattleManure: 100, maizeSilage: 30 }, tempC: 38, hrtDays: 40 }).pElAvgMw; // ≈ 0.70 MW
const egs = createEgs(mulberry32(42), 0.4); // pass the chapter's seeded RNG (ctx.random.next.bind(ctx.random))
```
