# sim/matter — models for chapter `matter`

Import from `@electricity/sim/matter`.

| Step | Model (doc §) | API |
|---|---|---|
| `electron-sea` | §2 Drude gas | `createElectronGas({fieldVPerM, temperatureC}, rng)` → `positions` (nm, periodic box 7,2 nm), `step(dtScene)`, `scatteredLastStep`; `driftVelocity(E, T)` → `{driftMPerS, ratioToFermi, oneIn}` |
| `bands` | §3 | `bandTower(material, N)`, `ATOM_COUNTS`, `intrinsicCarrierDensity(material, T_K)`, `hopRatePerS(n_i)`, `conductivityRelativeToSi300` |
| `insulators` | §4 | `breakdownState(material, U_kV)` → `{fieldKVPerMm, ratio, zone, avalanches, avalancheRatePerS, breakdown}`, `avalancheChainLength(rng)` |
| `resistance` | §5 | `resistivityOhmM(metal, T_C, impurityPct)`, `resistanceVisuals`, `mercuryResistivityOhmM(T_K)` |
| `silicon` | §6 | `siliconIntrinsic(T_K)` → `{niPerCm3, resistivityOhmM, pairRatePerS}`, `SILICON.pairLifetimeS` |
| `doping` | §7 | `dopedSilicon('n' \| 'p', N)` → carriers, mobilities, ρ |
| `pn-junction` | §8 | `diodeCircuit(U_s, flipped)` → `{diodeV, currentA, depletionWidthUm, barrierV, lampBrightness}`, `diodeIvCurve()` |
| `devices` | §9 | `rectifierSample(t, 'ac' \| 'dc')`, `ledEmission(E_g)`, `solarCellActivity(G)`, `mosfetSwitch(U_GS)` |

```ts
import { diodeCircuit } from '@electricity/sim/matter';
const c = diodeCircuit(1); // { diodeV: 0,554, currentA: 2,03e-3, … }
```
