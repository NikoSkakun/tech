/**
 * Closed-form first- and second-order transients (RC, RL, series RLC) — exact solutions, so they are
 * stable for any dt and used both directly and as test oracles for stepped models.
 */

/** Generic first-order response x(t) = x∞ + (x₀ − x∞)·e^(−t/τ). */
export function firstOrder(x0: number, xInf: number, tauS: number, tS: number): number {
  if (!(tauS > 0)) return xInf;
  return xInf + (x0 - xInf) * Math.exp(-Math.max(tS, 0) / tauS);
}

/** RC discharge U(t) = U₀·e^(−t/RC). */
export function rcDischarge(u0V: number, resistanceOhm: number, capacitanceF: number, tS: number): number {
  return firstOrder(u0V, 0, resistanceOhm * capacitanceF, tS);
}

/** RC charge from U₀ towards the source voltage U_s: U(t) = U_s + (U₀ − U_s)·e^(−t/RC). */
export function rcCharge(sourceV: number, u0V: number, resistanceOhm: number, capacitanceF: number, tS: number): number {
  return firstOrder(u0V, sourceV, resistanceOhm * capacitanceF, tS);
}

/** RL current rise towards U/R: I(t) = (U/R)·(1 − e^(−t·R/L)) (from I₀ = 0 unless given). */
export function rlRise(sourceV: number, resistanceOhm: number, inductanceH: number, tS: number, i0A = 0): number {
  return firstOrder(i0A, sourceV / resistanceOhm, inductanceH / resistanceOhm, tS);
}

/** RL decay I(t) = I₀·e^(−t·R/L). */
export function rlDecay(i0A: number, resistanceOhm: number, inductanceH: number, tS: number): number {
  return firstOrder(i0A, 0, inductanceH / resistanceOhm, tS);
}

export type DampingRegime = 'underdamped' | 'critical' | 'overdamped';

export interface SeriesRlcStep {
  /** Loop current i(t), A. */
  currentA: number;
  /** Capacitor voltage u_C(t), V. */
  capacitorV: number;
  regime: DampingRegime;
  /** Damping α = R/(2L), 1/s. */
  alpha: number;
  /** Undamped natural angular frequency ω₀ = 1/√(LC), rad/s. */
  omega0: number;
}

/**
 * Series RLC connected at t = 0 to a DC step `stepV`, from rest (i = 0, u_C = 0).
 * L·di/dt + R·i + u_C = U, C·du_C/dt = i. Characteristic s² + 2α·s + ω₀² = 0.
 */
export function seriesRlcStep(params: { resistanceOhm: number; inductanceH: number; capacitanceF: number; stepV: number }, tS: number): SeriesRlcStep {
  const { resistanceOhm: R, inductanceH: L, capacitanceF: C, stepV: U } = params;
  const t = Math.max(tS, 0);
  const alpha = R / (2 * L);
  const omega0 = 1 / Math.sqrt(L * C);
  const disc = alpha * alpha - omega0 * omega0;
  const rel = disc / (omega0 * omega0);
  if (Math.abs(rel) < 1e-9) {
    // critical: i = (U/L)·t·e^(−αt); u_C = U·(1 − (1 + αt)·e^(−αt))
    const e = Math.exp(-alpha * t);
    return { currentA: (U / L) * t * e, capacitorV: U * (1 - (1 + alpha * t) * e), regime: 'critical', alpha, omega0 };
  }
  if (disc < 0) {
    const wd = Math.sqrt(-disc);
    const e = Math.exp(-alpha * t);
    const i = (U / (L * wd)) * e * Math.sin(wd * t);
    const uc = U * (1 - e * (Math.cos(wd * t) + (alpha / wd) * Math.sin(wd * t)));
    return { currentA: i, capacitorV: uc, regime: 'underdamped', alpha, omega0 };
  }
  const s = Math.sqrt(disc);
  const s1 = -alpha + s;
  const s2 = -alpha - s;
  const e1 = Math.exp(s1 * t);
  const e2 = Math.exp(s2 * t);
  const i = (U / (L * (s1 - s2))) * (e1 - e2);
  const uc = U * (1 - (s1 * e2 - s2 * e1) / (s1 - s2));
  return { currentA: i, capacitorV: uc, regime: 'overdamped', alpha, omega0 };
}
