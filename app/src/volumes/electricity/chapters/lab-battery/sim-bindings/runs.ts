/**
 * Sim bindings for the two bench steps (6 `voltage-capacity`, 7 `charging`).
 *
 * The models of `@electricity/sim/lab-battery` integrate a whole discharge / charge at once (dt = 1 s of model time,
 * a few milliseconds of CPU). A `Replay` plays such a result back in accelerated time: the scene and the chart
 * both read `replay.at()` — the sample under the play head — so the picture and the numbers cannot disagree.
 */
import {
  CELLS,
  chargeCcCv,
  discharge,
  type CellId,
  type CellSample,
  type ChargeResult,
  type DischargeResult,
} from '@electricity/sim/lab-battery';

export type BenchCell = Extract<CellId, '21700-NMC' | 'LFP-100'>;

/** One sample of a run (it carries the running totals `wh` / `heatJ` of the model) plus the heat power now. */
export interface ReplayPoint extends CellSample {
  /** Heat power right now, W: I·|U_OCV − U|. */
  heatW: number;
  phase?: 'CC' | 'CV';
}

export interface Replay {
  cell: BenchCell;
  points: ReplayPoint[];
  /** Play head 0…1 over the run. */
  head: number;
  /** Interpolated point under the play head. */
  at(): ReplayPoint;
  /** Index of the last point at or before the head (chart reveal). */
  index(): number;
}

function points(curve: readonly (CellSample & { phase?: 'CC' | 'CV' })[]): ReplayPoint[] {
  return curve.map((s) => ({ ...s, heatW: Math.abs(s.ocvV - s.voltageV) * s.currentA }));
}

function replay(cell: BenchCell, points: ReplayPoint[]): Replay {
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const self: Replay = {
    cell,
    points,
    head: 0,
    index: () => Math.min(Math.floor(self.head * (points.length - 1) + 1e-6), points.length - 1),
    at() {
      const x = Math.min(Math.max(self.head, 0), 1) * (points.length - 1);
      const i = Math.min(Math.floor(x), points.length - 2);
      const a = points[i]!;
      const b = points[i + 1] ?? a;
      const t = x - i;
      return {
        ...a,
        timeS: lerp(a.timeS, b.timeS, t),
        ah: lerp(a.ah, b.ah, t),
        socPct: lerp(a.socPct, b.socPct, t),
        voltageV: lerp(a.voltageV, b.voltageV, t),
        ocvV: lerp(a.ocvV, b.ocvV, t),
        currentA: lerp(a.currentA, b.currentA, t),
        wh: lerp(a.wh, b.wh, t),
        heatJ: lerp(a.heatJ, b.heatJ, t),
        heatW: lerp(a.heatW, b.heatW, t),
      };
    },
  };
  return self;
}

/** Step 6: constant-current discharge from 100 % to the cut-off (§M2). */
export function dischargeReplay(
  cell: BenchCell,
  cRate: number,
  tC: number,
): { replay: Replay; result: DischargeResult } {
  const result = discharge(CELLS[cell], cRate, tC);
  return { replay: replay(cell, points(result.curve)), result };
}

/** Step 7: CC/CV charge from 0 % (§M3). */
export function chargeReplay(
  cell: BenchCell,
  cRate: number,
  uMaxV: number,
  tC: number,
): { replay: Replay; result: ChargeResult } {
  const result = chargeCcCv(CELLS[cell], cRate, { uMaxV, tC });
  return { replay: replay(cell, points(result.curve)), result };
}

/** Capacity share 0…100 % of the nominal capacity (common X axis for cells of different size). */
export function capacityPct(cell: BenchCell, ah: number): number {
  return (ah / CELLS[cell].capacityAh) * 100;
}
