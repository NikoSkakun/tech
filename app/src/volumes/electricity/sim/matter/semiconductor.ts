/**
 * `matter` «Модель симуляції» §6 (step `silicon`) and §7 (step `doping`).
 * §6: pair generation rate g = g₀·n_i(T)/n_i(300), g₀ = 0,5 pairs/s, clamped 0,1…6; visual pair lifetime 6 s;
 *     intrinsic ρ = 1/(e·n_i·(μ_n + μ_p)), μ_n = 1400, μ_p = 450 cm²/(V·s) → ≈ 3,4×10³ Ω·m at 300 K.
 * §7: n-type n = N_D/2 + √((N_D/2)² + n_i²) (exact form, valid for all N_D), p = n_i²/n; p-type symmetric;
 *     Caughey–Thomas mobilities μ_n = 65 + 1265/(1 + (N/8,5×10¹⁶)^0,72), μ_p = 48 + 447/(1 + (N/6,3×10¹⁶)^0,76);
 *     ρ = 1/(e·(n·μ_n + p·μ_p)) (Ω·cm, ×0,01 → Ω·m). Si at 300 K: n_i = 10¹⁰ cm⁻³.
 */
import { ELEMENTARY_CHARGE_C } from '../core/S1-sim/constants';
import { clamp } from '../core/S1-sim/math';
import { intrinsicCarrierDensity } from './bands';

export const SILICON = {
  temperatureRange: { min: 200, max: 500, step: 10, default: 300 },
  pairRateAt300PerS: 0.5,
  pairRateRange: { min: 0.1, max: 6 },
  pairLifetimeS: 6,
  mobilityNCm2: 1400,
  mobilityPCm2: 450,
  /** Photons of the «Посвітити» button exceed E_g = 1,12 eV. */
  bandGapEv: 1.12,
  ni300PerCm3: 1e10,
} as const;

export function siliconIntrinsic(temperatureK: number): { niPerCm3: number; resistivityOhmM: number; pairRatePerS: number } {
  const ni = intrinsicCarrierDensity('Si', temperatureK).perCm3;
  const sigmaPerOhmCm = ELEMENTARY_CHARGE_C * ni * (SILICON.mobilityNCm2 + SILICON.mobilityPCm2);
  return {
    niPerCm3: ni,
    resistivityOhmM: sigmaPerOhmCm > 0 ? (1 / sigmaPerOhmCm) * 0.01 : Infinity,
    pairRatePerS: clamp((SILICON.pairRateAt300PerS * ni) / SILICON.ni300PerCm3, SILICON.pairRateRange.min, SILICON.pairRateRange.max),
  };
}

export const DOPING_RANGE_PER_CM3 = { min: 1e12, max: 1e19, default: 1e16 } as const;

export const electronMobilityCm2 = (n: number): number => 65 + 1265 / (1 + Math.pow(n / 8.5e16, 0.72));
export const holeMobilityCm2 = (n: number): number => 48 + 447 / (1 + Math.pow(n / 6.3e16, 0.76));

export interface DopedSilicon {
  type: 'n' | 'p';
  dopingPerCm3: number;
  electronsPerCm3: number;
  holesPerCm3: number;
  mobilityNCm2: number;
  mobilityPCm2: number;
  resistivityOhmCm: number;
  resistivityOhmM: number;
}

export function dopedSilicon(type: 'n' | 'p', dopingPerCm3: number, niPerCm3: number = SILICON.ni300PerCm3): DopedSilicon {
  const nd = clamp(dopingPerCm3, DOPING_RANGE_PER_CM3.min, DOPING_RANGE_PER_CM3.max);
  const majority = nd / 2 + Math.sqrt((nd / 2) ** 2 + niPerCm3 * niPerCm3);
  const minority = (niPerCm3 * niPerCm3) / majority;
  const n = type === 'n' ? majority : minority;
  const p = type === 'n' ? minority : majority;
  const mn = electronMobilityCm2(nd);
  const mp = holeMobilityCm2(nd);
  const rho = 1 / (ELEMENTARY_CHARGE_C * (n * mn + p * mp));
  return { type, dopingPerCm3: nd, electronsPerCm3: n, holesPerCm3: p, mobilityNCm2: mn, mobilityPCm2: mp, resistivityOhmCm: rho, resistivityOhmM: rho * 0.01 };
}
