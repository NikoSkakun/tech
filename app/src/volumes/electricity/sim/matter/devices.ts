/**
 * `matter` «Модель симуляції» §9 (step `devices`):
 * LED λ = 1239,84/E_g nm with material label by E_g (< 1,6 GaAs/AlGaAs IR; 1,6–2,2 AlGaInP red–yellow;
 * 2,2–2,6 InGaN green; 2,6–3,1 InGaN blue; > 3,1 AlGaN/GaN UV); solar cell: pair rate and fan ω ∝ G/1000;
 * MOSFET switch f = clamp((U_GS − U_th)/2 V, 0, 1), U_th = 2 V, lamp 12 V / 5 W (I_nom = 0,42 A).
 */
import { clamp } from '../core/S1-sim/math';
import { photonBand, photonWavelengthNm, wavelengthToRgb, type PhotonBand } from '../core/S1-sim/spectrum';

export type LedMaterial = 'GaAs/AlGaAs' | 'AlGaInP' | 'InGaN-green' | 'InGaN-blue' | 'AlGaN/GaN';

export const LED_RANGE_EV = { min: 1.4, max: 3.3, step: 0.01, default: 1.9 } as const;

export function ledEmission(bandGapEv: number): { wavelengthNm: number; band: PhotonBand; material: LedMaterial; rgb: [number, number, number] } {
  const eg = clamp(bandGapEv, LED_RANGE_EV.min, LED_RANGE_EV.max);
  const wl = photonWavelengthNm(eg);
  const material: LedMaterial = eg < 1.6 ? 'GaAs/AlGaAs' : eg < 2.2 ? 'AlGaInP' : eg < 2.6 ? 'InGaN-green' : eg <= 3.1 ? 'InGaN-blue' : 'AlGaN/GaN';
  return { wavelengthNm: wl, band: photonBand(wl), material, rgb: wavelengthToRgb(wl) };
}

export const SOLAR_CELL = { irradianceRange: { min: 0, max: 1000, step: 50, default: 600 } } as const;

/** Fraction of maximum pair rate and fan speed: G/1000 (illustrative; real I-V in `lab-pv`). */
export const solarCellActivity = (irradianceWPerM2: number): number => clamp(irradianceWPerM2 / 1000, 0, 1);

export const MOSFET = { thresholdV: 2, fullOnSpanV: 2, lampRatedV: 12, lampRatedW: 5, gateRange: { min: 0, max: 10, step: 0.1, default: 0 } } as const;

export function mosfetSwitch(gateV: number): { channelFraction: number; lampCurrentA: number; channelFormed: boolean } {
  const f = clamp((gateV - MOSFET.thresholdV) / MOSFET.fullOnSpanV, 0, 1);
  // I_nom = 5 W / 12 V = 0,417 A (doc: 0,42 A)
  return { channelFraction: f, lampCurrentA: (f * MOSFET.lampRatedW) / MOSFET.lampRatedV, channelFormed: gateV > MOSFET.thresholdV };
}
