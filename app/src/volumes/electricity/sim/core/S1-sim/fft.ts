/** Simple FFT (iterative radix-2; plain O(N²) DFT for other lengths) and THD. */

export interface Spectrum {
  /** Real parts of X[k], k = 0…N−1. */
  re: Float64Array;
  /** Imaginary parts of X[k]. */
  im: Float64Array;
}

const isPowerOfTwo = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;

/** Discrete Fourier transform X[k] = Σ x[n]·e^(−j2πkn/N). Radix-2 for powers of two, O(N²) DFT otherwise. */
export function fft(samples: ArrayLike<number>): Spectrum {
  const n = samples.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  if (!isPowerOfTwo(n)) {
    for (let k = 0; k < n; k++) {
      let sr = 0;
      let si = 0;
      for (let t = 0; t < n; t++) {
        const a = (-2 * Math.PI * k * t) / n;
        sr += samples[t] * Math.cos(a);
        si += samples[t] * Math.sin(a);
      }
      re[k] = sr;
      im[k] = si;
    }
    return { re, im };
  }
  // bit-reversal permutation
  for (let i = 0, j = 0; i < n; i++) {
    re[j] = samples[i];
    let bit = n >> 1;
    while (bit >= 1 && j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j |= bit;
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const ang = (-2 * Math.PI) / size;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  return { re, im };
}

/**
 * Single-sided amplitude spectrum: amplitude of the sinusoid at bin k (k = 0 → DC mean).
 * Length ⌊N/2⌋ + 1.
 */
export function amplitudeSpectrum(samples: ArrayLike<number>): Float64Array {
  const n = samples.length;
  const { re, im } = fft(samples);
  const out = new Float64Array(Math.floor(n / 2) + 1);
  for (let k = 0; k < out.length; k++) {
    const mag = Math.hypot(re[k], im[k]) / n;
    out[k] = k === 0 || (n % 2 === 0 && k === n / 2) ? mag : 2 * mag;
  }
  return out;
}

export interface ThdResult {
  /** THD = √(Σ_{h≥2} A_h²)/A_1 (IEC 61000 definition relative to the fundamental). */
  thd: number;
  /** Fundamental amplitude A_1. */
  fundamental: number;
  /** Amplitudes A_1…A_H of harmonics (index 0 = fundamental). */
  harmonics: number[];
}

/**
 * THD of a waveform sampled over exactly `periods` whole periods of the fundamental (so harmonic h sits on bin
 * h·periods without leakage). `maxHarmonic` caps the sum (default 40, as in IEC 61000-4-7).
 */
export function thd(samples: ArrayLike<number>, periods = 1, maxHarmonic = 40): ThdResult {
  const spec = amplitudeSpectrum(samples);
  const harmonics: number[] = [];
  for (let h = 1; h <= maxHarmonic; h++) {
    const bin = h * periods;
    if (bin >= spec.length) break;
    harmonics.push(spec[bin]);
  }
  const fundamental = harmonics[0] ?? 0;
  let s = 0;
  for (let i = 1; i < harmonics.length; i++) s += harmonics[i] * harmonics[i];
  return { thd: fundamental > 0 ? Math.sqrt(s) / fundamental : 0, fundamental, harmonics };
}
