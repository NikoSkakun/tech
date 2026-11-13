/** Small numeric helpers shared by all S1 models (no allocation in hot paths). */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** `true` when |a − b| ≤ tol·max(1, |a|, |b|) — used for "on the boundary" comparisons. */
export function nearlyEqual(a: number, b: number, relTol = 1e-9): boolean {
  return Math.abs(a - b) <= relTol * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Guard against NaN/±Infinity leaking into scene parameters. */
export function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Bisection root finder on [lo, hi]. `f(lo)` and `f(hi)` must bracket a root (opposite signs or zero);
 * otherwise the end with the smaller |f| is returned. Fixed iteration count keeps it deterministic.
 */
export function bisect(f: (x: number) => number, lo: number, hi: number, iterations = 80): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? a : b;
  for (let i = 0; i < iterations; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0) return m;
    if (fa * fm < 0) {
      b = m;
    } else {
      a = m;
      fa = fm;
    }
  }
  return 0.5 * (a + b);
}

/** Golden-section search for the maximum of a unimodal function on [lo, hi]. */
export function argmax(f: (x: number) => number, lo: number, hi: number, iterations = 100): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < iterations; i++) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = f(d);
    }
  }
  return 0.5 * (a + b);
}

/**
 * Splits a frame `dt` into equal sub-steps no longer than `maxStep` (time-domain models must stay stable for
 * dt up to 1/30 s). Returns the number of sub-steps (≥ 1, capped at `maxCount`) — the caller uses dt/n.
 */
export function subStepCount(dt: number, maxStep: number, maxCount = 1000): number {
  if (!(dt > 0)) return 0;
  return Math.min(maxCount, Math.max(1, Math.ceil(dt / maxStep - 1e-9)));
}

/** Linear map of `value` from [inMin, inMax] onto a logarithmic range [outMin, outMax] (slider helpers). */
export function logLerp(outMin: number, outMax: number, t: number): number {
  return Math.exp(Math.log(outMin) + (Math.log(outMax) - Math.log(outMin)) * t);
}

/** Inverse of {@link logLerp}: position t ∈ [0, 1] of `value` on a log scale. */
export function inverseLogLerp(outMin: number, outMax: number, value: number): number {
  return (Math.log(value) - Math.log(outMin)) / (Math.log(outMax) - Math.log(outMin));
}

/** Wraps an angle in degrees into (−180, 180]. */
export function wrapDeg180(deg: number): number {
  let a = deg % 360;
  if (a <= -180) a += 360;
  if (a > 180) a -= 360;
  return a;
}

/** Wraps an angle in radians into [0, 2π). */
export function wrapRad2Pi(rad: number): number {
  const twoPi = 2 * Math.PI;
  const a = rad % twoPi;
  return a < 0 ? a + twoPi : a;
}

export const DEG = Math.PI / 180;

/** Converts rotational speed (rpm) to angular velocity (rad/s): ω = 2π·n/60. */
export function rpmToRadPerS(rpm: number): number {
  return (2 * Math.PI * rpm) / 60;
}

export function radPerSToRpm(omega: number): number {
  return (omega * 60) / (2 * Math.PI);
}
