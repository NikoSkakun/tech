/**
 * Inverter waveforms, spectrum, THD, LC filter, dead time, efficiency and grid phasors.
 *
 * Source: `lab-inverter` §M2–§M6 (oracle `tools/ref-models/C6-labs/inverter_model.py`, `inv_extra.py`).
 * One fundamental period T = 20 ms is sampled with N points (default 65 536 → f_s = 3.2768 MHz); the spectrum is
 * a radix-2 FFT of exactly one period, so bin h is the h-th harmonic of 50 Hz.
 */

export const GRID_F_HZ = 50;
/** Default samples per fundamental period (§M2). */
export const WAVE_N = 1 << 16;

export type WaveKind = 'square' | 'quasi' | 'spwm_bi' | 'spwm_uni' | 'ladder';

export interface WaveParams {
  kind: WaveKind;
  /** DC-link voltage U_dc, V. */
  udcV: number;
  /** Modulation index m_a (0…1.2); ladder uses it too. */
  ma?: number;
  /** Carrier frequency f_c, Hz (500…20 000). */
  fcHz?: number;
  /** Quasi-square: zero gap half-angle α, degrees (pulse width = 180 − 2α). */
  alphaDeg?: number;
  /** Ladder (multi-level, MMC): number of levels L (odd; L = 2 → square). */
  levels?: number;
  /**
   * Dead time t_d, s (averaged model §M4, applied to SPWM only): u_err = −2·U_dc·t_d·f_c·sign(i), with
   * sign(i) = sign(sin θ) for a resistive load.
   */
  deadTimeS?: number;
  /** Dead-time compensation on → u_err = 0. */
  deadTimeCompensation?: boolean;
  /** Samples per period (power of two). */
  n?: number;
}

/** Triangle carrier in [−1, 1], −1 at t = 0: ph = (t·f_c) mod 1; 4ph − 1 (ph < 0.5) else 3 − 4ph. */
export function triangleCarrier(tS: number, fcHz: number): number {
  const ph = (tS * fcHz) % 1;
  return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
}

/** Round half away from zero (§M2 ladder). */
function roundHalfAway(x: number): number {
  return Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
}

/** Instantaneous output voltage of a waveform at time t (s) within the period. */
export function waveSample(p: WaveParams, tS: number): number {
  const th = 2 * Math.PI * GRID_F_HZ * tS;
  const s = Math.sin(th);
  const udc = p.udcV;
  const ma = p.ma ?? 0.8125;
  const fc = p.fcHz ?? 20000;
  let u: number;
  switch (p.kind) {
    case 'square':
      u = s >= 0 ? udc : -udc;
      break;
    case 'quasi': {
      const a = p.alphaDeg ?? 30;
      const deg = ((th * 180) / Math.PI) % 360;
      if (deg >= a && deg <= 180 - a) u = udc;
      else if (deg >= 180 + a && deg <= 360 - a) u = -udc;
      else u = 0;
      break;
    }
    case 'spwm_bi':
      u = ma * s >= triangleCarrier(tS, fc) ? udc : -udc;
      break;
    case 'spwm_uni': {
      const c = triangleCarrier(tS, fc);
      u = udc * ((ma * s >= c ? 1 : 0) - (-ma * s >= c ? 1 : 0));
      break;
    }
    case 'ladder': {
      const L = Math.max(2, Math.round(p.levels ?? 2));
      if (L === 2) u = s >= 0 ? udc : -udc;
      else {
        const k = (L - 1) / 2;
        u = (udc * roundHalfAway(ma * s * k)) / k;
      }
      break;
    }
  }
  if ((p.kind === 'spwm_uni' || p.kind === 'spwm_bi') && p.deadTimeS && !p.deadTimeCompensation) {
    u += -2 * udc * p.deadTimeS * fc * (s >= 0 ? 1 : -1);
  }
  return u;
}

/** One period of samples. */
export function waveform(p: WaveParams): Float64Array {
  const n = p.n ?? WAVE_N;
  const fs = GRID_F_HZ * n;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = waveSample(p, i / fs);
  return out;
}

/** In-place iterative radix-2 complex FFT (forward, no scaling). `re.length` must be a power of two. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]!;
      re[i] = re[j]!;
      re[j] = t;
      t = im[i]!;
      im[i] = im[j]!;
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const vr = re[b]! * cr - im[b]! * ci;
        const vi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - vr;
        im[b] = im[a]! - vi;
        re[a] = re[a]! + vr;
        im[a] = im[a]! + vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Spectrum of one period: complex bins X[h], h = 0…N−1. */
export interface Spectrum {
  re: Float64Array;
  im: Float64Array;
  n: number;
}

export function spectrumOf(samples: Float64Array): Spectrum {
  const re = Float64Array.from(samples);
  const im = new Float64Array(samples.length);
  fftInPlace(re, im);
  return { re, im, n: samples.length };
}

