/**
 * `magnetism` М7 (step `inductance`): ideal source U = 12 V; branch 1: R = 10 Ω (lamp L1 + resistor);
 * branch 2: R = 10 Ω (lamp L2 + winding) in series with L = 1 H (iron core) or 5 mH (air). Lamps linear,
 * brightness ∝ I².
 * S1 on: I₁ = U/R at once, I₂ → U/R with τ = L/R. S1 off (S2 closed): the coil current circulates through both
 * branches (2R): I₂ = I₀e^(−t/τ'), τ' = L/(2R), I₁ = −I₂, |u_L| = 2R·I₂ ≤ 24 V (no spark, neon dark).
 * S2 opened (S1 on) within Δt: coil current falls linearly to 0, ℰ = L·I₀/Δt (display ≤ 2000 V); neon flashes
 * if ℰ > 80 V for Δt + 30 ms; L1 stays lit. Exponentials are applied exactly per step (stable for any dt).
 */
import { clamp } from '../core/S1-sim/math';

export const RL = {
  sourceV: 12,
  branchOhm: 10,
  coreH: 1,
  airH: 0.005,
  neonStrikeV: 80,
  neonExtraS: 0.03,
  displayLimitV: 2000,
  breakTimeRangeS: { min: 1e-4, max: 1e-2, step: 1e-4, default: 1e-3 },
} as const;

export interface RlParams {
  s1On: boolean;
  /** Coil branch connected (S2 closed). */
  s2Closed: boolean;
  ironCore: boolean;
  /** Opening time of S2, s. */
  breakTimeS: number;
}

export interface RlState {
  i1A: number;
  i2A: number;
  /** Voltage across the inductance, V (signed). */
  inductorV: number;
  /** Peak EMF of the last S2 break (unclamped), V, and the displayed value. */
  breakEmfV: number;
  breakEmfDisplayV: number;
  neonLit: boolean;
  spark: boolean;
  /** Stored energy L·I₂²/2, J. */
  storedJ: number;
  inductanceH: number;
  /** Brightness ∝ I² normalised to (U/R)². */
  lamp1: number;
  lamp2: number;
}

export interface RlCircuit {
  readonly state: RlState;
  readonly params: RlParams;
  step(dt: number): RlState;
  set(params: Partial<RlParams>): void;
}

export function createRlCircuit(initial: Partial<RlParams> = {}): RlCircuit {
  const params: RlParams = { s1On: false, s2Closed: true, ironCore: true, breakTimeS: RL.breakTimeRangeS.default, ...initial };
  const state = {} as RlState;
  let i2 = 0;
  let uL = 0;
  let breaking: { i0: number; remaining: number } | null = null;
  let neonTimer = 0;
  let lastBreak = 0;
  const L = (): number => (params.ironCore ? RL.coreH : RL.airH);
  const R = RL.branchOhm;
  const iMax = RL.sourceV / R;

  const publish = (): void => {
    const i1 = params.s1On ? RL.sourceV / R : params.s2Closed ? -i2 : 0;
    Object.assign(state, {
      i1A: i1,
      i2A: i2,
      inductorV: uL,
      breakEmfV: lastBreak,
      breakEmfDisplayV: Math.min(lastBreak, RL.displayLimitV),
      neonLit: neonTimer > 0,
      spark: breaking !== null,
      storedJ: 0.5 * L() * i2 * i2,
      inductanceH: L(),
      lamp1: (i1 / iMax) ** 2,
      lamp2: (i2 / iMax) ** 2,
    });
  };

  publish();
  return {
    state,
    params,
    step(dt: number): RlState {
      const h = Math.max(dt, 0);
      neonTimer = Math.max(neonTimer - h, 0);
      if (breaking) {
        const t = Math.min(h, breaking.remaining);
        i2 = Math.max(i2 - (breaking.i0 / params.breakTimeS) * t, 0);
        breaking.remaining -= t;
        uL = -lastBreak;
        if (breaking.remaining <= 0) {
          breaking = null;
          i2 = 0;
          uL = 0;
        }
      } else if (!params.s2Closed) {
        i2 = 0;
        uL = 0;
      } else if (params.s1On) {
        const tau = L() / R;
        const target = RL.sourceV / R;
        i2 = target + (i2 - target) * Math.exp(-h / tau);
        uL = RL.sourceV - R * i2;
      } else {
        i2 *= Math.exp((-h * 2 * R) / L());
        uL = -2 * R * i2;
      }
      publish();
      return state;
    },
    set(next: Partial<RlParams>): void {
      const wasClosed = params.s2Closed;
      Object.assign(params, next);
      params.breakTimeS = clamp(params.breakTimeS, RL.breakTimeRangeS.min, RL.breakTimeRangeS.max);
      if (wasClosed && !params.s2Closed && i2 > 0) {
        lastBreak = (L() * i2) / params.breakTimeS;
        breaking = { i0: i2, remaining: params.breakTimeS };
        if (lastBreak > RL.neonStrikeV) neonTimer = params.breakTimeS + RL.neonExtraS;
      }
      publish();
    },
  };
}
