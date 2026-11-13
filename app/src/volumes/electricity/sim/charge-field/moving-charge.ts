/**
 * Moving test charge on the table plane:
 * - `field` step (§3): released probe, m·a = q·E, frictionless, velocity-Verlet, scenic q/m chosen so that
 *   the motion lasts 2–4 s for the presets;
 * - `potential` step (§4): ball on the potential landscape, m·a = q·E⃗ − γ·v (soft field ε = 5 mm; q/m = 10⁻⁵ C/kg, γ/m = 2 s⁻¹), stops
 *   ("sits in the well") when it gets within ε of a charge, and settles at the bottom of a well in ~3 s.
 * Sub-steps ≤ 1 ms, so dt up to 1/30 s is stable.
 */
import { electricField, vec3, type PointCharge } from '../core/S1-sim/field';
import { subStepCount } from '../core/S1-sim/math';

export interface MovingChargeParams {
  charges: readonly PointCharge[];
  /** Scenic specific charge q/m, C/kg (sign = sign of the test charge). */
  chargePerMassCPerKg: number;
  /** γ/m, 1/s (0 = frictionless). */
  dampingPerS: number;
  /** Field softening ε, m (0 = exact). */
  softeningM: number;
  /** Captured when closer than this to any charge, m. */
  captureRadiusM: number;
  /** Leaves the table beyond this radius, m. */
  boundaryRadiusM: number;
  /**
   * Frictionless orbits can be bound (e.g. released on the zero-potential plane of a dipole): the scene ends
   * the demo after this time (status 'timeout'). With q/m = 2×10⁻⁵ C/kg the dipole/like-charge presets end in
   * 1,5–4,5 s by capture or escape (tuned numerically).
   */
  maxDurationS: number;
}

/** §3 release defaults (frictionless). */
export const RELEASE_DEFAULTS: Omit<MovingChargeParams, 'charges'> = {
  chargePerMassCPerKg: 2e-5,
  dampingPerS: 0,
  softeningM: 0,
  captureRadiusM: 0.006,
  boundaryRadiusM: 0.2,
  maxDurationS: 4,
};

/** §4 ball defaults (viscous, soft field ε = 5 mm). */
export const BALL_DEFAULTS: Omit<MovingChargeParams, 'charges'> = {
  chargePerMassCPerKg: 1e-5,
  dampingPerS: 2,
  softeningM: 0.005,
  captureRadiusM: 0.005,
  boundaryRadiusM: 0.2,
  maxDurationS: Infinity,
};

export interface MovingChargeState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** 'captured' near a charge, 'escaped' past the boundary, 'resting' when slow in a well. */
  status: 'moving' | 'captured' | 'escaped' | 'resting' | 'timeout';
  timeS: number;
}

export interface MovingCharge {
  readonly state: MovingChargeState;
  step(dt: number): MovingChargeState;
  /** Drag-and-release at (x, z) with zero velocity. */
  release(x: number, z: number): void;
  set(params: Partial<MovingChargeParams>): void;
}

export function createMovingCharge(params: MovingChargeParams, start: { x: number; z: number }): MovingCharge {
  const p = { ...params };
  const state: MovingChargeState = { x: start.x, z: start.z, vx: 0, vz: 0, status: 'moving', timeS: 0 };
  const acc = (x: number, z: number): [number, number] => {
    const e = electricField(p.charges, vec3(x, 0, z), p.softeningM);
    return [p.chargePerMassCPerKg * e.x, p.chargePerMassCPerKg * e.z];
  };
  const check = (): void => {
    if (p.charges.some((c) => Math.hypot(state.x - c.position.x, state.z - c.position.z) < p.captureRadiusM)) {
      state.status = 'captured';
      state.vx = 0;
      state.vz = 0;
    } else if (Math.hypot(state.x, state.z) > p.boundaryRadiusM) {
      state.status = 'escaped';
    }
  };
  return {
    state,
    step(dt: number): MovingChargeState {
      if (state.status !== 'moving') return state;
      const n = subStepCount(dt, 1e-3, 100);
      const h = dt / Math.max(n, 1);
      for (let i = 0; i < n && state.status === 'moving'; i++) {
        const [ax, az] = acc(state.x, state.z);
        const damp = Math.exp(-p.dampingPerS * h);
        state.vx = (state.vx + 0.5 * ax * h) * damp;
        state.vz = (state.vz + 0.5 * az * h) * damp;
        state.x += state.vx * h;
        state.z += state.vz * h;
        const [bx, bz] = acc(state.x, state.z);
        state.vx += 0.5 * bx * h;
        state.vz += 0.5 * bz * h;
        state.timeS += h;
        check();
      }
      if (state.status === 'moving' && state.timeS >= p.maxDurationS) state.status = 'timeout';
      if (state.status === 'moving' && p.dampingPerS > 0 && Math.hypot(state.vx, state.vz) < 1e-4) {
        const [ax, az] = acc(state.x, state.z);
        if (Math.hypot(ax, az) < 1e-3) state.status = 'resting';
      }
      return state;
    },
    release(x: number, z: number): void {
      Object.assign(state, { x, z, vx: 0, vz: 0, status: 'moving', timeS: 0 });
      check();
    },
    set(next: Partial<MovingChargeParams>): void {
      Object.assign(p, next);
    },
  };
}
