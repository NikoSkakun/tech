/**
 * Waveform generators (pure math, unit-tested). A waveform is a function of phase angle θ in radians
 * (θ = 2π·f·t) returning a value normalised to the amplitude (−1…1 unless stated otherwise).
 */
export type Waveform = (theta: number) => number;

const TAU = Math.PI * 2;

/** u(θ) = sin(θ + φ). */
export function sine(phase = 0): Waveform {
  return (theta) => Math.sin(theta + phase);
}

/** Three-phase set: phase k (0, 1, 2) lags the previous one by 120° — u_k = sin(θ − k·2π/3). */
export function threePhase(k: 0 | 1 | 2): Waveform {
  return (theta) => Math.sin(theta - (k * TAU) / 3);
}

/** Square wave ±1 with duty cycle `duty` (share of the period spent high). */
export function square(duty = 0.5): Waveform {
  return (theta) => (frac(theta / TAU) < duty ? 1 : -1);
}

/** Symmetric triangle wave −1…1 (peak at θ = π/2, like a sine). */
export function triangle(): Waveform {
  return (theta) => {
    const x = frac(theta / TAU + 0.25);
    return 1 - 4 * Math.abs(x - 0.5);
  };
}

/** Sawtooth −1…1 rising over the period. */
export function sawtooth(): Waveform {
  return (theta) => 2 * frac(theta / TAU) - 1;
}

/** Full-wave rectified sine |sin θ| (0…1); `half` = half-wave rectification max(sin θ, 0). */
export function rectified(half = false): Waveform {
  return (theta) => (half ? Math.max(Math.sin(theta), 0) : Math.abs(Math.sin(theta)));
}

/** Sum of harmonics: Σ a_n·sin(n·θ + φ_n). `amplitudes[0]` is the fundamental (n = 1). */
export function harmonics(amplitudes: readonly number[], phases: readonly number[] = []): Waveform {
  return (theta) => {
    let v = 0;
    for (let i = 0; i < amplitudes.length; i++) v += amplitudes[i]! * Math.sin((i + 1) * theta + (phases[i] ?? 0));
    return v;
  };
}

/**
 * Sinusoidal PWM (two-level, natural sampling): the output is +1 while the reference
 * m·sin θ exceeds a triangular carrier of `ratio` × the fundamental frequency, else −1.
 * `m` = modulation index (0…1), `ratio` = carrier ratio m_f (an odd multiple of 3 in real inverters).
 */
export function spwm(m = 0.8, ratio = 15): Waveform {
  const carrier = triangle();
  return (theta) => (m * Math.sin(theta) >= carrier(theta * ratio) ? 1 : -1);
}

/** RMS of a waveform over one period (numerical, `n` samples): sine → 1/√2, square → 1. */
export function rms(wave: Waveform, n = 2048): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = wave(((i + 0.5) / n) * TAU);
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}

/** Mean of a waveform over one period. */
export function mean(wave: Waveform, n = 2048): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += wave(((i + 0.5) / n) * TAU);
  return sum / n;
}

/**
 * Amplitudes of the first `count` harmonics of a waveform (discrete Fourier series, n = 1…count):
 * c_n = √(a_n² + b_n²),  a_n = (2/N)·Σ u·cos(nθ),  b_n = (2/N)·Σ u·sin(nθ).
 */
export function spectrum(wave: Waveform, count: number, n = 4096): number[] {
  const out: number[] = [];
  for (let h = 1; h <= count; h++) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i++) {
      const theta = ((i + 0.5) / n) * TAU;
      const v = wave(theta);
      a += v * Math.cos(h * theta);
      b += v * Math.sin(h * theta);
    }
    out.push((2 / n) * Math.hypot(a, b));
  }
  return out;
}

/** Total harmonic distortion: THD = √(Σ_{n≥2} c_n²) / c_1. */
export function thd(amplitudes: readonly number[]): number {
  const fundamental = amplitudes[0] ?? 0;
  if (fundamental <= 0) return 0;
  let sum = 0;
  for (let i = 1; i < amplitudes.length; i++) sum += amplitudes[i]! * amplitudes[i]!;
  return Math.sqrt(sum) / fundamental;
}

function frac(x: number): number {
  return x - Math.floor(x);
}
