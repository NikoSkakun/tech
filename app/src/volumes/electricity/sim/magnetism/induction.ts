/**
 * `magnetism` М5 (step `induction`): magnet = dipole m = B_r·V/μ₀ (NdFeB Ø10×10 mm B_r = 1,4 T → 0,875 A·m²;
 * ferrite 0,4 T → 0,25 A·m²); thin coil of N turns, radius a = 0,015 m.
 * Φ(z) = μ₀·m·a²/(2·(a² + z²)^{3/2}); ℰ = −N·dΦ/dt = N·(3/2)·μ₀·m·a²·z·v/(a² + z²)^{5/2} (z = magnet position
 * relative to the coil centre, v = dz/dt smoothed with a 30 ms filter). |ℰ| max at z = ±a/2.
 * Galvanometer φ̈ = ω_n²(K·ℰ − φ) − 2ζω_nφ̇, ω_n = 2π·2 rad/s, ζ = 0,7, full scale at |ℰ| = 2 V.
 * LED lights at ℰ ≥ 1,8 V (one polarity), brightness ∝ ℰ − 1,8 V. «Автомат»: free fall from z = +10 cm.
 * Drag range z = −10…+10 cm, speed limited to 6 m/s.
 */
import { GRAVITY_M_PER_S2, MU_0_H_PER_M } from '../core/S1-sim/constants';
import { dipoleFluxThroughLoop } from '../core/S1-sim/field';
import { clamp, subStepCount } from '../core/S1-sim/math';
import { createFollower } from '../core/S1-sim/oscillator';

export const INDUCTION = {
  coilRadiusM: 0.015,
  magnetVolumeM3: 7.854e-7,
  remanenceT: { neodymium: 1.4, ferrite: 0.4 },
  turnsRange: { min: 50, max: 1000, step: 50, default: 200 },
  zRangeM: { min: -0.1, max: 0.1 },
  maxSpeedMPerS: 6,
  velocityFilterS: 0.03,
  galvanometer: { omegaN: 2 * Math.PI * 2, zeta: 0.7, fullScaleV: 2 },
  ledThresholdV: 1.8,
  autoDropHeightM: 0.1,
} as const;

export type MagnetGrade = keyof typeof INDUCTION.remanenceT;

export const magnetMoment = (grade: MagnetGrade): number => (INDUCTION.remanenceT[grade] * INDUCTION.magnetVolumeM3) / MU_0_H_PER_M;

/** Flux through one turn, Wb. */
export const coilFlux = (grade: MagnetGrade, zM: number): number => dipoleFluxThroughLoop(magnetMoment(grade), INDUCTION.coilRadiusM, zM);

/** ℰ = N·(3/2)·μ₀·m·a²·z·v/(a² + z²)^{5/2}, V (sign: positive for a magnet leaving upward, see М5). */
export function inducedEmf(grade: MagnetGrade, turns: number, zM: number, vMPerS: number): number {
  const a = INDUCTION.coilRadiusM;
  return (turns * 1.5 * MU_0_H_PER_M * magnetMoment(grade) * a * a * zM * vMPerS) / Math.pow(a * a + zM * zM, 2.5);
}

/** Peak |ℰ| for a constant speed v (at z = ±a/2). */
export const peakEmf = (grade: MagnetGrade, turns: number, vMPerS: number): number => Math.abs(inducedEmf(grade, turns, INDUCTION.coilRadiusM / 2, vMPerS));

export interface InductionParams {
  turns: number;
  grade: MagnetGrade;
}

export interface InductionState {
  /** Relative position magnet − coil, m. */
  zM: number;
  /** Smoothed relative velocity, m/s. */
  vMPerS: number;
  fluxWb: number;
  emfV: number;
  /** Galvanometer deflection, −1…1 of full scale (may overshoot slightly). */
  needle: number;
  ledBrightness: number;
  autoDropping: boolean;
  timeS: number;
}

export interface InductionModel {
  readonly state: InductionState;
  /** Drag: relative position each frame (magnet or coil moved — only z_rel matters). */
  drag(zM: number, dt: number): InductionState;
  /** «Автомат»: start a free fall from +10 cm. */
  startAutoDrop(): void;
  /** Advance auto-drop (or relax when idle). */
  step(dt: number): InductionState;
  set(params: Partial<InductionParams>): void;
}

export function createInduction(initial: Partial<InductionParams> = {}): InductionModel {
  const p: InductionParams = { turns: INDUCTION.turnsRange.default, grade: 'neodymium', ...initial };
  const g = INDUCTION.galvanometer;
  const needle = createFollower({ omegaN: g.omegaN, zeta: g.zeta });
  const state: InductionState = { zM: INDUCTION.zRangeM.max, vMPerS: 0, fluxWb: 0, emfV: 0, needle: 0, ledBrightness: 0, autoDropping: false, timeS: 0 };
  let rawV = 0;
  const readouts = (dt: number): void => {
    state.fluxWb = coilFlux(p.grade, state.zM);
    state.emfV = inducedEmf(p.grade, p.turns, state.zM, state.vMPerS);
    state.needle = needle.step(state.emfV / g.fullScaleV, dt);
    state.ledBrightness = state.emfV >= INDUCTION.ledThresholdV ? state.emfV - INDUCTION.ledThresholdV : 0;
    state.timeS += dt;
  };
  const publish = (dt: number): void => {
    // first-order 30 ms smoothing of the drag velocity (М5)
    state.vMPerS += (rawV - state.vMPerS) * (dt > 0 ? 1 - Math.exp(-dt / INDUCTION.velocityFilterS) : 1);
    readouts(dt);
  };
  return {
    state,
    drag(zM: number, dt: number): InductionState {
      state.autoDropping = false;
      const z = clamp(zM, INDUCTION.zRangeM.min, INDUCTION.zRangeM.max);
      rawV = dt > 0 ? clamp((z - state.zM) / dt, -INDUCTION.maxSpeedMPerS, INDUCTION.maxSpeedMPerS) : 0;
      state.zM = dt > 0 ? state.zM + rawV * dt : z;
      publish(dt);
      return state;
    },
    startAutoDrop(): void {
      state.autoDropping = true;
      state.zM = INDUCTION.autoDropHeightM;
      state.vMPerS = 0;
      rawV = 0;
    },
    step(dt: number): InductionState {
      if (!state.autoDropping) {
        rawV = 0;
        publish(dt);
        return state;
      }
      const n = subStepCount(dt, 1e-3, 100);
      const h = dt / Math.max(n, 1);
      for (let k = 0; k < n; k++) {
        rawV -= GRAVITY_M_PER_S2 * h; // falling: z decreases
        state.zM += rawV * h;
        if (state.zM <= INDUCTION.zRangeM.min) {
          state.zM = INDUCTION.zRangeM.min;
          state.autoDropping = false;
          rawV = 0;
          break;
        }
      }
      state.vMPerS = rawV; // free fall is smooth: no filter lag
      readouts(dt);
      return state;
    },
    set(next: Partial<InductionParams>): void {
      Object.assign(p, next);
    },
  };
}
