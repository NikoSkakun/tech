/**
 * `current` «Модель симуляції» §10 (step `dc-ac`): u(t) = 325·sin(2π·50·t) V (AC) or 1,5 V (DC); lamp flicker
 * 100 Hz with 5 % depth (scenic); oscilloscope sweep 5…100 ms per screen (default 40 ms).
 * Oersted: compass d = 1 cm under a wire with I = 5 A along the magnetic meridian: B_wire = μ₀I/(2πd) =
 * 1,0×10⁻⁴ T, B_E = 2×10⁻⁵ T horizontal → θ = atan(B_wire/B_E) ≈ 79° (1 A → 45°); reversing the current gives −θ.
 * Conventional current northward above the compass deflects the N end to the west (positive θ here = west).
 * Needle dynamics: underdamped follower settling in ≈ 0,8 s.
 */
import { wireFieldMagnitude } from '../core/S1-sim/field';
import { createFollower, type Follower } from '../core/S1-sim/oscillator';
import { sine } from '../core/S1-sim/waveform';

export const AC_DC = { acPeakV: 325, frequencyHz: 50, dcV: 1.5, flickerHz: 100, flickerDepth: 0.05, sweepMs: { min: 5, max: 100, default: 40 } } as const;

export function sourceVoltage(mode: 'ac' | 'dc', tS: number): number {
  return mode === 'dc' ? AC_DC.dcV : sine(AC_DC.acPeakV, AC_DC.frequencyHz, tS);
}

/** Relative lamp brightness: DC 1; AC 1 − depth·(1 − cos(2π·100·t))/2 (thermal inertia keeps it shallow). */
export function lampFlicker(mode: 'ac' | 'dc', tS: number): number {
  if (mode === 'dc') return 1;
  return 1 - (AC_DC.flickerDepth * (1 - Math.cos(2 * Math.PI * AC_DC.flickerHz * tS))) / 2;
}

export const OERSTED = { currentA: 5, distanceM: 0.01, earthHorizontalT: 2e-5 } as const;

/** Equilibrium deflection from the meridian, rad (positive = N end to the west for northward current). */
export function oerstedDeflectionRad(currentA: number, distanceM: number = OERSTED.distanceM): number {
  const b = wireFieldMagnitude(currentA, distanceM);
  return Math.sign(currentA) * Math.atan(b / OERSTED.earthHorizontalT);
}

export interface OerstedCompass {
  readonly needle: Follower;
  /** current on/off and direction (+1 north, −1 south) */
  step(dt: number, on: boolean, direction: 1 | -1): number;
}

/** Needle follower: ω_n = 2π·1,25 rad/s, ζ = 0,5 → settles within ≈ 0,8 s with a visible overshoot. */
export function createOerstedCompass(): OerstedCompass {
  const needle = createFollower({ omegaN: 2 * Math.PI * 1.25, zeta: 0.5, angular: true });
  return {
    needle,
    step(dt: number, on: boolean, direction: 1 | -1): number {
      const target = on ? oerstedDeflectionRad(direction * OERSTED.currentA) : 0;
      return needle.step(target, dt);
    },
  };
}
