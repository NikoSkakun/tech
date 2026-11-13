/**
 * grid §Е «Вечір дефіциту» (step 13): 3 h (18:00–21:00), 1-min steps, P_L = 15 000 MW, deficit D_def (0…2500 MW).
 * Frequency per §Б.4 in island mode (λ_ext = 0): pool ±600 MW, own FCR beyond the pool 500 MW (λ_F = 2500 MW/Hz),
 * λ_L = 150 MW/Hz, UFLS 5 % / 8 % of P_L.
 * Strategies: «нічого» (UFLS decides), «графік N черг» (queue = 5 % P_L, ring of 6 sectors rotating every 90 min),
 * «попросити економити» (from minute 10: P_L ×0,97, −450 MW).
 */
import { DEFAULT_QUASI_STEADY, solveQuasiSteady, type QuasiSteadyResult } from '@electricity/sim/core/S2-sim/quasiSteadyFrequency';

export const DEFICIT_LOAD_MW = 15000;
export const QUEUE_FRACTION = 0.05;
export const RING_SECTORS = 6;
export const ROTATION_MIN = 90;
export const DURATION_MIN = 180;

export type DeficitStrategy = { kind: 'nothing' } | { kind: 'schedule'; queues: number } | { kind: 'conserve' };

export interface DeficitMinute {
  minute: number;
  /** Sectors (0…5) switched off by the schedule at this minute. */
  scheduledSectors: number[];
  scheduledMW: number;
  conservationMW: number;
  freq: QuasiSteadyResult;
  /** Share of consumers without power right now: N·5 % + P_UFLS/P_L. */
  offShare: number;
  /** Share shed suddenly by UFLS (outside the schedule). */
  uflsShare: number;
}

/** Sectors off at a minute for N queues (rotation 1…N → N+1…2N → … modulo 6, every 90 min). */
export function scheduledSectors(queues: number, minute: number): number[] {
  const n = Math.max(0, Math.min(RING_SECTORS, Math.round(queues)));
  const shift = (Math.floor(minute / ROTATION_MIN) * n) % RING_SECTORS;
  return Array.from({ length: n }, (_, i) => (shift + i) % RING_SECTORS);
}

export function deficitMinute(deficitMW: number, strategy: DeficitStrategy, minute: number): DeficitMinute {
  const queues = strategy.kind === 'schedule' ? Math.max(0, Math.min(RING_SECTORS, Math.round(strategy.queues))) : 0;
  const scheduledMW = queues * QUEUE_FRACTION * DEFICIT_LOAD_MW;
  const conservationMW = strategy.kind === 'conserve' && minute >= 10 ? 0.03 * DEFICIT_LOAD_MW : 0;
  const freq = solveQuasiSteady(scheduledMW + conservationMW - Math.max(0, deficitMW), {
    ...DEFAULT_QUASI_STEADY,
    loadMW: DEFICIT_LOAD_MW,
  });
  const uflsShare = freq.uflsShedMW / DEFICIT_LOAD_MW;
  return {
    minute,
    scheduledSectors: scheduledSectors(queues, minute),
    scheduledMW,
    conservationMW,
    freq,
    offShare: queues * QUEUE_FRACTION + uflsShare,
    uflsShare,
  };
}

/** Whole evening (181 samples, minute 0…180). */
export function runDeficitEvening(deficitMW: number, strategy: DeficitStrategy): DeficitMinute[] {
  return Array.from({ length: DURATION_MIN + 1 }, (_, m) => deficitMinute(deficitMW, strategy, m));
}
