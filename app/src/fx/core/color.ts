/**
 * Colour helpers that carry physical meaning.
 */
import { Color } from 'three';
import { col } from '@/style';

export interface SpectralColor {
  /** Display colour (linear working space), saturated and palette-friendly. */
  color: Color;
  /** `uv` (< 380 nm), `visible`, or `ir` (> 750 nm). */
  band: 'uv' | 'visible' | 'ir';
  /** Suggested number of wiggles for a photon packet of standard length (shorter wave → more wiggles). */
  waves: number;
}

/**
 * Wavelength (nm) → display colour.
 *
 * Visible light (380…750 nm) uses the piecewise-linear approximation of the spectrum by Dan Bruton
 * ("Approximate RGB values for visible wavelengths", 1996), without its intensity roll-off at the ends so
 * that violet and deep red stay readable on the dark backdrop, then nudged 15 % toward the nearest look of
 * our saturated palette by a gamma of 0.8. Invisible bands follow the course's convention:
 * ultraviolet = pale `violet.light`, infrared = dark `red.dark` (both drawn fainter by the photon effects).
 */
export function wavelengthToColor(nm: number, out = new Color()): SpectralColor {
  const waves = Math.min(Math.max(2900 / Math.max(nm, 1), 2.5), 9);
  if (nm < 380) return { color: col('violet.light', out), band: 'uv', waves };
  if (nm > 750) return { color: col('red.dark', out), band: 'ir', waves };
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = (440 - nm) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = (510 - nm) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = (645 - nm) / 65;
  } else {
    r = 1;
  }
  // the violet end keeps a little red so that 380…420 nm reads as violet rather than pure blue
  if (nm < 420) r = Math.max(r, 0.45);
  const gamma = 0.8;
  out.setRGB(Math.pow(r, gamma), Math.pow(g, gamma), Math.pow(b, gamma), 'srgb');
  return { color: out, band: 'visible', waves };
}

/** Photon energy in electron-volts for a wavelength in nm: E = h·c / λ ≈ 1239,84 eV·nm / λ. */
export function photonEnergyEV(nm: number): number {
  return 1239.841984 / nm;
}
