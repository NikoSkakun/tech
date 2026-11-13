/**
 * home §Д (step 9) — switch-mode charger (SMPS).
 * Д.1 U_DC = 230·√2 = 325,3 V at no load (≈ 280 V ripple minimum at full load, illustrative).
 * Д.2 transformer size (law owned by `transformer/types`): V(f) = max(V_min, V₅₀·(50/f)^0,75), V_min/V₅₀ = 3/250;
 *     N = round(V₅₀/V(f)) = round(min(83,3; (f/50)^0,75)); linear scale s = (V/V₅₀)^(1/3).
 * Д.3 USB-PD 65 W profiles 5 V 3 A, 9 V 3 A, 15 V 3 A, 20 V 3,25 A; phone 9 V × 2,22 A, tablet 15 V × 2 A, laptop 20 V × 3,25 A.
 * Д.4 η(x = P_out/65 W) linear through (0,05; 0,75) (0,2; 0,88) (0,5; 0,93) (1,0; 0,93); P_in = P_out/η; no load 0,05 W.
 * Д.5 input current without PFC: I_in = P_in/(230·0,5).
 */
import { interp1 } from '@electricity/sim/core/S2-sim/math';

export const DC_BUS_V = 230 * Math.SQRT2;
export const DC_BUS_MIN_FULL_LOAD_V = 280;
export const SMPS_RATED_W = 65;
export const NO_LOAD_W = 0.05;

export function transformerVolumeRatio(fHz: number): number {
  return Math.max(3 / 250, (50 / Math.max(50, fHz)) ** 0.75);
}

export function transformerSize(fHz: number): { timesSmaller: number; linearScale: number } {
  const v = transformerVolumeRatio(fHz);
  return { timesSmaller: Math.round(1 / v), linearScale: v ** (1 / 3) };
}

export const PD_PROFILES = [
  { voltageV: 5, currentA: 3 },
  { voltageV: 9, currentA: 3 },
  { voltageV: 15, currentA: 3 },
  { voltageV: 20, currentA: 3.25 },
] as const;

export type ChargeDevice = 'phone' | 'tablet' | 'laptop' | 'off';
export const PD_REQUEST: Readonly<Record<Exclude<ChargeDevice, 'off'>, { voltageV: number; currentA: number }>> = {
  phone: { voltageV: 9, currentA: 2.22 },
  tablet: { voltageV: 15, currentA: 2 },
  laptop: { voltageV: 20, currentA: 3.25 },
};

export function smpsEfficiency(outW: number): number {
  return interp1([0.05, 0.2, 0.5, 1.0], [0.75, 0.88, 0.93, 0.93], outW / SMPS_RATED_W);
}

export interface SmpsResult {
  outW: number;
  inW: number;
  efficiency: number | null;
  heatW: number;
  inputCurrentA: number;
}

export function smpsOperatingPoint(device: ChargeDevice): SmpsResult {
  if (device === 'off') return { outW: 0, inW: NO_LOAD_W, efficiency: null, heatW: NO_LOAD_W, inputCurrentA: NO_LOAD_W / 115 };
  const r = PD_REQUEST[device];
  const out = r.voltageV * r.currentA;
  const eta = smpsEfficiency(out);
  const pin = out / eta;
  return { outW: out, inW: pin, efficiency: eta, heatW: pin - out, inputCurrentA: pin / (230 * 0.5) };
}
