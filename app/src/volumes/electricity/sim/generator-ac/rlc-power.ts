/**
 * `generator-ac` Г6 (step `rlc`) and Г7 (step `ac-power`).
 * Г6: series RLC on U = 230 V (shared `seriesRlc` phasor helper); modes «Лише R / L / C / RLC»; warning when U_L
 * or U_C > 1,5·U; I(f) curve for the chart. Г7: P = 1500 W constant, cos φ₁ slider 0,5…1, S₁ = P/cos φ₁,
 * Q₁ = √(S₁² − P²); capacitor Q_C = ωCU²; Q₂ = Q₁ − Q_C; S₂ = √(P² + Q₂²); I = S₂/U; cos φ₂ = P/S₂ (capacitive if
 * Q₂ < 0); line loss I²·0,5 Ω. Analogy (barge rope angle φ 0…80°): P = S·cos φ, Q = S·sin φ.
 */
import { DEG, clamp } from '../core/S1-sim/math';
import { capacitorReactivePower, powerTriangle, seriesRlc, type SeriesRlcResult } from '../core/S1-sim/phasor';

export const RLC = {
  voltageV: 230,
  frequencyRange: { min: 10, max: 200, step: 0.5, default: 50 },
  resistanceRange: { min: 5, max: 200, default: 50 },
  inductanceRange: { min: 0.05, max: 1, default: 0.3 },
  capacitanceRange: { min: 5e-6, max: 100e-6, default: 30e-6 },
  overvoltageFactor: 1.5,
} as const;

export type RlcMode = 'R' | 'L' | 'C' | 'RLC';

export interface RlcParams {
  frequencyHz: number;
  resistanceOhm: number;
  inductanceH: number;
  capacitanceF: number;
  mode: RlcMode;
}

export function rlcCircuit(p: RlcParams): SeriesRlcResult & { overvoltage: boolean } {
  const f = clamp(p.frequencyHz, RLC.frequencyRange.min, RLC.frequencyRange.max);
  const r = seriesRlc({
    voltageV: RLC.voltageV,
    frequencyHz: f,
    resistanceOhm: p.mode === 'R' || p.mode === 'RLC' ? p.resistanceOhm : 0,
    inductanceH: p.mode === 'L' || p.mode === 'RLC' ? p.inductanceH : 0,
    capacitanceF: p.mode === 'C' || p.mode === 'RLC' ? p.capacitanceF : Infinity,
  });
  return { ...r, overvoltage: r.voltageLV > RLC.overvoltageFactor * RLC.voltageV || r.voltageCV > RLC.overvoltageFactor * RLC.voltageV };
}

/** I(f) samples for the resonance chart. */
export function rlcCurrentCurve(p: Omit<RlcParams, 'frequencyHz' | 'mode'>, points = 191): { frequencyHz: number; currentA: number }[] {
  const out: { frequencyHz: number; currentA: number }[] = [];
  for (let k = 0; k < points; k++) {
    const f = RLC.frequencyRange.min + ((RLC.frequencyRange.max - RLC.frequencyRange.min) * k) / (points - 1);
    out.push({ frequencyHz: f, currentA: rlcCircuit({ ...p, frequencyHz: f, mode: 'RLC' }).currentA });
  }
  return out;
}

export const AC_POWER = { voltageV: 230, activeW: 1500, lineOhm: 0.5, frequencyHz: 50, pfRange: { min: 0.5, max: 1, step: 0.01, default: 0.8 }, capacitorRange: { min: 0, max: 80e-6, step: 2e-6, default: 0 } } as const;

export interface CompensationResult {
  apparentBeforeVA: number;
  reactiveBeforeVar: number;
  capacitorVar: number;
  reactiveAfterVar: number;
  apparentAfterVA: number;
  currentA: number;
  powerFactorAfter: number;
  /** Q₂ < 0 — overcompensated («Перекомпенсація теж погано»). */
  capacitive: boolean;
  lineLossW: number;
}

export function powerCompensation(powerFactor: number, capacitanceF: number): CompensationResult {
  const pf = clamp(powerFactor, AC_POWER.pfRange.min, AC_POWER.pfRange.max);
  const t = powerTriangle(AC_POWER.activeW, pf);
  const qc = capacitorReactivePower(clamp(capacitanceF, 0, AC_POWER.capacitorRange.max), AC_POWER.voltageV, AC_POWER.frequencyHz);
  const q2 = t.reactivePowerVar - qc;
  const s2 = Math.hypot(AC_POWER.activeW, q2);
  const i = s2 / AC_POWER.voltageV;
  return {
    apparentBeforeVA: t.apparentPowerVA,
    reactiveBeforeVar: t.reactivePowerVar,
    capacitorVar: qc,
    reactiveAfterVar: q2,
    apparentAfterVA: s2,
    currentA: i,
    powerFactorAfter: AC_POWER.activeW / s2,
    capacitive: q2 < -1e-9,
    lineLossW: i * i * AC_POWER.lineOhm,
  };
}

/** Barge analogy: rope at angle φ (0…80°) with tension S → useful pull P = S·cos φ, sideways Q = S·sin φ. */
export function bargeAnalogy(angleDeg: number, apparent = 1): { active: number; reactive: number; apparent: number } {
  const a = clamp(angleDeg, 0, 80) * DEG;
  return { active: apparent * Math.cos(a), reactive: apparent * Math.sin(a), apparent };
}
