/**
 * plant-nuclear M4 (step 7) — subcooling margin: margin = T_sat(p) − 320 °C (hot leg); T_sat linear in the table.
 * Heaters dp/dt = +0,02 MPa/s, spray −0,05 MPa/s (illustrative); slider range 10…17 MPa.
 */
import { clamp, interp1 } from '@electricity/sim/core/S2-sim/math';

const P = [10, 12, 14, 15, 15.7, 16, 17];
const T = [311.0, 324.7, 336.7, 342.2, 345.8, 347.4, 352.3];
export const HOT_LEG_C = 320;
export const PRESSURE_RANGE_MPA = [10, 17] as const;
export const HEATER_RATE = 0.02;
export const SPRAY_RATE = -0.05;

/** T_sat [°C] (11 MPa → 317,85 °C); below 10 MPa the first segment is extrapolated. */
export function saturationTempC(pressureMPa: number): number {
  if (pressureMPa < P[0]!) return T[0]! + ((T[1]! - T[0]!) / (P[1]! - P[0]!)) * (pressureMPa - P[0]!);
  return interp1(P, T, pressureMPa);
}

export function subcoolingMarginC(pressureMPa: number): number {
  return saturationTempC(pressureMPa) - HOT_LEG_C;
}

/** Pressurizer with heaters and spray for the scene. */
export function createPressurizer(initialMPa = 15.7) {
  let p = initialMPa;
  let mode: 'idle' | 'heaters' | 'spray' = 'idle';
  return {
    get pressureMPa() {
      return p;
    },
    get marginC() {
      return subcoolingMarginC(p);
    },
    /** Bubbles in the hot legs when the margin is negative. */
    get boiling() {
      return subcoolingMarginC(p) < 0;
    },
    setMode(m: 'idle' | 'heaters' | 'spray') {
      mode = m;
    },
    setPressure(v: number) {
      p = clamp(v, PRESSURE_RANGE_MPA[0], PRESSURE_RANGE_MPA[1]);
    },
    step(dtS: number) {
      const rate = mode === 'heaters' ? HEATER_RATE : mode === 'spray' ? SPRAY_RATE : 0;
      p = clamp(p + rate * dtS, PRESSURE_RANGE_MPA[0], PRESSURE_RANGE_MPA[1]);
    },
  };
}
