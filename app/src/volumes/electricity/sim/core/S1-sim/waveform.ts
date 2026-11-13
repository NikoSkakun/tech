/** Waveform generators and statistics (sine, three-phase, RMS). Instantaneous values in SI units. */

/** u(t) = U_max·sin(2π·f·t + φ). */
export function sine(amplitude: number, frequencyHz: number, tS: number, phaseRad = 0): number {
  return amplitude * Math.sin(2 * Math.PI * frequencyHz * tS + phaseRad);
}

/** Amplitude of a sinusoid with the given RMS value: U_max = √2·U. */
export const rmsToPeak = (rms: number): number => rms * Math.SQRT2;
export const peakToRms = (peak: number): number => peak / Math.SQRT2;

/**
 * Symmetric three-phase set u_k(t) = √2·U_ph·sin(ωt − (k−1)·120°), k = 1, 2, 3 (`generator-ac` Г3).
 * `sequence` −1 swaps phases 2 and 3 (negative sequence — reversed rotating field).
 */
export function threePhase(phaseRmsV: number, frequencyHz: number, tS: number, sequence: 1 | -1 = 1): [number, number, number] {
  const a = rmsToPeak(phaseRmsV);
  const wt = 2 * Math.PI * frequencyHz * tS;
  const s = (2 * Math.PI) / 3;
  return [a * Math.sin(wt), a * Math.sin(wt - sequence * s), a * Math.sin(wt - 2 * sequence * s)];
}

/** Samples f(t) at n points over [t0, t1) (uniform, end excluded — suits periodic windows and FFT). */
export function sampleWave(f: (tS: number) => number, t0: number, t1: number, n: number): Float64Array {
  const out = new Float64Array(n);
  const dt = (t1 - t0) / n;
  for (let i = 0; i < n; i++) out[i] = f(t0 + i * dt);
  return out;
}

/** Root mean square of samples. */
export function rms(samples: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
  return samples.length ? Math.sqrt(s / samples.length) : 0;
}

export function mean(samples: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i];
  return samples.length ? s / samples.length : 0;
}

/**
 * Oscilloscope helper: time window showing `periods` whole periods of frequency f (`generator-ac` Г1:
 * 40 ms at 50 Hz = 2 periods). Falls back to `fallbackS` for f ≤ 0.
 */
export function scopeWindowS(frequencyHz: number, periods = 2, fallbackS = 0.04): number {
  return frequencyHz > 0 ? periods / frequencyHz : fallbackS;
}
