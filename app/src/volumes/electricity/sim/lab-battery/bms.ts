/**
 * `lab-battery` §M5 / step 9: 16 series cells with individual capacity and SOC, charge/discharge stop by the first
 * cell at its limit, passive/active balancing, inverter link (CAN vs none).
 *
 * Cell i: SOC_i += I·dt/(3600·Q_i)·100; U_i = OCV(SOC_i) ± I·R0. Charge stops when max U_i ≥ U_max, discharge when
 * min U_i ≤ U_min. Passive balancing bleeds I_bal = U_cell/33 Ω (≈ 0.1 A) from cells more than 1 % above the minimum
 * SOC, only while U_cell > 3.40 V (LFP) / 4.10 V (NMC); active moves 2 A from the fullest to the emptiest cell.
 */
import { CELL_LIMITS, CELLS, type Chemistry, ocvV } from '../core/S3-sim/battery';

export const BALANCE = {
  rBalOhm: 33,
  activeA: 2,
  minSpreadPct: 1,
  thresholdV: { LFP: 3.4, NMC: 4.1 },
} as const;

/** Usable capacity of a series string over one full cycle at small current (no balancing), Ah. */
export function usableCapacityAh(capacitiesAh: readonly number[], socPct: readonly number[]): number {
  let headroom = Infinity;
  capacitiesAh.forEach((q, i) => (headroom = Math.min(headroom, ((100 - socPct[i]!) * q) / 100)));
  let usable = Infinity;
  capacitiesAh.forEach((q, i) => (usable = Math.min(usable, (socPct[i]! * q) / 100 + headroom)));
  return Math.max(0, usable);
}

/** Equalisation time t = ΔSOC/100·Q/I_bal, h (5 % of 100 Ah: 50 h passive, 2.5 h active). */
export function balanceTimeH(dSocPct: number, capacityAh: number, iBalA: number): number {
  return ((dSocPct / 100) * capacityAh) / iBalA;
}

export type BmsMode = 'idle' | 'charge' | 'discharge';
export type BmsStop = 'cell-empty' | 'bms-emergency' | 'complete' | null;

export interface BmsParams {
  chem: Chemistry;
  capacitiesAh: number[];
  socPct: number[];
  balancing: 'off' | 'passive' | 'active';
  /** 'can' — the inverter tapers the current; 'none' — blind charge by pack voltage, BMS hard cut-off. */
  link: 'can' | 'none';
  /** Charge/discharge current, A (default 50 A = 0.5 C of LFP-100). */
  currentA: number;
}

