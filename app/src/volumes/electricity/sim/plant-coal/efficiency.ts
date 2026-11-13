/**
 * plant-coal M2 (steps 5, 6, 7) — empirical net efficiency of typical real units (NOT a cycle calculation):
 *   η = η_T(t) + Δη_p(p) − 0,03·!reheat − 0,06·!regeneration − 0,001·(t_cw − 15) − 0,04·aged + 0,039·doubleReheat,
 *   clamped to [0,15; 0,50]; both tables piecewise linear.
 * Slider limit below the critical pressure: t ≥ t_sat(p) (linear in ln p). Class: p < 22,064 subcritical; else
 * t < 593 supercritical, 593 ≤ t < 700 USC, t ≥ 700 A-USC.
 */
import { clamp, interp1 } from '@electricity/sim/core/S2-sim/math';

const T_NODES = [300, 400, 540, 566, 600, 700, 720];
const ETA_T = [0.28, 0.32, 0.39, 0.41, 0.445, 0.475, 0.48];
const P_NODES = [1, 5, 10, 17, 24, 30, 35];
const D_ETA_P = [-0.1, -0.06, -0.035, -0.02, 0, 0.008, 0.012];
const SAT_P = [1, 2, 5, 10, 15, 17, 20, 22.064];
const SAT_T = [179.9, 212.4, 263.9, 311.0, 342.2, 352.3, 365.7, 373.95];
export const CRITICAL_PRESSURE_MPA = 22.064;

export interface UnitParams {
  pressureMPa: number;
  tempC: number;
  reheat: boolean;
  regeneration: boolean;
  coolingWaterC: number;
  aged: boolean;
  doubleReheat: boolean;
}

export const UNIT_DEFAULTS: UnitParams = {
  pressureMPa: 17,
  tempC: 540,
  reheat: true,
  regeneration: true,
  coolingWaterC: 15,
  aged: false,
  doubleReheat: false,
};

export function etaTemperature(tempC: number): number {
  return interp1(T_NODES, ETA_T, tempC);
}

export function etaPressureCorrection(pressureMPa: number): number {
  return interp1(P_NODES, D_ETA_P, pressureMPa);
}

export function unitEfficiency(input: Partial<UnitParams> = {}): number {
  const p = { ...UNIT_DEFAULTS, ...input };
  const eta =
    etaTemperature(p.tempC) +
    etaPressureCorrection(p.pressureMPa) -
    (p.reheat ? 0 : 0.03) -
    (p.regeneration ? 0 : 0.06) -
    0.001 * (p.coolingWaterC - 15) -
    (p.aged ? 0.04 : 0) +
    (p.doubleReheat ? 0.039 : 0);
  return clamp(eta, 0.15, 0.5);
}

/** Saturation temperature [°C] (interpolated in ln p); above the critical pressure: no limit (−∞). */
export function saturationTempC(pressureMPa: number): number {
  if (pressureMPa >= CRITICAL_PRESSURE_MPA) return -Infinity;
  return interp1(SAT_P.map(Math.log), SAT_T, Math.log(Math.max(1, pressureMPa)));
}

/** The temperature slider is pulled up to t_sat(p) below the critical pressure. */
export function clampLiveSteamTempC(pressureMPa: number, tempC: number): number {
  return Math.max(tempC, saturationTempC(pressureMPa));
}

export type SteamClass = 'subcritical' | 'supercritical' | 'usc' | 'ausc';

export function steamClass(pressureMPa: number, tempC: number): SteamClass {
  if (pressureMPa < CRITICAL_PRESSURE_MPA) return 'subcritical';
  if (tempC < 593) return 'supercritical';
  if (tempC < 700) return 'usc';
  return 'ausc';
}

/** Preset buttons of step 5. */
export const UNIT_PRESETS: Readonly<Record<'old200' | 'ua300' | 'usc1000' | 'pingshan', Partial<UnitParams>>> = {
  old200: { pressureMPa: 12.8, tempC: 540, aged: true },
  ua300: { pressureMPa: 23.5, tempC: 540, aged: true },
  usc1000: { pressureMPa: 27, tempC: 600 },
  pingshan: { pressureMPa: 32, tempC: 600, doubleReheat: true },
};
