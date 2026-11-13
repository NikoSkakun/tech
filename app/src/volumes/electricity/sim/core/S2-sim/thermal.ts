/**
 * Thermal models: first-order body (exact exponential update — stable for any dt), cable heating (IEC 60364-5-52
 * style: rise ∝ (I/I_z)²), transformer top-oil steady state (IEC 60076-7 form).
 */

/** Exact update of dx/dt = (target − x)/τ over dt for a constant target. */
export function firstOrderStep(x: number, target: number, tauS: number, dtS: number): number {
  if (!(dtS > 0)) return x;
  if (!(tauS > 0)) return target;
  return target + (x - target) * Math.exp(-dtS / tauS);
}

/**
 * Time [s] for a first-order body starting at x0 and heading to `target` to reach `threshold`
 * (0 if already there, Infinity if never): t = −τ·ln((target − threshold)/(target − x0)).
 */
export function firstOrderCrossingTimeS(x0: number, target: number, tauS: number, threshold: number): number {
  if (x0 >= threshold) return 0;
  if (target <= threshold) return Infinity;
  return -tauS * Math.log((target - threshold) / (target - x0));
}

/** Generic first-order thermal body for scenes: { state, step(dt), set(target), reset() }. */
export interface FirstOrderBody {
  readonly value: number;
  readonly target: number;
  step(dtS: number): void;
  setTarget(target: number): void;
  reset(value?: number): void;
}

export function createFirstOrderBody(initial: number, tauS: number): FirstOrderBody {
  let value = initial;
  let target = initial;
  return {
    get value() {
      return value;
    },
    get target() {
      return target;
    },
    step(dtS) {
      value = firstOrderStep(value, target, tauS, dtS);
    },
    setTarget(t) {
      if (Number.isFinite(t)) target = t;
    },
    reset(v = initial) {
      value = v;
      target = v;
    },
  };
}

/** Steady temperature with a rise ∝ (I/I_ref)²: θ = θ_amb + ΔT_n·(I/I_ref)². */
export function steadyTempC(ambientC: number, ratedRiseK: number, currentA: number, refCurrentA: number): number {
  const k = refCurrentA > 0 ? currentA / refCurrentA : 0;
  return ambientC + ratedRiseK * k * k;
}

/**
 * Transformer top-oil steady temperature: θ = θ_amb + Δθ_or·((1 + R·β²)/(1 + R))^n
 * (R = load-loss/no-load-loss ratio, n = 0,8 for ONAN). Defaults of `transformer` Т3 as quoted by `distribution`
 * step 3: θ_amb 20 °C, Δθ_or 55 K, R = 5.
 */
export function transformerTopOilC(loadFactor: number, ambientC = 20, ratedRiseK = 55, lossRatio = 5, exponent = 0.8): number {
  const b = Math.max(0, loadFactor);
  return ambientC + ratedRiseK * ((1 + lossRatio * b * b) / (1 + lossRatio)) ** exponent;
}
