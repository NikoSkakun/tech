/**
 * Small numeric helpers shared by the S3-sim models (no dependencies, deterministic).
 */

export const DEG = Math.PI / 180;

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Finite-number guard: replaces NaN/±Infinity by `fallback` (used on user-facing outputs only). */
export function finite(x: number, fallback = 0): number {
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Bisection for a root of a monotone function on [lo, hi]. Returns the midpoint after `iters` halvings.
 * Works for both increasing and decreasing `f`; if there is no sign change the closer end is returned.
 */
export function bisect(f: (x: number) => number, lo: number, hi: number, iters = 60): number {
  let flo = f(lo);
  const fhi = f(hi);
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (Math.sign(flo) === Math.sign(fhi)) return Math.abs(flo) < Math.abs(fhi) ? lo : hi;
  let a = lo;
  let b = hi;
  for (let k = 0; k < iters; k++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0) return m;
    if (Math.sign(fm) === Math.sign(flo)) {
      a = m;
      flo = fm;
    } else {
      b = m;
    }
  }
  return 0.5 * (a + b);
}

/** Golden-section search for the maximum of a unimodal function on [lo, hi]; returns the arg-max. */
export function goldenMax(f: (x: number) => number, lo: number, hi: number, iters = 50): number {
  const r = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - r * (b - a);
  let d = a + r * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let k = 0; k < iters; k++) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - r * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + r * (b - a);
      fd = f(d);
    }
  }
  return 0.5 * (a + b);
}

/**
 * Piecewise-linear interpolation on ascending `xs`; clamps outside the range to the end values.
 */
export function interp1(xs: ArrayLike<number>, ys: ArrayLike<number>, x: number): number {
  const n = xs.length;
  if (n === 0) return 0;
  if (x <= xs[0]!) return ys[0]!;
  if (x >= xs[n - 1]!) return ys[n - 1]!;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (xs[m]! <= x) lo = m;
    else hi = m;
  }
  const x0 = xs[lo]!;
  const x1 = xs[hi]!;
  const t = x1 > x0 ? (x - x0) / (x1 - x0) : 0;
  return ys[lo]! + t * (ys[hi]! - ys[lo]!);
}

/**
 * Bilinear interpolation in a rectangular table `z[i][j]` over ascending axes `xs` (rows) and `ys` (columns).
 * Inputs outside the axes are clamped to the table edge.
 */
export function bilinear(
  xs: readonly number[],
  ys: readonly number[],
  z: readonly (readonly number[])[],
  x: number,
  y: number,
): number {
  const xi = clamp(x, xs[0]!, xs[xs.length - 1]!);
  const yi = clamp(y, ys[0]!, ys[ys.length - 1]!);
  let i = 0;
  while (i < xs.length - 2 && xi > xs[i + 1]!) i++;
  let j = 0;
  while (j < ys.length - 2 && yi > ys[j + 1]!) j++;
  const tx = (xi - xs[i]!) / (xs[i + 1]! - xs[i]!);
  const ty = (yi - ys[j]!) / (ys[j + 1]! - ys[j]!);
  const z00 = z[i]![j]!;
  const z01 = z[i]![j + 1]!;
  const z10 = z[i + 1]![j]!;
  const z11 = z[i + 1]![j + 1]!;
  return (1 - tx) * ((1 - ty) * z00 + ty * z01) + tx * ((1 - ty) * z10 + ty * z11);
}

/** Root-mean-square of a sampled signal. */
export function rms(xs: ArrayLike<number>): number {
  let s = 0;
  for (let k = 0; k < xs.length; k++) s += xs[k]! * xs[k]!;
  return xs.length ? Math.sqrt(s / xs.length) : 0;
}

/** Sum of an array. */
export function sum(xs: ArrayLike<number>): number {
  let s = 0;
  for (let k = 0; k < xs.length; k++) s += xs[k]!;
  return s;
}

/** Round to `digits` decimals (display helper, also used to mirror the oracles' rounding). */
export function round(x: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
