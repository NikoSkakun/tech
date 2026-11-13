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

/** One point of a replayed run with the running totals up to it. */
export interface ReplayPoint extends CellSample {
  /** Energy delivered / stored so far, Wh. */
  wh: number;
  /** Joule heat so far, J. */
  heatJ: number;
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

function totals(curve: readonly (CellSample & { phase?: 'CC' | 'CV' })[]): ReplayPoint[] {
  let wh = 0;
  let heatJ = 0;
  return curve.map((s, i) => {
    const prev = curve[i - 1];
    if (prev) {
      const dAh = Math.abs(s.ah - prev.ah);
      wh += ((s.voltageV + prev.voltageV) / 2) * dAh;
      heatJ +=
        ((Math.abs(s.ocvV - s.voltageV) * s.currentA + Math.abs(prev.ocvV - prev.voltageV) * prev.currentA) /
          2) *
        (s.timeS - prev.timeS);
    }
    return { ...s, wh, heatJ, heatW: Math.abs(s.ocvV - s.voltageV) * s.currentA };
  });
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
  const points = totals(result.curve);
  // the per-minute samples under-count a little: pin the totals of the last point to the model's exact sums
  const last = points[points.length - 1]!;
  last.wh = result.wh;
  last.heatJ = result.heatJ;
  return { replay: replay(cell, points), result };
}

/** Step 7: CC/CV charge from 0 % (§M3). */
export function chargeReplay(
  cell: BenchCell,
  cRate: number,
  uMaxV: number,
  tC: number,
): { replay: Replay; result: ChargeResult } {
  const result = chargeCcCv(CELLS[cell], cRate, { uMaxV, tC });
  return { replay: replay(cell, totals(result.curve)), result };
}

/** Capacity share 0…100 % of the nominal capacity (common X axis for cells of different size). */
export function capacityPct(cell: BenchCell, ah: number): number {
  return (ah / CELLS[cell].capacityAh) * 100;
}