export function createBms(initial: Partial<BmsParams> = {}) {
  const n = initial.capacitiesAh?.length ?? 16;
  let params: BmsParams = {
    chem: 'LFP',
    capacitiesAh: Array.from({ length: n }, () => 100),
    socPct: Array.from({ length: n }, () => 50),
    balancing: 'off',
    link: 'can',
    currentA: 50,
    ...initial,
  };
  const r0 = params.chem === 'LFP' ? CELLS['LFP-100'].r0Ohm : CELLS['21700-NMC'].r0Ohm;
  const soc = [...params.socPct];
  const state = {
    timeS: 0,
    mode: 'idle' as BmsMode,
    currentA: 0,
    cellVoltagesV: soc.map((s) => ocvV(params.chem, s)),
    balancingA: soc.map(() => 0),
    packVoltageV: 0,
    stop: null as BmsStop,
    /** Index of the cell that ended the run (red flash). */
    stopCell: -1,
    ahThisRun: 0,
    usableCapacityAh: usableCapacityAh(params.capacitiesAh, soc),
    socPct: soc,
  };

  function voltages(i: number): number[] {
    return soc.map((s) => ocvV(params.chem, s) + i * r0);
  }

  function balance(dt: number): void {
    state.balancingA = soc.map(() => 0);
    if (params.balancing === 'off') return;
    const min = Math.min(...soc);
    const max = Math.max(...soc);
    if (max - min <= BALANCE.minSpreadPct) return;
    if (params.balancing === 'passive') {
      soc.forEach((s, k) => {
        const u = ocvV(params.chem, s);
        if (s > min + BALANCE.minSpreadPct && u > BALANCE.thresholdV[params.chem])
          state.balancingA[k] = u / BALANCE.rBalOhm;
      });
    } else {
      state.balancingA[soc.indexOf(max)] = BALANCE.activeA;
      state.balancingA[soc.indexOf(min)] = -BALANCE.activeA;
    }
    soc.forEach(
      (_, k) => (soc[k] = soc[k]! - ((state.balancingA[k]! * dt) / 3600 / params.capacitiesAh[k]!) * 100),
    );
  }

  function substep(dt: number): void {
    const lim = CELL_LIMITS[params.chem];
    let i = state.mode === 'charge' ? params.currentA : state.mode === 'discharge' ? -params.currentA : 0;
    if (state.mode === 'charge' && params.link === 'can') {
      // CAN: the inverter keeps the highest cell at U_max (CV on the weakest link) and finishes at 0.05 C.
      const top = Math.max(...soc.map((s) => ocvV(params.chem, s)));
      i = Math.max(0, Math.min(params.currentA, (lim.uMaxV - top) / r0));
      if (i <= 0.05 * Math.min(...params.capacitiesAh)) return finish('complete', voltages(0));
    }
    soc.forEach((_, k) => (soc[k] = soc[k]! + ((i * dt) / 3600 / params.capacitiesAh[k]!) * 100));
    state.ahThisRun += (Math.abs(i) * dt) / 3600;
    state.currentA = i;
    const u = voltages(i);
    if (i > 0 && params.link === 'none' && Math.max(...u) >= lim.uMaxV - 1e-9) finish('bms-emergency', u);
    if (i < 0 && Math.min(...u) <= lim.uMinV) finish('cell-empty', u);
  }

  function finish(stop: BmsStop, u: number[]): void {
    state.stop = stop;
    state.stopCell = stop === 'cell-empty' ? u.indexOf(Math.min(...u)) : u.indexOf(Math.max(...u));
    state.mode = 'idle';
    state.currentA = 0;
  }

  function readout(): void {
    state.cellVoltagesV = voltages(state.currentA);
    state.packVoltageV = state.cellVoltagesV.reduce((a, b) => a + b, 0);
    state.usableCapacityAh = usableCapacityAh(params.capacitiesAh, soc);
  }

  readout();
  return {
    state,
    /** Start a charge or discharge run (accelerated time is the caller's dt). */
    start(mode: BmsMode): void {
      state.mode = mode;
      state.stop = null;
      state.stopCell = -1;
      state.ahThisRun = 0;
    },
    step(dt: number): void {
      let rem = dt;
      while (rem > 1e-9) {
        const h = Math.min(1, rem);
        rem -= h;
        state.timeS += h;
        if (state.mode !== 'idle') substep(h);
        balance(h);
      }
      readout();
    },
    /**
     * Set the state of charge of one cell (M3) — a slider on one glass of the rack, a "weak cell" preset —
     * without touching the others. `params.socPct` (what `reset()` returns to) is left as it was.
     */
    setCellSoc(index: number, socPct: number): void {
      if (index < 0 || index >= soc.length) throw new Error(`createBms: no cell ${index}`);
      soc[index] = Math.min(Math.max(socPct, 0), 100);
      readout();
    },
    set(p: Partial<BmsParams>): void {
      params = { ...params, ...p };
      if (p.socPct) p.socPct.forEach((s, k) => (soc[k] = s));
      readout();
    },
    reset(): void {
      params.socPct.forEach((s, k) => (soc[k] = s));
      Object.assign(state, { timeS: 0, mode: 'idle', currentA: 0, stop: null, stopCell: -1, ahThisRun: 0 });
      readout();
    },
  };
}

export type Bms = ReturnType<typeof createBms>;
