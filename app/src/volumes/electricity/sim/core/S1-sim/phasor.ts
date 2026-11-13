/**
 * AC phasor helpers (RMS phasors, steady state). `generator-ac` «Модель симуляції» Г6/Г7.
 */
import { cAbs, cArg, complex, type Complex } from './complex';

export interface SeriesRlcParams {
  /** RMS source voltage U, V. */
  voltageV: number;
  frequencyHz: number;
  resistanceOhm: number;
  /** 0 → no inductor. */
  inductanceH: number;
  /** `Infinity` (or ≤ 0) → no capacitor (short). */
  capacitanceF: number;
}

export interface SeriesRlcResult {
  /** X_L = ωL, Ω. */
  reactanceLOhm: number;
  /** X_C = 1/(ωC), Ω (0 without capacitor). */
  reactanceCOhm: number;
  /** Z = R + j(X_L − X_C). */
  impedance: Complex;
  impedanceOhm: number;
  /** φ = arg Z, rad: > 0 inductive (current lags), < 0 capacitive (current leads). */
  phaseRad: number;
  phaseDeg: number;
  currentA: number;
  voltageRV: number;
  voltageLV: number;
  voltageCV: number;
  /** Active power P = I²·R, W. */
  activePowerW: number;
  /** Reactive power Q = I²·(X_L − X_C), var. */
  reactivePowerVar: number;
  /** Apparent power S = U·I, VA. */
  apparentPowerVA: number;
  powerFactor: number;
  /** f₀ = 1/(2π√(LC)), Hz (NaN when L or C is absent). */
  resonanceHz: number;
}

/** Series R-L-C on a sinusoidal source: Z = R + j(ωL − 1/(ωC)), I = U/|Z| (Г6). */
export function seriesRlc(p: SeriesRlcParams): SeriesRlcResult {
  const w = 2 * Math.PI * p.frequencyHz;
  const hasC = Number.isFinite(p.capacitanceF) && p.capacitanceF > 0;
  const xl = w * Math.max(p.inductanceH, 0);
  const xc = hasC ? 1 / (w * p.capacitanceF) : 0;
  const z = complex(Math.max(p.resistanceOhm, 0), xl - xc);
  const zAbs = cAbs(z);
  const i = zAbs > 0 ? p.voltageV / zAbs : Infinity;
  const phase = cArg(z);
  return {
    reactanceLOhm: xl,
    reactanceCOhm: xc,
    impedance: z,
    impedanceOhm: zAbs,
    phaseRad: phase,
    phaseDeg: (phase * 180) / Math.PI,
    currentA: i,
    voltageRV: i * z.re,
    voltageLV: i * xl,
    voltageCV: i * xc,
    activePowerW: i * i * z.re,
    reactivePowerVar: i * i * (xl - xc),
    apparentPowerVA: p.voltageV * i,
    powerFactor: zAbs > 0 ? z.re / zAbs : 1,
    resonanceHz: hasC && p.inductanceH > 0 ? 1 / (2 * Math.PI * Math.sqrt(p.inductanceH * p.capacitanceF)) : NaN,
  };
}

export interface PowerTriangle {
  activePowerW: number;
  reactivePowerVar: number;
  apparentPowerVA: number;
  powerFactor: number;
}

/** Power triangle from P and cos φ (inductive, Q ≥ 0): S = P/cos φ, Q = √(S² − P²). */
export function powerTriangle(activePowerW: number, powerFactor: number): PowerTriangle {
  const pf = Math.min(Math.max(powerFactor, 1e-6), 1);
  const s = activePowerW / pf;
  return { activePowerW, reactivePowerVar: Math.sqrt(Math.max(s * s - activePowerW * activePowerW, 0)), apparentPowerVA: s, powerFactor: pf };
}

/** Reactive power of a shunt capacitor Q_C = ω·C·U², var. */
export function capacitorReactivePower(capacitanceF: number, voltageV: number, frequencyHz: number): number {
  return 2 * Math.PI * frequencyHz * capacitanceF * voltageV * voltageV;
}
