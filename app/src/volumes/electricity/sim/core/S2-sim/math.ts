/**
 * Small numeric helpers shared by the S2-sim models (pure, allocation-light, no dependencies).
 */

/** Clamp `x` into [lo, hi]. NaN is mapped to `lo` so that a bad input never propagates. */
export function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  return x < lo ? lo : x > hi ? hi : x;
}

/** Linear interpolation a → b by t ∈ [0, 1] (not clamped). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Piecewise-linear interpolation through the points (xs[i], ys[i]); xs must be strictly increasing.
 * Outside the range the end values are held (no extrapolation).
 */
export function interp1(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length;
  if (n === 0) return Number.NaN;
  if (x <= xs[0]!) return ys[0]!;
  if (x >= xs[n - 1]!) return ys[n - 1]!;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - xs[lo]!) / (xs[hi]! - xs[lo]!);
  return lerp(ys[lo]!, ys[hi]!, t);
}

/**
 * Bisection root of a monotonically non-decreasing `g` on [lo, hi] for g(x) = target.
 * Returns hi if g(hi) < target (saturated) and lo if g(lo) ≥ target.
 */
export function bisect(g: (x: number) => number, target: number, lo: number, hi: number, iterations = 60): number {
  if (g(lo) >= target) return lo;
  if (g(hi) < target) return hi;
  let a = lo;
  let b = hi;
  for (let i = 0; i < iterations; i++) {
    const m = 0.5 * (a + b);
    if (g(m) < target) a = m;
    else b = m;
  }
  return 0.5 * (a + b);
}

/** Round to `digits` decimal places (for display-oriented derived values; never used inside integrators). */
export function roundTo(x: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(x * k) / k;
}

/**
 * Solve the dense linear system A·x = b by Gaussian elimination with partial pivoting.
 * A is given row-major as number[][] and is not modified. Throws on a singular matrix.
 */
export function solveLinear(A: readonly (readonly number[])[], b: readonly number[]): number[] {
  const n = b.length;
  const m = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[piv]![col]!)) piv = r;
    if (Math.abs(m[piv]![col]!) < 1e-14) throw new Error('solveLinear: singular matrix');
    if (piv !== col) [m[piv], m[col]] = [m[col]!, m[piv]!];
    const rowC = m[col]!;
    for (let r = col + 1; r < n; r++) {
      const row = m[r]!;
      const f = row[col]! / rowC[col]!;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) row[c]! -= f * rowC[c]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    const row = m[r]!;
    let s = row[n]!;
    for (let c = r + 1; c < n; c++) s -= row[c]! * x[c]!;
    x[r] = s / row[r]!;
  }
  return x;
}

/** Seeded PRNG (mulberry32) → uniform [0, 1). Deterministic for QA; never use Math.random in models. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample from a uniform generator (Box–Muller). */
export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Fixed-step accumulator: converts arbitrary frame `dt` into whole internal steps of `h`, carrying the
 * remainder, so a time-domain model gives identical results whatever the frame rate (deterministic QA).
 */
export class FixedStepper {
  private acc = 0;
  constructor(public readonly h: number) {}
  /** Number of whole internal steps to run for this frame. */
  advance(dt: number): number {
    if (!(dt > 0) || !Number.isFinite(dt)) return 0;
    this.acc += dt;
    const n = Math.floor(this.acc / this.h + 1e-9);
    this.acc -= n * this.h;
    if (this.acc < 0) this.acc = 0;
    return n;
  }
  reset(): void {
    this.acc = 0;
  }
}
