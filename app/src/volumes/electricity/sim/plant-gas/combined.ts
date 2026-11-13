/**
 * plant-gas M3 (step 6) — combined cycle on top of M1:
 *   T_stack = 180 / 120 / 90 °C for 1 / 2 / 3 pressure levels; ε = max(0, (T4 − T_stack)/(T4 − T0)), T0 = 288,15 K;
 *   η_ST = min(0,40; 0,55·(1 − 303,15/T4)) (55 % of Carnot between the exhaust and a 30 °C condenser);
 *   η_CC = η_GT + (1 − η_GT)·ε·η_ST; P_GT = 571 MW; P_fuel = P_GT/η_GT; P_ST = P_fuel·(1 − η_GT)·ε·η_ST;
 *   supplementary firing F (0…100 MW_th): P_ST += 0,30·F, P_fuel += F; HRSG off → P_ST = 0, η = η_GT.
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';
import { gasTurbine } from './gasTurbine';

export const STACK_TEMP_K: Readonly<Record<1 | 2 | 3, number>> = { 1: 453.15, 2: 393.15, 3: 363.15 };
export const GT_POWER_MW = 571;
export const T0_K = 288.15;

export interface CombinedParams {
  pressureRatio: number;
  titC: number;
  levels: 1 | 2 | 3;
  hrsg: boolean;
  /** Supplementary firing [MW_th], 0…100. */
  firingMW: number;
}

export interface CombinedResult {
  etaGt: number;
  heatRecovery: number;
  etaSt: number;
  eta: number;
  gtMW: number;
  stMW: number;
  totalMW: number;
  fuelMW: number;
  exhaustC: number;
}

export function combinedCycle(p: CombinedParams): CombinedResult {
  const gt = gasTurbine(p.pressureRatio, p.titC);
  const t4 = gt.t4C + 273.15;
  const eps = Math.max(0, (t4 - STACK_TEMP_K[p.levels]) / (t4 - T0_K));
  const etaSt = Math.min(0.4, 0.55 * (1 - 303.15 / t4));
  const f = clamp(p.firingMW, 0, 100);
  if (!p.hrsg || gt.eta <= 0) {
    const fuel = gt.eta > 0 ? GT_POWER_MW / gt.eta : Infinity;
    return { etaGt: gt.eta, heatRecovery: eps, etaSt, eta: gt.eta, gtMW: GT_POWER_MW, stMW: 0, totalMW: GT_POWER_MW, fuelMW: fuel, exhaustC: gt.t4C };
  }
  const fuelGt = GT_POWER_MW / gt.eta;
  const st = fuelGt * (1 - gt.eta) * eps * etaSt + 0.3 * f;
  const fuel = fuelGt + f;
  return {
    etaGt: gt.eta,
    heatRecovery: eps,
    etaSt,
    eta: (GT_POWER_MW + st) / fuel,
    gtMW: GT_POWER_MW,
    stMW: st,
    totalMW: GT_POWER_MW + st,
    fuelMW: fuel,
    exhaustC: gt.t4C,
  };
}
