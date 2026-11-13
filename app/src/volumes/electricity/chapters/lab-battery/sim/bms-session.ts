/**
 * Sim binding for step 9: a `createBms` pack (§M5) advanced in accelerated time, with the user's edits
 * (per-cell SOC, capacity of cell № 7, balancing mode, inverter link) applied on top of the live state.
 */
import {
  BALANCE,
  balanceTimeH,
  createBms,
  type BmsMode,
  type BmsParams,
  type BmsStop,
} from '@electricity/sim/lab-battery';

/** Model seconds per screen second: a charge at 0,5 C lasts seconds; idle balancing is watched faster still. */
export const BMS_TIME = { run: 450, idle: 7200 } as const;
const CELLS = 16;
const WEAK = 6; // cell № 7

export interface BmsSession {
  readonly state: ReturnType<typeof createBms>['state'];
  /** Elapsed model time, h. */
  hours: number;
  readonly weakCell: number;
  params: Pick<BmsParams, 'balancing' | 'link'> & { weakAh: number };
  /** Set the SOC of one cell (drag of its glass), %. */
  setSoc(cell: number, socPct: number): void;
  /** Spread the cells by up to ±`spreadPct` (seeded random numbers in 0…1 from the caller). */
  unbalance(random: () => number, spreadPct?: number): void;
  start(mode: Exclude<BmsMode, 'idle'>): void;
  /** Advance by `dt` screen seconds; returns the stop reason once, when a run ends. */
  tick(dt: number): BmsStop;
  /** t = ΔSOC·Q/I_bal for the current spread and balancing mode, h (null when balancing is off). */
  balanceHours(): number | null;
}

export function createBmsSession(): BmsSession {
  const start = Array.from({ length: CELLS }, (_, i) => 50 + (i === WEAK ? 5 : 0));
  const bms = createBms({ chem: 'LFP', socPct: start, balancing: 'off', link: 'can', currentA: 50 });
  let applied = '';
  const self: BmsSession = {
    state: bms.state,
    hours: 0,
    weakCell: WEAK,
    params: { balancing: 'off', link: 'can', weakAh: 100 },
    setSoc(cell, socPct) {
      const soc = [...bms.state.socPct];
      soc[cell] = Math.min(Math.max(socPct, 0), 100);
      bms.set({ socPct: soc });
    },
    unbalance(random, spreadPct = 8) {
      const mean = bms.state.socPct.reduce((a, b) => a + b, 0) / CELLS;
      const base = Math.min(Math.max(mean, spreadPct + 2), 98 - spreadPct);
      bms.set({ socPct: bms.state.socPct.map(() => base + (random() * 2 - 1) * spreadPct) });
    },
    start(mode) {
      bms.start(mode);
    },
    tick(dt) {
      // push parameter edits into the model only when they change
      const key = `${self.params.balancing}|${self.params.link}|${self.params.weakAh}`;
      if (key !== applied) {
        applied = key;
        const capacitiesAh = Array.from({ length: CELLS }, (_, i) => (i === WEAK ? self.params.weakAh : 100));
        bms.set({ balancing: self.params.balancing, link: self.params.link, capacitiesAh });
      }
      const running = bms.state.mode !== 'idle';
      const factor = running ? BMS_TIME.run : self.params.balancing !== 'off' ? BMS_TIME.idle : 0;
      if (factor === 0) return null;
      const before = bms.state.stop;
      bms.step(dt * factor);
      self.hours += (dt * factor) / 3600;
      return before === null && bms.state.stop !== null ? bms.state.stop : null;
    },
    balanceHours() {
      if (self.params.balancing === 'off') return null;
      const soc = bms.state.socPct;
      const spread = Math.max(...soc) - Math.min(...soc);
      const iBal = self.params.balancing === 'active' ? BALANCE.activeA : 3.3 / BALANCE.rBalOhm;
      return balanceTimeH(spread, Math.min(100, self.params.weakAh), iBal);
    },
  };
  return self;
}
