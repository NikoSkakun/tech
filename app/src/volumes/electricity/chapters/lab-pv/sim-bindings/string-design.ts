/**
 * String design state of step 9: which roof module belongs to string A, B or to none, and the checks of
 * `checkString` (document §M4: cold V_oc against 500 V, hot V_mp against the MPPT window and the start
 * voltage, input currents when the two strings are paralleled on one input). No three.js here.
 */
import { checkString, type ArrayWarning, type StringDesignResult } from '@electricity/sim/lab-pv';

/** String of a module: 0 = A, 1 = B, −1 = not connected. */
export type Assignment = -1 | 0 | 1;

export interface StringReport {
  n: number;
  check: StringDesignResult;
}

export function createStringDesign(count: number, perRow: number) {
  // the document's layout: 12 modules = 2 strings of 6, one per MPPT input (upper row A, lower row B)
  const initial = (): Assignment[] => Array.from({ length: count }, (_, i) => (i < perRow ? 0 : 1));
  let assign = initial();
  let version = 0;
  return {
    get assign(): readonly Assignment[] {
      return assign;
    },
    get version() {
      return version;
    },
    /** A → B → not connected → A. */
    cycle(i: number): void {
      if (i < 0 || i >= count) return;
      const a = assign[i]!;
      assign[i] = a === 0 ? 1 : a === 1 ? -1 : 0;
      version++;
    },
    reset(): void {
      assign = initial();
      version++;
    },
    count: (s: 0 | 1): number => assign.filter((a) => a === s).length,
    /** Checks of string `s`; with `parallel` both strings share one MPPT input (currents add). */
    report(s: 0 | 1, tMinC: number, tMaxC: number, parallel: boolean): StringReport {
      const n = assign.filter((a) => a === s).length;
      return { n, check: checkString({ nSeries: n, nParallel: parallel ? 2 : 1, tMinC, tMaxC }) };
    },
  };
}
export type StringDesign = ReturnType<typeof createStringDesign>;

/** The most serious warning first (red ones before amber ones). */
export function worst(w: readonly ArrayWarning[]): ArrayWarning | null {
  const order: ArrayWarning[] = ['overvoltage', 'short-circuit-current', 'operating-current-clipping', 'below-mppt-window-hot', 'below-start-voltage', 'above-mppt-window', 'mixed-orientation'];
  return order.find((x) => w.includes(x)) ?? null;
}
