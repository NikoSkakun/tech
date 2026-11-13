/**
 * Session for step 7: the boost-stage MPPT of «ЛІ-6» in its four situations. No three.js.
 *
 * - `single`   one string of 6 × ЛМ-440 on input A (G, T from the sliders; manual D or P&O);
 * - `two`      «Ранок»: east 800 W/m² on input A, west 200 W/m² on input B, each with its own tracker;
 * - `shared`   the same two strings in parallel on ONE tracker (summed curve → mismatch loss);
 * - `clipping` an 8 kWp array on the 6 kW inverter (the tracker walks right of the peak, under the ceiling).
 *
 * Inputs A / B use `createMpptController` (§M5, lab-pv §M1). The shared case has no controller in the library,
 * so the same perturb-and-observe rule (ΔD = 0.005, 5 steps/s) is applied here to the summed curve from
 * `parallelCurves`.
 */
import {
  CLIPPING_CAP_W,
  DC_LINK_V,
  createMpptController,
  eastWestMismatch,
  parallelCurves,
  stringCurve,
  type MismatchResult,
} from '@electricity/sim/lab-inverter';

export type MpptMode = 'single' | 'two' | 'shared' | 'clipping';
export const MORNING = { eastWm2: 800, westWm2: 200 } as const;
const DELTA_D = 0.005;
const RATE_HZ = 5;

export interface Climber {
  duty: number;
  vV: number;
  pW: number;
  /** Top of this curve. */
  mppV: number;
  mppW: number;
  power(v: number): number;
}

export interface MpptSession {
  readonly mode: MpptMode;
  /** Climbers on screen: one (`single`, `shared`, `clipping`) or two (`two`: east, west). */
  readonly climbers: readonly Climber[];
  readonly mismatch: MismatchResult;
  readonly capW: number | null;
  /** Bumps when a curve changed shape (cheap redraw trigger). */
  readonly version: number;
  configure(o: { mode: MpptMode; gWm2: number; tcC: number; auto: boolean; duty: number }): void;
  tick(dt: number): void;
}

export function createMpptSession(): MpptSession {
  const a = createMpptController({ auto: true, dutyManual: 0.5 });
  const b = createMpptController({ auto: true, dutyManual: 0.5, gWm2: MORNING.westWm2 });
  let mode: MpptMode = 'single';
  let tcC = 25;
  let version = 1;
  let key = '';
  let mismatch = eastWestMismatch(MORNING.eastWm2, MORNING.westWm2, tcC);
  // the shared tracker: P&O on the summed curve
  let sum = parallelCurves(stringCurve(MORNING.eastWm2, tcC), stringCurve(MORNING.westWm2, tcC));
  const shared = { duty: 0.5, dir: 1 as 1 | -1, pPrev: 0, acc: 0 };
  const view = (c: typeof a): Climber => ({
    duty: c.state.duty,
    vV: c.state.pvVoltageV,
    pW: c.state.powerW,
    mppV: c.curve().mpp.vV,
    mppW: c.state.mppW,
    power: (v) => c.curve().powerAt(v),
  });
  return {
    get mode() {
      return mode;
    },
    get climbers() {
      if (mode === 'two') return [view(a), view(b)];
      if (mode === 'shared') {
        const v = (1 - shared.duty) * DC_LINK_V;
        return [
          {
            duty: shared.duty,
            vV: v,
            pW: sum.powerAt(v),
            mppV: sum.mpp.vV,
            mppW: sum.mpp.pW,
            power: (x: number) => sum.powerAt(x),
          },
        ];
      }
      return [view(a)];
    },
    get mismatch() {
      return mismatch;
    },
    get capW() {
      return mode === 'clipping' ? CLIPPING_CAP_W : null;
    },
    get version() {
      return version;
    },
    configure(o) {
      const morning = o.mode === 'two' || o.mode === 'shared';
      const next = `${o.mode}|${morning ? MORNING.eastWm2 : o.gWm2}|${o.tcC}`;
      mode = o.mode;
      // in the morning scenes the trackers always run (the D slider belongs to the single string)
      a.set({
        gWm2: morning ? MORNING.eastWm2 : o.gWm2,
        tcC: o.tcC,
        clipping: o.mode === 'clipping',
        auto: o.auto || morning,
        dutyManual: o.duty,
      });
      b.set({ gWm2: MORNING.westWm2, tcC: o.tcC, auto: true });
      if (next === key) return;
      key = next;
      tcC = o.tcC;
      version++;
      if (morning) {
        mismatch = eastWestMismatch(MORNING.eastWm2, MORNING.westWm2, tcC);
        sum = parallelCurves(stringCurve(MORNING.eastWm2, tcC), stringCurve(MORNING.westWm2, tcC));
      }
    },
    tick(dt) {
      a.step(dt);
      b.step(dt);
      if (mode !== 'shared') return;
      shared.acc += dt;
      while (shared.acc >= 1 / RATE_HZ) {
        shared.acc -= 1 / RATE_HZ;
        shared.duty = Math.min(0.8, Math.max(0, shared.duty + shared.dir * DELTA_D));
        const p = sum.powerAt((1 - shared.duty) * DC_LINK_V);
        if (p < shared.pPrev) shared.dir = shared.dir === 1 ? -1 : 1;
        shared.pPrev = p;
      }
    },
  };
}
