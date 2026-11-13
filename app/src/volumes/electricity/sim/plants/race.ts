/**
 * plants M6 (step 9) — «Перегони потужності». P in % of rating, time in minutes (1 s on screen = 1 min).
 *   dP/dt = min(ramp, (P1 − P)/τ_settle), τ_settle = 0,5 min, after a start delay t_delay.
 * Nominal finish (document): t_delay + ΔP/ramp (coal ≈ 7,2 min, CCGT ≈ 4,5, GT ≈ 1,5, hydro ≈ 0,4); the simulated curve
 * has the smooth tail on top. Blackout: every lane → 0 in 2 s; only black-start units restart after their start delay
 * (hydro 1,5 min, PSH 1,5, gas engines 2, GT 10, BESS 0,05) and ramp back to their target.
 */
import { FixedStepper } from '@electricity/sim/core/S2-sim/math';

export type LaneId = 'coal' | 'ccgt' | 'gt' | 'gasEngine' | 'nuclear' | 'hydro' | 'psh' | 'bess';

export interface LaneSpec {
  rampPctPerMin: number;
  delayMin: number;
  fromPct: number;
  toPct: number;
  /** Black-start capable and its restart delay [min] (null = cannot restart from zero). */
  blackStartDelayMin: number | null;
}

export const LANES: Readonly<Record<LaneId, LaneSpec>> = {
  coal: { rampPctPerMin: 3, delayMin: 0.5, fromPct: 60, toPct: 80, blackStartDelayMin: null },
  ccgt: { rampPctPerMin: 5, delayMin: 0.5, fromPct: 60, toPct: 80, blackStartDelayMin: null },
  gt: { rampPctPerMin: 15, delayMin: 0.2, fromPct: 60, toPct: 80, blackStartDelayMin: 10 },
  gasEngine: { rampPctPerMin: 30, delayMin: 0.1, fromPct: 60, toPct: 80, blackStartDelayMin: 2 },
  nuclear: { rampPctPerMin: 2, delayMin: 1, fromPct: 90, toPct: 100, blackStartDelayMin: null },
  hydro: { rampPctPerMin: 60, delayMin: 0.1, fromPct: 60, toPct: 80, blackStartDelayMin: 1.5 },
  psh: { rampPctPerMin: 60, delayMin: 0.1, fromPct: 60, toPct: 80, blackStartDelayMin: 1.5 },
  bess: { rampPctPerMin: 6000, delayMin: 0, fromPct: 60, toPct: 80, blackStartDelayMin: 0.05 },
};

export const SETTLE_TAU_MIN = 0.5;
export const BLACKOUT_FALL_MIN = 2 / 60;
/** «Finished» when within this margin of the target [% of rating]. */
export const FINISH_MARGIN_PCT = 0.5;

export function nominalFinishMin(id: LaneId): number {
  const l = LANES[id];
  return l.delayMin + Math.abs(l.toPct - l.fromPct) / l.rampPctPerMin;
}

interface LaneState {
  pct: number;
  target: number;
  /** Minutes before the lane may move. */
  waitMin: number;
  /** Ramp in the current phase [%/min]. */
  ramp: number;
  finishedAtMin: number | null;
  /** Lane is dead after a blackout (no black start). */
  dead: boolean;
}

export function createPowerRace() {
  const h = 0.002; // min, fixed sub-step
  const stepper = new FixedStepper(h);
  let t = 0;
  const fresh = (): Record<LaneId, LaneState> =>
    Object.fromEntries(
      (Object.keys(LANES) as LaneId[]).map((id) => [id, { pct: LANES[id].fromPct, target: LANES[id].fromPct, waitMin: 0, ramp: LANES[id].rampPctPerMin, finishedAtMin: null, dead: false }]),
    ) as Record<LaneId, LaneState>;
  let lanes = fresh();
  const advance = (dt: number) => {
    for (const id of Object.keys(lanes) as LaneId[]) {
      const s = lanes[id];
      if (s.waitMin > 0) {
        s.waitMin -= dt;
        continue;
      }
      const err = s.target - s.pct;
      const rate = Math.sign(err) * Math.min(s.ramp, Math.abs(err) / SETTLE_TAU_MIN);
      s.pct += rate * dt;
      if (s.finishedAtMin === null && Math.abs(s.target - s.pct) <= FINISH_MARGIN_PCT) s.finishedAtMin = t;
    }
    t += dt;
  };
  return {
    get timeMin() {
      return t;
    },
    lane: (id: LaneId): Readonly<LaneState> => lanes[id],
    /** «Стрибок попиту +20 %»: all lanes from P0 to P1 with their delays. */
    demandJump() {
      t = 0;
      lanes = fresh();
      for (const id of Object.keys(lanes) as LaneId[]) {
        lanes[id].target = LANES[id].toPct;
        lanes[id].waitMin = LANES[id].delayMin;
      }
    },
    /** «Блекаут»: everything falls to 0 in 2 s, black-start units restart after their delay. */
    blackout() {
      t = 0;
      for (const id of Object.keys(lanes) as LaneId[]) {
        const s = lanes[id];
        const bs = LANES[id].blackStartDelayMin;
        s.ramp = s.pct / BLACKOUT_FALL_MIN;
        s.target = 0;
        s.waitMin = 0;
        s.finishedAtMin = null;
        s.dead = bs === null;
      }
      // after the fall the black-start lanes get their restart order
      advanceFor(BLACKOUT_FALL_MIN);
      for (const id of Object.keys(lanes) as LaneId[]) {
        const s = lanes[id];
        s.pct = 0;
        if (!s.dead) {
          s.ramp = LANES[id].rampPctPerMin;
          s.target = LANES[id].toPct;
          s.waitMin = LANES[id].blackStartDelayMin!;
        }
      }
    },
    step(dtMin: number) {
      advanceFor(dtMin);
    },
    reset() {
      t = 0;
      lanes = fresh();
      stepper.reset();
    },
  };
  function advanceFor(dtMin: number) {
    const n = stepper.advance(dtMin);
    for (let i = 0; i < n; i++) advance(h);
  }
}
