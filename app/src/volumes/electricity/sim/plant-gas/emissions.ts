/**
 * plant-gas M6 (step 9) — emissions of gas power.
 *   direct = 56,1·3,6/η g/kWh (EF 56,1 kg CO₂/GJ);
 *   leaks = (3,6/η)/50·L/(1 − L)·GWP·1000 g CO₂-eq/kWh (50 MJ/kg methane, L = leaked share of produced gas;
 *           GWP₁₀₀ = 29,8, GWP₂₀ = 82,5);
 *   total = direct + 40 (upstream without leaks, estimate) + leaks;
 *   hydrogen blend by volume x: energy share e = x·10,8/(x·10,8 + (1 − x)·35,8) (LHV MJ/Nm³) = CO₂ reduction.
 * Coal reference: 820 g CO₂-eq/kWh (IPCC 2014 life-cycle median).
 */
import { bisect, clamp } from '@electricity/sim/core/S2-sim/math';

export const GWP = { gwp100: 29.8, gwp20: 82.5 } as const;
export type GwpHorizon = keyof typeof GWP;
export const UPSTREAM_G_KWH = 40;
export const COAL_LIFECYCLE_G_KWH = 820;

export function directCo2GPerKWh(eta: number): number {
  return (56.1 * 3.6) / eta;
}

export function leakGPerKWh(eta: number, leakShare: number, horizon: GwpHorizon): number {
  const L = clamp(leakShare, 0, 0.99);
  return ((3.6 / eta) / 50) * (L / (1 - L)) * GWP[horizon] * 1000;
}

export function totalGPerKWh(eta: number, leakShare: number, horizon: GwpHorizon): number {
  return directCo2GPerKWh(eta) + UPSTREAM_G_KWH + leakGPerKWh(eta, leakShare, horizon);
}

/** Leak share at which gas equals coal (820 g/kWh) for η and horizon (null if never below 99 %). */
export function leakParityWithCoal(eta: number, horizon: GwpHorizon): number | null {
  if (totalGPerKWh(eta, 0, horizon) >= COAL_LIFECYCLE_G_KWH) return 0;
  const L = bisect((x) => totalGPerKWh(eta, x, horizon), COAL_LIFECYCLE_G_KWH, 0, 0.5, 60);
  return L >= 0.5 ? null : L;
}

/** Energy share of hydrogen in a blend with volume share x (= CO₂ reduction). */
export function hydrogenEnergyShare(volumeShare: number): number {
  const x = clamp(volumeShare, 0, 1);
  return (x * 10.8) / (x * 10.8 + (1 - x) * 35.8);
}

/** Badge: ≤ 50 % «available on H₂-ready GT», above — «in development». */
export function hydrogenBadge(volumeShare: number): 'available' | 'development' {
  return volumeShare <= 0.5 ? 'available' : 'development';
}
