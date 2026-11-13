/**
 * `generator-ac` Г5 (step `synchronization`).
 * a) Synchroscope: f_g = p·n/60 (p = 1), Δf = f_g − 50; Δθ(t) = Δθ₀ + 360°·Δf·t wrapped to (−180°, 180°];
 *    Δθ₀ random (seeded). U_g = U_n·ℰ_rel (0,90…1,10), ΔU = (ℰ_rel − 1)·100 %. Soft closing (game limits, wider
 *    than IEEE): |Δθ| ≤ 10°, |Δf| ≤ 0,1 Hz, −2 % ≤ ΔU ≤ +5 %. Bad closing current spike I/I_n ≈ 2·sin(|Δθ|/2)/x''_d,
 *    x''_d = 0,2.
 * b) After closing: P_e = (ℰ·U/X_s)·sin δ, U = 1, X_s = 1,8 (p.u.); (2H/ω_s)·δ̈ = P_m − P_e − D·δ̇/ω_s, H = 5 s,
 *    ω_s = 314,16 rad/s, D = 20; RK4 with 1 ms steps; P_m follows the slider at ≤ 0,2 p.u./s. Out of step if
 *    P_m > P_max or δ passes the unstable equilibrium 180° − arcsin(P_m·X_s/ℰ).
 */
import { DEG, clamp, subStepCount, wrapDeg180 } from '../core/S1-sim/math';
import { toRandomSource, type RandomSource } from '../core/S1-sim/rng';

export const SYNC = {
  gridHz: 50,
  speedRangeRpm: { min: 2900, max: 3100, step: 1, default: 2985 },
  excitationRange: { min: 0.9, max: 1.1, step: 0.005, default: 0.96 },
  limits: { angleDeg: 10, freqHz: 0.1, voltageLowPct: -2, voltageHighPct: 5 },
  ieeeLimits: { angleDeg: 10, freqHz: 0.067, voltageLowPct: 0, voltageHighPct: 5 },
  subtransientReactancePu: 0.2,
} as const;

export interface SynchroscopeState {
  generatorHz: number;
  deltaHz: number;
  /** Synchroscope pointer Δθ, degrees in (−180, 180]. */
  angleDeg: number;
  deltaVoltagePct: number;
  /** Seconds per pointer revolution (Infinity at Δf = 0); sign = direction (+ clockwise / fast). */
  revolutionS: number;
}

export interface CloseResult {
  soft: boolean;
  angleOk: boolean;
  frequencyOk: boolean;
  voltageOk: boolean;
  /** Peak current in multiples of I_n (for the shake / ammeter animation). */
  currentSpikePu: number;
}

export interface Synchroscope {
  readonly state: SynchroscopeState;
  step(dt: number): SynchroscopeState;
  set(params: { speedRpm?: number; excitation?: number }): void;
  close(): CloseResult;
  /** New random initial angle. */
  reset(): void;
}

export const closingCurrentSpikePu = (angleDeg: number): number => (2 * Math.sin((Math.abs(angleDeg) * DEG) / 2)) / SYNC.subtransientReactancePu;

export function createSynchroscope(rng: RandomSource | number = 4, initial: { speedRpm?: number; excitation?: number } = {}): Synchroscope {
  const r = toRandomSource(rng);
  let speed: number = initial.speedRpm ?? SYNC.speedRangeRpm.default;
  let exc: number = initial.excitation ?? SYNC.excitationRange.default;
  let angle = 0;
  const state = {} as SynchroscopeState;
  const publish = (): void => {
    const fg = speed / 60;
    const df = fg - SYNC.gridHz;
    Object.assign(state, { generatorHz: fg, deltaHz: df, angleDeg: angle, deltaVoltagePct: (exc - 1) * 100, revolutionS: df === 0 ? Infinity : 1 / df });
  };
  const reset = (): void => {
    angle = wrapDeg180(360 * r.next() - 180);
    publish();
  };
  reset();
  return {
    state,
    step(dt: number): SynchroscopeState {
      angle = wrapDeg180(angle + 360 * (speed / 60 - SYNC.gridHz) * dt);
      publish();
      return state;
    },
    set(p): void {
      if (p.speedRpm !== undefined) speed = clamp(p.speedRpm, SYNC.speedRangeRpm.min, SYNC.speedRangeRpm.max);
      if (p.excitation !== undefined) exc = clamp(p.excitation, SYNC.excitationRange.min, SYNC.excitationRange.max);
      publish();
    },
    close(): CloseResult {
      const l = SYNC.limits;
      const angleOk = Math.abs(state.angleDeg) <= l.angleDeg;
      const frequencyOk = Math.abs(state.deltaHz) <= l.freqHz + 1e-9;
      const voltageOk = state.deltaVoltagePct >= l.voltageLowPct - 1e-9 && state.deltaVoltagePct <= l.voltageHighPct + 1e-9;
      return { soft: angleOk && frequencyOk && voltageOk, angleOk, frequencyOk, voltageOk, currentSpikePu: closingCurrentSpikePu(state.angleDeg) };
    },
    reset,
  };
}

