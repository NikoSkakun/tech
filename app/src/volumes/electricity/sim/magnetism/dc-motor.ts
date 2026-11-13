/**
 * `magnetism` М4 (step `dc-motor`). Coil constant k = N·B·A = 50·0,3·0,0012 = 0,018 V·s/rad, R = 2 Ω (no L),
 * J = 2×10⁻⁵ kg·m².
 * Commutator (averaged, instruments and tests): k̄ = (2/π)·k; I = (U − k̄ω)/R; J·dω/dt = k̄I − bω − τ_load·sign ω,
 * b = 10⁻⁶ N·m·s; stuck if |ω| < 0,5 rad/s and k̄|I| ≤ τ_load (then I = U/R). Steady: ω = (U − IR)/k̄, I = τ/k̄.
 * Slip rings (instantaneous): k(θ) = k·sin θ, I = (U − k(θ)ω)/R, J·dω/dt = k(θ)·I − b₂ω, b₂ = 5×10⁻⁵ — the coil
 * swings around θ = π (U > 0) at ≈ 8 Hz and stops. Semi-implicit Euler, sub-steps ≤ 0,5 ms (the document’s
 * "≤ 40 per frame" holds at 60 fps; a 1/30 s frame needs 67, capped at 80).
 */
import { clamp, radPerSToRpm, subStepCount, wrapRad2Pi } from '../core/S1-sim/math';

export const DC_MOTOR = {
  coilConstant: 50 * 0.3 * 0.0012,
  resistanceOhm: 2,
  inertiaKgM2: 2e-5,
  frictionNms: 1e-6,
  slipRingFrictionNms: 5e-5,
  stictionRadPerS: 0.5,
  voltageRange: { min: 0, max: 12, step: 0.5, default: 6 },
  loadRange: { min: 0, max: 0.03, step: 0.001, default: 0.005 },
} as const;
/** k̄ = (2/π)·k = 0,011459 V·s/rad. */
export const AVERAGED_CONSTANT = (2 / Math.PI) * DC_MOTOR.coilConstant;

export interface MotorParams {
  voltageV: number;
  loadTorqueNm: number;
  mode: 'commutator' | 'slipRings';
  /** «Заклинити вал» held. */
  jammed: boolean;
}

export interface MotorState {
  angleRad: number;
  omegaRadPerS: number;
  speedRpm: number;
  currentA: number;
  backEmfV: number;
  torqueNm: number;
  mechanicalPowerW: number;
  efficiency: number;
  stalled: boolean;
  /** Brush spark (commutator) at sin θ ≈ 0. */
  spark: boolean;
}

/** Steady state of the averaged model (b neglected): returns null when the motor cannot start/keep turning. */
export function motorSteadyState(voltageV: number, loadTorqueNm: number): { currentA: number; omegaRadPerS: number; speedRpm: number; mechanicalPowerW: number; efficiency: number } | null {
  const kb = AVERAGED_CONSTANT;
  const i = loadTorqueNm / kb;
  const w = (voltageV - i * DC_MOTOR.resistanceOhm) / kb;
  if (w <= 0) return null;
  const p = loadTorqueNm * w;
  return { currentA: i, omegaRadPerS: w, speedRpm: radPerSToRpm(w), mechanicalPowerW: p, efficiency: voltageV * i > 0 ? p / (voltageV * i) : 0 };
}

/** Starting torque k̄·U/R, N·m. */
export const startingTorqueNm = (voltageV: number): number => (AVERAGED_CONSTANT * voltageV) / DC_MOTOR.resistanceOhm;

export interface DcMotor {
  readonly state: MotorState;
  readonly params: MotorParams;
  step(dt: number): MotorState;
  set(params: Partial<MotorParams>): void;
  reset(): void;
}

export function createDcMotor(initial: Partial<MotorParams> = {}): DcMotor {
  const params: MotorParams = { voltageV: DC_MOTOR.voltageRange.default, loadTorqueNm: DC_MOTOR.loadRange.default, mode: 'commutator', jammed: false, ...initial };
  const state = {} as MotorState;
  let theta = 0.3;
  let omega = 0;
  let current = 0;
  let stalled = true;
  const R = DC_MOTOR.resistanceOhm;
  const J = DC_MOTOR.inertiaKgM2;

  const publish = (): void => {
    const kb = params.mode === 'commutator' ? AVERAGED_CONSTANT : DC_MOTOR.coilConstant * Math.sin(theta);
    const torque = kb * current;
    const pm = params.mode === 'commutator' ? params.loadTorqueNm * Math.abs(omega) : 0;
    const pin = params.voltageV * current;
    Object.assign(state, {
      angleRad: theta,
      omegaRadPerS: omega,
      speedRpm: radPerSToRpm(omega),
      currentA: current,
      backEmfV: kb * omega,
      torqueNm: torque,
      mechanicalPowerW: pm,
      efficiency: pin > 0 ? pm / pin : 0,
      stalled,
      spark: params.mode === 'commutator' && Math.abs(omega) > 1 && Math.abs(Math.sin(theta)) < 0.08,
    });
  };

  const sub = (h: number): void => {
    const U = clamp(params.voltageV, DC_MOTOR.voltageRange.min, DC_MOTOR.voltageRange.max);
    if (params.jammed) {
      omega = 0;
      current = U / R;
      stalled = true;
      return;
    }
    if (params.mode === 'commutator') {
      const kb = AVERAGED_CONSTANT;
      current = (U - kb * omega) / R;
      const tl = params.loadTorqueNm;
      if (Math.abs(omega) < DC_MOTOR.stictionRadPerS && kb * Math.abs(current) <= tl) {
        omega = 0;
        current = U / R;
        stalled = true;
        return;
      }
      stalled = false;
      const acc = (kb * current - DC_MOTOR.frictionNms * omega - tl * Math.sign(omega || current)) / J;
      omega += acc * h;
    } else {
      const kt = DC_MOTOR.coilConstant * Math.sin(theta);
      current = (U - kt * omega) / R;
      omega += ((kt * current - DC_MOTOR.slipRingFrictionNms * omega) / J) * h;
      stalled = Math.abs(omega) < 1e-3;
    }
    theta = wrapRad2Pi(theta + omega * h);
  };

  publish();
  return {
    state,
    params,
    step(dt: number): MotorState {
      const n = subStepCount(dt, 5e-4, 80);
      const h = dt / Math.max(n, 1);
      for (let k = 0; k < n; k++) sub(h);
      publish();
      return state;
    },
    set(next: Partial<MotorParams>): void {
      Object.assign(params, next);
      publish();
    },
    reset(): void {
      theta = 0.3;
      omega = 0;
      current = 0;
      stalled = true;
      publish();
    },
  };
}
