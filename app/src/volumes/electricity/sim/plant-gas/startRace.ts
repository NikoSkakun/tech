/**
 * plant-gas M4 (step 7) — start-up race, P in % of rating, t in minutes (1 s on screen = 1 min).
 * Lanes: delay to synchronisation, then a linear ramp to 100 %. CCGT power = 0,70·P_GT% + 0,30·P_ST% (shares of M3):
 * the GT ramps to 100 % in 10 min, the ST follows linearly after it (hot 20 min, warm 60 min, cold 150 min).
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';

export type StartLane = 'gasEngine' | 'aeroGt' | 'heavyGt' | 'ccgt';
export type CcgtStart = 'hot' | 'warm' | 'cold';

export const START_LANES: Readonly<Record<Exclude<StartLane, 'ccgt'>, { delayMin: number; rampMin: number }>> = {
  gasEngine: { delayMin: 0.5, rampMin: 2 },
  aeroGt: { delayMin: 3, rampMin: 3 },
  heavyGt: { delayMin: 8, rampMin: 7 },
};

export const CCGT_START: Readonly<Record<CcgtStart, { gtDelayMin: number; gtRampMin: number; stRampMin: number }>> = {
  hot: { gtDelayMin: 10, gtRampMin: 10, stRampMin: 20 },
  warm: { gtDelayMin: 15, gtRampMin: 10, stRampMin: 60 },
  cold: { gtDelayMin: 20, gtRampMin: 10, stRampMin: 150 },
};

/** «Скільки годин стояла ПГУ»: 4 h hot, 24 h warm, 72 h cold (< 8 h / 8–48 h / > 48 h). */
export function ccgtStartFromStandstillH(hours: number): CcgtStart {
  return hours < 8 ? 'hot' : hours <= 48 ? 'warm' : 'cold';
}

const linear = (t: number, delay: number, ramp: number) => clamp(((t - delay) / ramp) * 100, 0, 100);

export function lanePowerPct(lane: StartLane, tMin: number, ccgt: CcgtStart = 'hot'): number {
  if (lane !== 'ccgt') {
    const l = START_LANES[lane];
    return linear(tMin, l.delayMin, l.rampMin);
  }
  const c = CCGT_START[ccgt];
  const gt = linear(tMin, c.gtDelayMin, c.gtRampMin);
  const st = linear(tMin, c.gtDelayMin + c.gtRampMin, c.stRampMin);
  return 0.7 * gt + 0.3 * st;
}

/** Time to 100 % [min]: engines 2,5, aero GT 6, heavy GT 15, CCGT hot 40 / warm 85 / cold 180. */
export function finishMin(lane: StartLane, ccgt: CcgtStart = 'hot'): number {
  if (lane !== 'ccgt') return START_LANES[lane].delayMin + START_LANES[lane].rampMin;
  const c = CCGT_START[ccgt];
  return c.gtDelayMin + c.gtRampMin + c.stRampMin;
}
