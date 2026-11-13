/**
 * Photon / EM-spectrum helpers shared by `atom/ions-photons`, `matter/devices` (LED) and `magnetism/maxwell`.
 */
import { HC_EV_NM, SPEED_OF_LIGHT_M_PER_S } from './constants';

/** λ[nm] = 1239,84 / E[eV] (vacuum wavelength). */
export function photonWavelengthNm(energyEv: number): number {
  return HC_EV_NM / energyEv;
}

export function photonEnergyEv(wavelengthNm: number): number {
  return HC_EV_NM / wavelengthNm;
}

/** Display class of a photon (`atom` §3): < 380 nm UV, 380–750 nm visible, > 750 nm IR. */
export type PhotonBand = 'uv' | 'visible' | 'ir';

export function photonBand(wavelengthNm: number): PhotonBand {
  if (wavelengthNm < 380) return 'uv';
  if (wavelengthNm > 750) return 'ir';
  return 'visible';
}

/**
 * Wavelength → linear-ish sRGB triple in [0, 1] (Dan Bruton's piecewise approximation, the "standard
 * approximation" named in `atom` §3), including the intensity fall-off near the ends of the visible range.
 * Outside 380–750 nm returns black — the scene uses the `violet`/`red.dark` UV/IR tokens there.
 */
export function wavelengthToRgb(wavelengthNm: number, gamma = 0.8): [number, number, number] {
  const w = wavelengthNm;
  let r = 0;
  let g = 0;
  let b = 0;
  if (w >= 380 && w < 440) {
    r = -(w - 440) / (440 - 380);
    b = 1;
  } else if (w >= 440 && w < 490) {
    g = (w - 440) / (490 - 440);
    b = 1;
  } else if (w >= 490 && w < 510) {
    g = 1;
    b = -(w - 510) / (510 - 490);
  } else if (w >= 510 && w < 580) {
    r = (w - 510) / (580 - 510);
    g = 1;
  } else if (w >= 580 && w < 645) {
    r = 1;
    g = -(w - 645) / (645 - 580);
  } else if (w >= 645 && w <= 750) {
    r = 1;
  }
  let factor = 0;
  if (w >= 380 && w < 420) factor = 0.3 + (0.7 * (w - 380)) / (420 - 380);
  else if (w >= 420 && w < 701) factor = 1;
  else if (w >= 701 && w <= 750) factor = 0.3 + (0.7 * (750 - w)) / (750 - 700);
  const adj = (c: number): number => (c === 0 ? 0 : Math.pow(c * factor, gamma));
  return [adj(r), adj(g), adj(b)];
}

/** Regions of the electromagnetic spectrum (`magnetism/maxwell`, slider 10⁶…10¹⁸ Hz). */
export type EmBand = 'radio' | 'microwave' | 'infrared' | 'visible' | 'ultraviolet' | 'xray' | 'gamma';

/** λ = c/f, m. */
export function wavelengthFromFrequencyM(frequencyHz: number): number {
  return SPEED_OF_LIGHT_M_PER_S / frequencyHz;
}

/**
 * Conventional boundaries by vacuum wavelength: radio > 1 m (< 300 MHz), microwave 1 mm–1 m, infrared
 * 750 nm–1 mm, visible 380–750 nm (same limits as {@link photonBand}), UV 10–380 nm, X-ray 10 pm–10 nm,
 * gamma < 10 pm. (Boundaries are conventions; X-ray/gamma overlap physically.)
 */
export function emBand(frequencyHz: number): EmBand {
  const l = wavelengthFromFrequencyM(frequencyHz);
  if (l > 1) return 'radio';
  if (l > 1e-3) return 'microwave';
  if (l > 750e-9) return 'infrared';
  if (l >= 380e-9) return 'visible';
  if (l >= 10e-9) return 'ultraviolet';
  if (l >= 10e-12) return 'xray';
  return 'gamma';
}