function mag2(s: Spectrum, h: number): number {
  return s.re[h]! * s.re[h]! + s.im[h]! * s.im[h]!;
}

/** Peak amplitude of harmonic h: U_h = 2·|X[h]|/N. */
export function harmonicAmplitude(s: Spectrum, h: number): number {
  return (2 * Math.sqrt(mag2(s, h))) / s.n;
}

/** Fundamental RMS U₁,rms = |X[1]|·√2/N. */
export function fundamentalRms(s: Spectrum): number {
  return (Math.SQRT2 * Math.sqrt(mag2(s, 1))) / s.n;
}

/** THD = √(Σ_{h=2}^{hMax} |X[h]|²)/|X[1]|, hMax default N/2 − 1 (full); 50 → THD₅₀. */
export function thd(s: Spectrum, hMax = s.n / 2 - 1): number {
  let acc = 0;
  for (let h = 2; h <= hMax; h++) acc += mag2(s, h);
  const f = mag2(s, 1);
  return f > 0 ? Math.sqrt(acc / f) : 0;
}

/** Total RMS from the spectrum (Parseval), excluding nothing. */
export function totalRms(s: Spectrum): number {
  let acc = 0;
  for (let h = 0; h < s.n; h++) acc += mag2(s, h);
  return Math.sqrt(acc) / s.n;
}

/** Harmonic amplitudes 1…hMax (peak volts) for the spectrum bar chart. */
export function harmonicBars(s: Spectrum, hMax = 1000): Float64Array {
  const out = new Float64Array(hMax);
  for (let h = 1; h <= hMax; h++) out[h - 1] = harmonicAmplitude(s, h);
  return out;
}

/** LC low-pass with a resistive load: H(ω) = 1/(1 − ω²LC + jωL/R) (§M3). Returns [Re, Im]. */
export function lcTransfer(fHz: number, lH: number, cF: number, rOhm: number): [number, number] {
  const w = 2 * Math.PI * fHz;
  const a = 1 - w * w * lH * cF;
  const b = (w * lH) / rOhm;
  const d = a * a + b * b;
  return [a / d, -b / d];
}

/** |H| in dB (Bode chart). */
export function lcGainDb(fHz: number, lH: number, cF: number, rOhm: number): number {
  const [r, i] = lcTransfer(fHz, lH, cF, rOhm);
  return 10 * Math.log10(r * r + i * i);
}

/** Resonance f₀ = 1/(2π√(LC)) and characteristic impedance Z₀ = √(L/C). */
export function lcResonance(lH: number, cF: number): { f0Hz: number; z0Ohm: number } {
  return { f0Hz: 1 / (2 * Math.PI * Math.sqrt(lH * cF)), z0Ohm: Math.sqrt(lH / cF) };
}

/** Load resistance from power at 230 V: R = 230²/P; P = 0 → 1e6 Ω (no load). */
export function loadResistanceOhm(pLoadW: number, uV = 230): number {
  return pLoadW > 0 ? (uV * uV) / pLoadW : 1e6;
}

/** Apply the LC filter to a spectrum: Y[h] = X[h]·H, Y[N−h] = conj (DC unchanged). */
export function applyLcFilter(s: Spectrum, lH: number, cF: number, rOhm: number): Spectrum {
  const re = Float64Array.from(s.re);
  const im = Float64Array.from(s.im);
  for (let h = 1; h < s.n / 2; h++) {
    const [hr, hi] = lcTransfer(GRID_F_HZ * h, lH, cF, rOhm);
    const xr = s.re[h]!;
    const xi = s.im[h]!;
    re[h] = xr * hr - xi * hi;
    im[h] = xr * hi + xi * hr;
    re[s.n - h] = re[h]!;
    im[s.n - h] = -im[h]!;
  }
  return { re, im, n: s.n };
}

/** Inverse FFT to recover the filtered time signal (for the oscilloscope). */
export function inverseSpectrum(s: Spectrum): Float64Array {
  const re = Float64Array.from(s.re);
  const im = Float64Array.from(s.im, (x) => -x);
  fftInPlace(re, im);
  for (let k = 0; k < s.n; k++) re[k] = re[k]! / s.n;
  return re;
}

export interface WaveAnalysis {
  samples: Float64Array;
  spectrum: Spectrum;
  u1RmsV: number;
  uRmsV: number;
  /** Full THD (fraction). */
  thd: number;
  /** THD up to the 50th harmonic (fraction). */
  thd50: number;
}

export function analyseWave(p: WaveParams): WaveAnalysis {
  const samples = waveform(p);
  const spectrum = spectrumOf(samples);
  let s2 = 0;
  for (let k = 0; k < samples.length; k++) s2 += samples[k]! * samples[k]!;
  return {
    samples,
    spectrum,
    u1RmsV: fundamentalRms(spectrum),
    uRmsV: Math.sqrt(s2 / samples.length),
    thd: thd(spectrum),
    thd50: thd(spectrum, 50),
  };
}