// ---------------------------------------------------------------- b) load angle dynamics

export const SWING = { gridVPu: 1, reactancePu: 1.8, inertiaS: 5, omegaS: 2 * Math.PI * 50, damping: 20, rampPuPerS: 0.2, stepS: 1e-3, emfRange: { min: 1.5, max: 2.6, step: 0.05, default: 2.2 }, powerRange: { min: 0, max: 1.3, step: 0.01, default: 0.5 } } as const;

export const maxPowerPu = (emfPu: number): number => (emfPu * SWING.gridVPu) / SWING.reactancePu;

/** Stable equilibrium δ = arcsin(P_m·X_s/ℰ) in degrees, or null if P_m > P_max. */
export function equilibriumAngleDeg(mechanicalPu: number, emfPu: number): number | null {
  const x = (mechanicalPu * SWING.reactancePu) / (emfPu * SWING.gridVPu);
  return x > 1 ? null : Math.asin(x) / DEG;
}

export interface SwingState {
  deltaDeg: number;
  /** δ̇, rad/s (electrical). */
  slipRadPerS: number;
  mechanicalPu: number;
  electricalPu: number;
  maxPowerPu: number;
  /** Largest δ reached since the last reset, degrees. */
  maxDeltaDeg: number;
  outOfStep: boolean;
  timeS: number;
}

export interface SwingModel {
  readonly state: SwingState;
  step(dt: number): SwingState;
  set(params: { mechanicalSetpointPu?: number; emfPu?: number }): void;
  /** Re-synchronise at the equilibrium for the current setpoint. */
  reset(): void;
}

export function createSwing(initial: { mechanicalSetpointPu?: number; emfPu?: number } = {}): SwingModel {
  let setpoint: number = initial.mechanicalSetpointPu ?? SWING.powerRange.default;
  let emf: number = initial.emfPu ?? SWING.emfRange.default;
  let pm = setpoint;
  let delta = 0;
  let w = 0;
  let maxDelta = 0;
  let out = false;
  let time = 0;
  const state = {} as SwingState;
  const acc = (d: number, dw: number, p: number): number =>
    ((p - maxPowerPu(emf) * Math.sin(d) - (SWING.damping * dw) / SWING.omegaS) * SWING.omegaS) / (2 * SWING.inertiaS);
  const publish = (): void => {
    Object.assign(state, { deltaDeg: delta / DEG, slipRadPerS: w, mechanicalPu: pm, electricalPu: maxPowerPu(emf) * Math.sin(delta), maxPowerPu: maxPowerPu(emf), maxDeltaDeg: maxDelta / DEG, outOfStep: out, timeS: time });
  };
  const reset = (): void => {
    pm = setpoint;
    const eq = equilibriumAngleDeg(pm, emf);
    delta = (eq ?? 90) * DEG;
    w = 0;
    maxDelta = delta;
    out = eq === null;
    time = 0;
    publish();
  };
  reset();
  return {
    state,
    step(dt: number): SwingState {
      if (out) return state;
      const n = subStepCount(dt, SWING.stepS, 100);
      const h = dt / Math.max(n, 1);
      for (let k = 0; k < n && !out; k++) {
        const ramp = (t: number): number => {
          const diff = setpoint - pm;
          const lim = SWING.rampPuPerS * t;
          return pm + clamp(diff, -lim, lim);
        };
        const p0 = pm;
        const pHalf = ramp(h / 2);
        const p1 = ramp(h);
        const k1d = w;
        const k1w = acc(delta, w, p0);
        const k2d = w + (h / 2) * k1w;
        const k2w = acc(delta + (h / 2) * k1d, w + (h / 2) * k1w, pHalf);
        const k3d = w + (h / 2) * k2w;
        const k3w = acc(delta + (h / 2) * k2d, w + (h / 2) * k2w, pHalf);
        const k4d = w + h * k3w;
        const k4w = acc(delta + h * k3d, w + h * k3w, p1);
        delta += (h / 6) * (k1d + 2 * k2d + 2 * k3d + k4d);
        w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
        pm = p1;
        time += h;
        maxDelta = Math.max(maxDelta, delta);
        const eq = equilibriumAngleDeg(pm, emf);
        if (eq === null || delta > Math.PI - eq * DEG) out = true;
      }
      publish();
      return state;
    },
    set(p): void {
      if (p.mechanicalSetpointPu !== undefined) setpoint = clamp(p.mechanicalSetpointPu, SWING.powerRange.min, SWING.powerRange.max);
      if (p.emfPu !== undefined) emf = clamp(p.emfPu, SWING.emfRange.min, SWING.emfRange.max);
      publish();
    },
    reset,
  };
}
