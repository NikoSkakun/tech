/**
 * Fuse / breaker hook for the DC solver: a definite-time, multi-step time–current characteristic.
 * Each step `{ multiple, timeS }` means "blows if I > multiple·I_n continuously for timeS" (`current` §5:
 * 1 A fuse — 2·I_n for 0,3 s or 1,25·I_n for 3 s; `current` §9: multimeter fuse 0,4 A instantaneous).
 * Detailed MCB B/C/D curves belong to S2's thermal/protection models.
 */
export interface FuseCurveStep {
  /** Threshold as a multiple of the rated current. */
  multiple: number;
  /** Continuous time above the threshold needed to blow, s (0 = instantaneous). */
  timeS: number;
}

export interface FuseParams {
  ratedCurrentA: number;
  curve: readonly FuseCurveStep[];
}

export interface FuseState {
  blown: boolean;
  /** Time spent above each threshold of the curve, s. */
  timersS: number[];
}

export interface Fuse {
  readonly params: FuseParams;
  readonly state: FuseState;
  /** Advance by dt with the present current; returns true on the step the fuse blows. */
  step(currentA: number, dt: number): boolean;
  /** "Новий запобіжник". */
  reset(): void;
}

export function createFuse(params: FuseParams): Fuse {
  const state: FuseState = { blown: false, timersS: params.curve.map(() => 0) };
  return {
    params,
    state,
    step(currentA: number, dt: number): boolean {
      if (state.blown) return false;
      const ratio = Math.abs(currentA) / params.ratedCurrentA;
      params.curve.forEach((s, i) => {
        state.timersS[i] = ratio > s.multiple ? state.timersS[i] + Math.max(dt, 0) : 0;
      });
      // 1 μs tolerance: accumulated frame times (30 × 0,01 s) must count as 0,3 s.
      const blow = params.curve.some((s, i) => ratio > s.multiple && state.timersS[i] >= s.timeS - 1e-6);
      if (blow) state.blown = true;
      return blow;
    },
    reset(): void {
      state.blown = false;
      state.timersS.fill(0);
    },
  };
}
