/**
 * `generator-ac` Г2 (step `war-of-currents`): two streets of 20 × 100 W lamps (P_n = 2 kW) at distance d.
 * DC: U_s = 110 V, two copper wires S = 50 mm², ρ = 0,0175 Ω·mm²/m: R_line = 2ρd/S; R_load = 110²/2000 = 6,05 Ω;
 * I = U_s/(R_line + R_load); U_load = I·R_load; brightness ∝ (U_load/110)^3,4. AC: U_t = 2000 V over the same
 * wires with ideal 2000/110 V transformers: R'_load = 6,05·(2000/110)² = 2000 Ω. Loss chip = I²R_line/P_source.
 */
import { clamp } from '../core/S1-sim/math';

export const WAR = {
  dcV: 110,
  transmissionV: 2000,
  loadW: 2000,
  crossSectionMm2: 50,
  resistivityOhmMm2PerM: 0.0175,
  brightnessExponent: 3.4,
  distanceRangeKm: { min: 0.2, max: 10, step: 0.2, default: 1 },
} as const;

export interface StreetResult {
  lineOhm: number;
  currentA: number;
  /** Lamp voltage (secondary side for AC), V. */
  lampV: number;
  lossW: number;
  /** Loss as a fraction of the source power. */
  lossFraction: number;
  brightness: number;
}

export function warOfCurrents(distanceKm: number): { dc: StreetResult; ac: StreetResult } {
  const d = clamp(distanceKm, WAR.distanceRangeKm.min, WAR.distanceRangeKm.max) * 1000;
  const rLine = (2 * WAR.resistivityOhmMm2PerM * d) / WAR.crossSectionMm2;
  const rLoad = (WAR.dcV * WAR.dcV) / WAR.loadW;
  const street = (sourceV: number, loadOhm: number, ratio: number): StreetResult => {
    const i = sourceV / (rLine + loadOhm);
    const loss = i * i * rLine;
    const lampV = (i * loadOhm) / ratio;
    return { lineOhm: rLine, currentA: i, lampV, lossW: loss, lossFraction: loss / (sourceV * i), brightness: Math.pow(lampV / WAR.dcV, WAR.brightnessExponent) };
  };
  const ratio = WAR.transmissionV / WAR.dcV;
  return { dc: street(WAR.dcV, rLoad, 1), ac: street(WAR.transmissionV, rLoad * ratio * ratio, ratio) };
}
