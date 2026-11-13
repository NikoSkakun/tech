/**
 * `matter` «Модель симуляції» §8 (step `pn-junction`): source U_s + R = 220 Ω + Shockley diode
 * I = I_s·(exp(U_D/(n·U_T)) − 1), I_s = 10⁻¹² A, n = 1, U_T = 0,025852 V (300 K); solve U_s = U_D + I·R by
 * bisection on [min(U_s,0) − 1, max(U_s,0) + 1] (no reverse breakdown, −6 V is safe).
 * Depletion width (illustrative, N_A = N_D = 10¹⁶): W = W₀·√(max(V_bi − U_D, 0,05)/V_bi), W₀ = 0,43 μm,
 * V_bi = 0,71 V; barrier height = max(V_bi − U_D, 0,05) V. Indicator lamp brightness ∝ I/25 mA.
 */
import { bisect, clamp } from '../core/S1-sim/math';
import { sine } from '../core/S1-sim/waveform';

export const DIODE = {
  seriesOhm: 220,
  saturationA: 1e-12,
  ideality: 1,
  thermalV: 0.025852,
  builtInV: 0.71,
  depletionAtZeroUm: 0.43,
  minBarrierV: 0.05,
  sourceRange: { min: -6, max: 6, step: 0.05, default: 0 },
  lampFullScaleA: 0.025,
} as const;

export const diodeCurrentA = (diodeV: number): number => DIODE.saturationA * Math.expm1(diodeV / (DIODE.ideality * DIODE.thermalV));

export interface DiodeCircuit {
  sourceV: number;
  diodeV: number;
  currentA: number;
  resistorV: number;
  depletionWidthUm: number;
  barrierV: number;
  lampBrightness: number;
  forward: boolean;
}

/** `flipped` = «Перевернути діод» (same as negating U_s for the diode). */
export function diodeCircuit(sourceV: number, flipped = false): DiodeCircuit {
  const us = flipped ? -sourceV : sourceV;
  const ud = bisect((u) => us - u - DIODE.seriesOhm * diodeCurrentA(u), Math.min(us, 0) - 1, Math.max(us, 0) + 1, 60);
  const i = diodeCurrentA(ud);
  const barrier = Math.max(DIODE.builtInV - ud, DIODE.minBarrierV);
  return {
    sourceV,
    diodeV: ud,
    currentA: i,
    resistorV: i * DIODE.seriesOhm,
    depletionWidthUm: DIODE.depletionAtZeroUm * Math.sqrt(barrier / DIODE.builtInV),
    barrierV: barrier,
    lampBrightness: clamp(i / DIODE.lampFullScaleA, 0, 1),
    forward: ud > 0,
  };
}

/** I–V curve samples for the chart (U_D −1…+0,8 V). */
export function diodeIvCurve(points = 181, fromV = -1, toV = 0.8): { diodeV: number; currentA: number }[] {
  const out: { diodeV: number; currentA: number }[] = [];
  for (let k = 0; k < points; k++) {
    const u = fromV + ((toV - fromV) * k) / (points - 1);
    out.push({ diodeV: u, currentA: diodeCurrentA(u) });
  }
  return out;
}

/**
 * Devices tab «Діод»: half-wave rectifier — input u_in(t) = U_peak·sin(2πft) (or constant for DC) through the
 * same diode + 220 Ω circuit; output = voltage across the resistor.
 */
export function rectifierSample(tS: number, mode: 'ac' | 'dc', peakV = 5, frequencyHz = 1): { inputV: number; outputV: number } {
  const u = mode === 'dc' ? peakV : sine(peakV, frequencyHz, tS);
  return { inputV: u, outputV: diodeCircuit(u).resistorV };
}
