/**
 * grid §Д «N-1 і каскад» (steps 8, 11): five-bus network, DC power flow, N-1 check, cascade and the «rescue» action.
 * Injections at load factor s (0,5…1,0): P3 = −2200·s, P4 = −1200·s, P5 = −600·s, P2 = 1000·s, P1 = −(P2+P3+P4+P5).
 */
import {
  contingencyAnalysis,
  runCascade,
  solveDcPowerFlow,
  type CascadeResult,
  type ContingencyRow,
  type DcBus,
  type DcFlowResult,
  type DcLine,
} from '@electricity/sim/core/S2-sim/dcPowerFlow';

export const N1_BUS_NAMES = {
  '1': 'АЕС',
  '2': 'ТЕС',
  '3': 'Місто А',
  '4': 'Місто Б',
  '5': 'Промвузол',
} as const;

export type N1LineId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';

export const N1_LINES: readonly DcLine[] = [
  { id: 'L1', from: '1', to: '3', reactance: 0.1, ratingMW: 1600, inService: true },
  { id: 'L2', from: '1', to: '4', reactance: 0.12, ratingMW: 1300, inService: true },
  { id: 'L3', from: '1', to: '2', reactance: 0.08, ratingMW: 1000, inService: true },
  { id: 'L4', from: '2', to: '3', reactance: 0.1, ratingMW: 1000, inService: true },
  { id: 'L5', from: '2', to: '5', reactance: 0.1, ratingMW: 800, inService: true },
  { id: 'L6', from: '3', to: '4', reactance: 0.15, ratingMW: 600, inService: true },
  { id: 'L7', from: '4', to: '5', reactance: 0.12, ratingMW: 600, inService: true },
];

/** «Врятувати» actions of §Д.5: shed 1 queue (P3 ×0,8) or 2 queues (P3 ×0,6). */
export type RescueAction = 'none' | 'oneQueue' | 'twoQueues';
const RESCUE_FACTOR: Record<RescueAction, number> = { none: 1, oneQueue: 0.8, twoQueues: 0.6 };

/** Bus injections for load factor s ∈ [0,5; 1,0] and an optional rescue action on bus 3. */
export function n1Buses(s: number, rescue: RescueAction = 'none'): DcBus[] {
  const k = Math.min(1, Math.max(0.5, s));
  const p3 = -2200 * k * RESCUE_FACTOR[rescue];
  const p4 = -1200 * k;
  const p5 = -600 * k;
  const p2 = 1000 * k;
  const p1 = -(p2 + p3 + p4 + p5);
  return [
    { id: '1', injectionMW: p1, pMaxMW: 3200 },
    { id: '2', injectionMW: p2, pMaxMW: 1200 },
    { id: '3', injectionMW: p3 },
    { id: '4', injectionMW: p4 },
    { id: '5', injectionMW: p5 },
  ];
}

function linesWithout(out: readonly string[]): DcLine[] {
  return N1_LINES.map((l) => (out.includes(l.id) ? { ...l, inService: false } : { ...l }));
}

export function n1Flows(s: number, outages: readonly string[] = [], rescue: RescueAction = 'none'): DcFlowResult {
  return solveDcPowerFlow(n1Buses(s, rescue), linesWithout(outages));
}

export interface N1Check {
  rows: ContingencyRow[];
  worst: ContingencyRow;
  /** N-1 secure: no line above 100 % after any single outage (100,5 % threshold as in §Д.3). */
  secure: boolean;
}

/** «EMS: перевірити N-1» (§Д.4). */
export function checkN1(s: number): N1Check {
  const rows = contingencyAnalysis(n1Buses(s), N1_LINES);
  const worst = rows.reduce((a, b) => (b.worstLoadingPct > a.worstLoadingPct ? b : a));
  return { rows, worst, secure: worst.worstLoadingPct <= 100.5 };
}

/** «Вимкнути лінію» (+ optional rescue action applied at t = 0, right after the first outage) → cascade per §Д.3. */
export function tripAndCascade(s: number, lineId: string, rescue: RescueAction = 'none'): CascadeResult {
  return runCascade(n1Buses(s, rescue), linesWithout([lineId]));
}
