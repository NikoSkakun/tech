/**
 * `current` §3 (step `source-emf`) and §4 (step `ohm`).
 * §3: lamp 12 V / 6 W as constant R = 24 Ω; I = ℰ/R, P = ℰ²/R, brightness = clamp(P/6 W, 0, 1)^0,5.
 * §4: sample R = ρ·L/A; lab supply U_set 0…12 V with current limit 3 A (CC: I = 3 A, U = 3 A·R);
 *     glow colour intensity clamp((P − 10 W)/30 W, 0, 1); lamp 12 V / 5 W filament
 *     R(U) = R_cold + (R_hot − R_cold)·(U/12 V)^0,45, R_cold = 2,4 Ω, R_hot = 28,8 Ω.
 */
import { clamp } from '../core/S1-sim/math';

export const SOURCE_EMF = { lampOhm: 24, lampRatedW: 6, emfRange: { min: 0, max: 12, step: 0.5, default: 1.5 }, labSupplyAboveV: 1.5 } as const;

/** Perceptual brightness curve shared by §3 and §7: clamp(P/P_nom, 0, 1)^0,5. */
export const lampBrightness = (powerW: number, ratedW: number): number => Math.sqrt(clamp(powerW / ratedW, 0, 1));

export function sourceEmfLamp(emfV: number): { currentA: number; powerW: number; brightness: number; labSupply: boolean } {
  const e = clamp(emfV, SOURCE_EMF.emfRange.min, SOURCE_EMF.emfRange.max);
  const i = e / SOURCE_EMF.lampOhm;
  const p = e * i;
  return { currentA: i, powerW: p, brightness: lampBrightness(p, SOURCE_EMF.lampRatedW), labSupply: e > SOURCE_EMF.labSupplyAboveV };
}

/** Resistivities at 20 °C for the bench (`current` §1), Ω·m. */
export const BENCH_MATERIALS = { Cu: 1.68e-8, Al: 2.65e-8, Fe: 9.7e-8, NiCr: 1.1e-6 } as const;
export type BenchMaterial = keyof typeof BENCH_MATERIALS;

export const OHM_BENCH = {
  supplyRangeV: { min: 0, max: 12, step: 0.1, default: 2 },
  currentLimitA: 3,
  lengthRangeM: { min: 0.1, max: 10, default: 1 },
  areaRangeMm2: { min: 0.01, max: 1, default: 0.1 },
  glowThresholdW: 10,
  glowSpanW: 30,
  lamp: { coldOhm: 2.4, hotOhm: 28.8, ratedV: 12, ratedW: 5, exponent: 0.45 },
  autoRecordStepV: 0.5,
} as const;

export const wireResistanceOhm = (material: BenchMaterial, lengthM: number, areaMm2: number): number => (BENCH_MATERIALS[material] * lengthM) / (areaMm2 * 1e-6);

/** Filament model R(U) (illustrative tungsten), Ω. */
export function filamentResistanceOhm(voltageV: number): number {
  const l = OHM_BENCH.lamp;
  return l.coldOhm + (l.hotOhm - l.coldOhm) * Math.pow(Math.max(Math.abs(voltageV), 0) / l.ratedV, l.exponent);
}

export interface BenchReading {
  resistanceOhm: number;
  voltageV: number;
  currentA: number;
  powerW: number;
  /** Supply in constant-current mode (amber «CC»). */
  constantCurrent: boolean;
  /** Orange glow intensity 0…1. */
  glow: number;
}

export type BenchSample = { kind: 'wire'; material: BenchMaterial; lengthM: number; areaMm2: number } | { kind: 'lamp' };

/** Supply + sample. For the lamp the CC case solves I_lim = U/R(U) by bisection. */
export function ohmBench(supplyV: number, sample: BenchSample): BenchReading {
  const uSet = clamp(supplyV, OHM_BENCH.supplyRangeV.min, OHM_BENCH.supplyRangeV.max);
  const lim = OHM_BENCH.currentLimitA;
  let r: number;
  let u: number;
  let i: number;
  if (sample.kind === 'wire') {
    r = wireResistanceOhm(sample.material, sample.lengthM, sample.areaMm2);
    i = uSet / r;
    u = uSet;
  } else {
    r = filamentResistanceOhm(uSet);
    u = uSet;
    i = uSet / r;
  }
  const cc = i > lim;
  if (cc) {
    i = lim;
    if (sample.kind === 'wire') u = lim * r;
    else {
      // find U with U/R(U) = I_lim (U/R(U) is increasing in U)
      let lo = 0;
      let hi = uSet;
      for (let k = 0; k < 60; k++) {
        const m = 0.5 * (lo + hi);
        if (m / filamentResistanceOhm(m) > lim) hi = m;
        else lo = m;
      }
      u = 0.5 * (lo + hi);
      r = filamentResistanceOhm(u);
    }
  }
  const p = u * i;
  return { resistanceOhm: r, voltageV: u, currentA: i, powerW: p, constantCurrent: cc, glow: clamp((p - OHM_BENCH.glowThresholdW) / OHM_BENCH.glowSpanW, 0, 1) };
}
