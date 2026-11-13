/**
 * Second-order follower φ̈ = ω_n²·(target − φ) − 2ζω_n·φ̇ — compass needles, galvanometer pointers and other
 * "instrument" motions (`magnetism` М1 τ = 0,12 s critically damped, М5 ω_n = 2π·2 rad/s, ζ = 0,7;
 * `current` §10 compass settling ≈ 0,8 s). Semi-implicit Euler with sub-steps ≤ 1 ms (stable for dt ≤ 1/30 s).
 */
import { subStepCount } from './math';

export interface FollowerParams {
  /** Natural angular frequency ω_n, rad/s. */
  omegaN: number;
  /** Damping ratio ζ (1 = critical). */
  zeta: number;
  /** Wrap the error into (−π, π] so angles take the short way round. */
  angular?: boolean;
}

export interface FollowerState {
  value: number;
  velocity: number;
}

export interface Follower {
  readonly state: FollowerState;
  step(target: number, dt: number): number;
  reset(value?: number): void;
  set(params: Partial<FollowerParams>): void;
}

/** Critically damped follower whose step response settles like e^(−t/τ): ω_n = 1/τ. */
export function criticalFollowerParams(tauS: number, angular = false): FollowerParams {
  return { omegaN: 1 / tauS, zeta: 1, angular };
}

export function createFollower(params: FollowerParams, initial = 0): Follower {
  const p = { ...params };
  const state: FollowerState = { value: initial, velocity: 0 };
  return {
    state,
    step(target: number, dt: number): number {
      const n = subStepCount(dt, 1e-3, 200);
      const h = dt / Math.max(n, 1);
      for (let i = 0; i < n; i++) {
        let err = target - state.value;
        if (p.angular) err = Math.atan2(Math.sin(err), Math.cos(err));
        const acc = p.omegaN * p.omegaN * err - 2 * p.zeta * p.omegaN * state.velocity;
        state.velocity += acc * h;
        state.value += state.velocity * h;
      }
      return state.value;
    },
    reset(value = 0): void {
      state.value = value;
      state.velocity = 0;
    },
    set(next: Partial<FollowerParams>): void {
      Object.assign(p, next);
    },
  };
}
