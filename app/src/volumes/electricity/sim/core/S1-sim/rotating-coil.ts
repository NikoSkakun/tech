/**
 * Rotating coil in a uniform field — shared by `magnetism` М8 (step `to-generator`) and `generator-ac` Г1
 * (step `rotating-loop`): e(t) = N·B·A·ω·sin θ, θ = ∫ω dt, ω = 2π·n/60. With a commutator the output is
 * rectified |e|. A lamp R_l = 50 Ω is the load (М8: P = ℰ²/R_l, Lenz braking torque τ = ℰ·I/ω).
 *
 * Drive modes: `speed` (slider n, rpm — generator-ac) or `hand` (crank with flywheel inertia: the scene feeds
 * the cursor's angular speed while dragging; on release the flywheel coasts down under Lenz braking and
 * bearing friction; capped at 600 rpm — magnetism step 11).
 */
import { clamp, radPerSToRpm, rpmToRadPerS, subStepCount, wrapRad2Pi } from './math';

export type CoilOutput = 'slipRings' | 'commutator';

export interface RotatingCoilParams {
  /** Turns N (generator-ac slider 10…200, default 100). */
  turns: number;
  /** Flux density B, T (0,1…1, default 0,5). */
  fieldT: number;
  /** Coil area A, m² (0,01). */
  areaM2: number;
  /** Load (lamp) resistance R_l, Ω (50). */
  loadOhm: number;
  output: CoilOutput;
  /** `speed`: constant rpm from a slider; `hand`: flywheel driven by the cursor. */
  drive: 'speed' | 'hand';
  /** Slider speed n for `speed` drive, rpm (0…3600). */
  speedRpm: number;
  /** Cursor angular speed while dragging the crank (rpm), or null when released (hand drive). */
  handRpm: number | null;
  /** Hand-drive speed limit, rpm (600). */
  handLimitRpm: number;
  /** Flywheel moment of inertia J, kg·m² (scenic, 5×10⁻³). */
  inertiaKgM2: number;
  /** Bearing viscous friction, N·m·s (scenic). */
  frictionNms: number;
  /** Time constant with which the crank follows the cursor while dragging, s. */
  gripTauS: number;
}

export const ROTATING_COIL_DEFAULTS: RotatingCoilParams = {
  turns: 100,
  fieldT: 0.5,
  areaM2: 0.01,
  loadOhm: 50,
  output: 'slipRings',
  drive: 'speed',
  speedRpm: 600,
  handRpm: null,
  handLimitRpm: 600,
  inertiaKgM2: 5e-3,
  frictionNms: 2e-4,
  gripTauS: 0.15,
};

/** Steady-state readouts for a given speed. */
export function rotatingCoilReadouts(p: Pick<RotatingCoilParams, 'turns' | 'fieldT' | 'areaM2'>, speedRpm: number): {
  omegaRadPerS: number;
  frequencyHz: number;
  periodS: number;
  emfMaxV: number;
  emfRmsV: number;
} {
  const w = rpmToRadPerS(speedRpm);
  const emfMax = p.turns * p.fieldT * p.areaM2 * w;
  const f = speedRpm / 60;
  return { omegaRadPerS: w, frequencyHz: f, periodS: f > 0 ? 1 / f : Infinity, emfMaxV: emfMax, emfRmsV: emfMax / Math.SQRT2 };
}

export interface RotatingCoilState {
  /** Coil angle θ, rad in [0, 2π); θ = 0 → coil plane ⟂ B (maximum flux, zero EMF). */
  angleRad: number;
  omegaRadPerS: number;
  speedRpm: number;
  frequencyHz: number;
  /** Instantaneous output EMF (|e| with commutator), V. */
  emfV: number;
  /** Amplitude N·B·A·ω, V. */
  emfMaxV: number;
  /** Flux linkage N·B·A·cos θ, Wb. */
  fluxLinkageWb: number;
  currentA: number;
  lampPowerW: number;
  /** Lenz braking torque τ = e·i/ω, N·m (0 at standstill). */
  brakingTorqueNm: number;
  timeS: number;
}

export interface RotatingCoilModel {
  readonly state: RotatingCoilState;
  readonly params: RotatingCoilParams;
  step(dt: number): RotatingCoilState;
  set(params: Partial<RotatingCoilParams>): void;
  reset(): void;
}

export function createRotatingCoil(initial: Partial<RotatingCoilParams> = {}): RotatingCoilModel {
  const params: RotatingCoilParams = { ...ROTATING_COIL_DEFAULTS, ...initial };
  const state = {} as RotatingCoilState;
  let theta = 0;
  let omega = 0;
  let time = 0;

  const instantaneous = (th: number, w: number): { e: number; i: number; tq: number } => {
    const raw = params.turns * params.fieldT * params.areaM2 * w * Math.sin(th);
    const e = params.output === 'commutator' ? Math.abs(raw) : raw;
    const i = e / params.loadOhm;
    // Mechanical power absorbed = e·i (independent of commutator sign), τ = P/ω.
    const tq = Math.abs(w) > 1e-9 ? (raw * raw) / params.loadOhm / w : 0;
    return { e, i, tq };
  };

  const publish = (): void => {
    const { e, i, tq } = instantaneous(theta, omega);
    const nba = params.turns * params.fieldT * params.areaM2;
    state.angleRad = theta;
    state.omegaRadPerS = omega;
    state.speedRpm = radPerSToRpm(omega);
    state.frequencyHz = omega / (2 * Math.PI);
    state.emfV = e;
    state.emfMaxV = nba * Math.abs(omega);
    state.fluxLinkageWb = nba * Math.cos(theta);
    state.currentA = i;
    state.lampPowerW = e * i;
    state.brakingTorqueNm = tq;
    state.timeS = time;
  };

  const reset = (): void => {
    theta = 0;
    time = 0;
    omega = params.drive === 'speed' ? rpmToRadPerS(clamp(params.speedRpm, 0, 3600)) : 0;
    publish();
  };

  reset();
  return {
    state,
    params,
    step(dt: number): RotatingCoilState {
      const n = subStepCount(dt, 1e-3, 100);
      const h = dt / Math.max(n, 1);
      for (let k = 0; k < n; k++) {
        if (params.drive === 'speed') {
          omega = rpmToRadPerS(clamp(params.speedRpm, 0, 3600));
        } else {
          const limit = rpmToRadPerS(params.handLimitRpm);
          if (params.handRpm !== null) {
            const target = clamp(rpmToRadPerS(params.handRpm), -limit, limit);
            omega += ((target - omega) * h) / params.gripTauS;
          } else {
            const { tq } = instantaneous(theta, omega);
            const decel = (tq + params.frictionNms * omega) / params.inertiaKgM2;
            const next = omega - decel * h;
            omega = Math.sign(next) !== Math.sign(omega) ? 0 : next;
          }
          omega = clamp(omega, -limit, limit);
        }
        theta = wrapRad2Pi(theta + omega * h);
        time += h;
      }
      publish();
      return state;
    },
    set(next: Partial<RotatingCoilParams>): void {
      const driveChanged = next.drive !== undefined && next.drive !== params.drive;
      Object.assign(params, next);
      if (driveChanged && params.drive === 'hand') omega = Math.min(omega, rpmToRadPerS(params.handLimitRpm));
      publish();
    },
    reset,
  };
}