export interface FilteredAnalysis {
  /** Spectrum after the filter. */
  spectrum: Spectrum;
  u1RmsV: number;
  uRmsV: number;
  thd: number;
  thd50: number;
  f0Hz: number;
  z0Ohm: number;
}

/** §M3: filter an analysed wave with L (H), C (F) and load R (Ω). */
export function filterWave(w: WaveAnalysis, lH: number, cF: number, rOhm: number): FilteredAnalysis {
  const y = applyLcFilter(w.spectrum, lH, cF, rOhm);
  const { f0Hz, z0Ohm } = lcResonance(lH, cF);
  return {
    spectrum: y,
    u1RmsV: fundamentalRms(y),
    uRmsV: totalRms(y),
    thd: thd(y),
    thd50: thd(y, 50),
    f0Hz,
    z0Ohm,
  };
}

/* ----------------------------------------------- §M5 efficiency ------------------------------------------- */

export interface LossCurve {
  /** No-load loss P0, W. */
  p0W: number;
  /** Linear coefficient k1. */
  k1: number;
  /** Quadratic coefficient k2, 1/W. */
  k2: number;
}

/** «ЛІ-6» loss curves (§M5): P_loss = P0 + k1·P + k2·P². */
export const LI6_LOSSES = {
  pvToAc: { p0W: 20, k1: 0.012, k2: 1.5e-6 },
  batToAc: { p0W: 50, k1: 0.02, k2: 3e-6 },
} as const satisfies Record<string, LossCurve>;

/** η = P/(P + P_loss(P)). */
export function efficiency(pW: number, c: LossCurve): number {
  if (pW <= 0) return 0;
  return pW / (pW + c.p0W + c.k1 * pW + c.k2 * pW * pW);
}

/** Maximum efficiency at P* = √(P0/k2). */
export function peakEfficiency(c: LossCurve): { pW: number; eta: number } {
  const p = Math.sqrt(c.p0W / c.k2);
  return { pW: p, eta: efficiency(p, c) };
}

/** European weighted efficiency (rated power default 6000 W). */
export function euroEfficiency(c: LossCurve, ratedW = 6000): number {
  const w: [number, number][] = [
    [0.05, 0.03],
    [0.1, 0.06],
    [0.2, 0.13],
    [0.3, 0.1],
    [0.5, 0.48],
    [1.0, 0.2],
  ];
  return w.reduce((s, [f, k]) => s + k * efficiency(f * ratedW, c), 0);
}

/** Boost converter duty: D = 1 − U_in/U_link (U_in < U_link), else 0 (diode pass-through). */
export function boostDuty(uInV: number, uLinkV = 400): number {
  return uInV > 0 && uInV < uLinkV ? 1 - uInV / uLinkV : 0;
}

/* ----------------------------------------------- §M6 grid phasors ------------------------------------------ */

export const GRID_INDUCTANCE_H = 3e-3;

export interface PhasorResult {
  /** Load angle δ, degrees. */
  deltaDeg: number;
  /** Bridge voltage magnitude U_inv, V. */
  uInvV: number;
  /** Active power, W. */
  pW: number;
  /** Reactive power (+ = inverter supplies Q), var. */
  qVar: number;
  /** Line current magnitude, A. */
  currentA: number;
}

/** Given P and U_inv: δ = asin(P·X/(U·U_inv)), Q = (U·U_inv·cos δ − U²)/X. */
export function phasorFromPU(pW: number, uInvV: number, uGridV = 230, lH = GRID_INDUCTANCE_H): PhasorResult {
  const x = 2 * Math.PI * GRID_F_HZ * lH;
  const sd = Math.max(-1, Math.min(1, (pW * x) / (uGridV * uInvV)));
  const d = Math.asin(sd);
  const q = (uGridV * uInvV * Math.cos(d) - uGridV * uGridV) / x;
  return { deltaDeg: (d * 180) / Math.PI, uInvV, pW, qVar: q, currentA: Math.hypot(pW, q) / uGridV };
}

/** Given P and Q: U_inv = √((P·X/U)² + (U + Q·X/U)²), δ = atan2(P·X/U, U + Q·X/U). */
export function phasorFromPQ(pW: number, qVar: number, uGridV = 230, lH = GRID_INDUCTANCE_H): PhasorResult {
  const x = 2 * Math.PI * GRID_F_HZ * lH;
  const a = (pW * x) / uGridV;
  const b = uGridV + (qVar * x) / uGridV;
  return {
    deltaDeg: (Math.atan2(a, b) * 180) / Math.PI,
    uInvV: Math.hypot(a, b),
    pW,
    qVar,
    currentA: Math.hypot(pW, qVar) / uGridV,
  };
}
