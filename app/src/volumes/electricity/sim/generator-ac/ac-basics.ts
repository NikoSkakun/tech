/**
 * `generator-ac` Г1 (step `rotating-loop`, model = shared rotating coil) and step `ac-anatomy`:
 * Г1: ω = 2π·n/60, ℰ_max = N·B·A·ω, f = n/60; oscilloscope window shows 2 periods (40 ms at 50 Hz);
 *     above 300 rpm the coil is drawn stroboscopically slowed ×50 (chip «сповільнено ×50»).
 * ac-anatomy: RMS slider 0…250 V (step 5, default 230), U_max = U·√2, 50/60 Hz, cursor u(t); a badly driven LED
 * flickers at 100 Hz (on only above a threshold of |u|).
 */
import { rpmToRadPerS } from '../core/S1-sim/math';
import { rotatingCoilReadouts } from '../core/S1-sim/rotating-coil';
import { rmsToPeak, scopeWindowS, sine } from '../core/S1-sim/waveform';

export const ROTATING_LOOP = {
  speedRangeRpm: { min: 0, max: 3600, step: 60, default: 600 },
  fieldRangeT: { min: 0.1, max: 1, step: 0.05, default: 0.5 },
  turnsRange: { min: 10, max: 200, step: 10, default: 100 },
  areaM2: 0.01,
  strobeAboveRpm: 300,
  strobeFactor: 50,
} as const;

export function rotatingLoop(speedRpm: number, fieldT: number = ROTATING_LOOP.fieldRangeT.default, turns: number = ROTATING_LOOP.turnsRange.default): {
  omegaRadPerS: number;
  frequencyHz: number;
  periodS: number;
  emfMaxV: number;
  scopeWindowS: number;
  /** Visual slow-down factor of the drawn coil (1 or 50). */
  visualSlowdown: number;
  /** Angular speed at which the coil is drawn, rad/s. */
  visualOmegaRadPerS: number;
} {
  const r = rotatingCoilReadouts({ turns, fieldT, areaM2: ROTATING_LOOP.areaM2 }, speedRpm);
  const slow = speedRpm > ROTATING_LOOP.strobeAboveRpm ? ROTATING_LOOP.strobeFactor : 1;
  return {
    omegaRadPerS: r.omegaRadPerS,
    frequencyHz: r.frequencyHz,
    periodS: r.periodS,
    emfMaxV: r.emfMaxV,
    scopeWindowS: scopeWindowS(r.frequencyHz),
    visualSlowdown: slow,
    visualOmegaRadPerS: rpmToRadPerS(speedRpm) / slow,
  };
}

export const AC_ANATOMY = { rmsRangeV: { min: 0, max: 250, step: 5, default: 230 }, frequenciesHz: [50, 60] as const, ledOnFraction: 0.5 } as const;

export function acWave(rmsV: number, frequencyHz: 50 | 60, tS: number): { instantaneousV: number; peakV: number; periodS: number } {
  const peak = rmsToPeak(rmsV);
  return { instantaneousV: sine(peak, frequencyHz, tS), peakV: peak, periodS: 1 / frequencyHz };
}

/** LED with a poor driver: lit only while |u| > 50 % of the peak → dashed trail at 2f = 100 Hz. */
export const ledLit = (frequencyHz: number, tS: number): boolean => Math.abs(Math.sin(2 * Math.PI * frequencyHz * tS)) > AC_ANATOMY.ledOnFraction;
