/**
 * `lab-battery` step 11 scenarios built on the §M7 cell: oven run, «overcharge without BMS» (oven ramp
 * T_oven(t) = 25 + 2·t/60 °C), scripted «nail» animation and propagation in a 4-cell module.
 */
import type { Chemistry } from '../core/S3-sim/battery';
import { THERMAL_CHEM, THERMAL_DT_S, THERMAL_TAU_S, ThermalCell, type ThermalEvent } from './thermal';

export interface OvenRun {
  /** Event times, model seconds (rounded like the document's table). */
  events: Partial<Record<ThermalEvent, number>>;
  /** Temperature at runaway onset, °C (null if none). */
  onsetC: number | null;
  /** T(t) every second of model time. */
  trace: { timeS: number; tempC: number }[];
  finalC: number;
  /** `runOvercharge(chem, true)` only: model time at which the BMS cut the charge, s (M3). */
  cutoffS?: number;
}

/** Run a cell in an oven (constant T or a ramp function of model time) for `tMaxS` model seconds. */
export function runOven(chem: Chemistry, oven: number | ((tS: number) => number), tMaxS = 7200): OvenRun {
  const cell = new ThermalCell(chem);
  const ovenAt = typeof oven === 'number' ? () => oven : oven;
  const trace: OvenRun['trace'] = [];
  while (cell.timeS < tMaxS) {
    if (Number.isInteger(cell.timeS)) trace.push({ timeS: cell.timeS, tempC: cell.tempC });
    cell.step(THERMAL_DT_S, ovenAt(cell.timeS));
  }
  const events: OvenRun['events'] = {};
  for (const [k, v] of Object.entries(cell.events)) events[k as ThermalEvent] = Math.round(v);
  return { events, onsetC: cell.onsetC, trace, finalC: cell.tempC };
}

/** «Перезаряд без BMS»: effective ambient ramp 25 + 2·t/60 °C. With BMS the charge is cut (4.25 V NMC / 3.65 V LFP). */
export function overchargeOvenC(tS: number): number {
  return 25 + (2 * tS) / 60;
}

/** BMS overcharge cut-off voltages, V per cell. */
export const BMS_OVERCHARGE_CUTOFF_V: Record<Chemistry, number> = { NMC: 4.25, LFP: 3.65 };

/**
 * Model time at which the BMS cuts an overcharge (M3), s — illustrative scenario value, not from the document
 * (which only gives the cut-off voltages): the pilot `lab-battery` shows «BMS відключила заряд» after 240 model s,
 * long before the side reactions heat the cell (≈ 2 °C/min ramp → +8 °C).
 */
export const BMS_OVERCHARGE_CUTOFF_S: Record<Chemistry, number> = { NMC: 240, LFP: 240 };

export function runOvercharge(chem: Chemistry, bms: boolean, tMaxS = 9000): OvenRun {
  if (bms) return { ...runOven(chem, 25, Math.min(tMaxS, 60)), cutoffS: BMS_OVERCHARGE_CUTOFF_S[chem] };
  return runOven(chem, overchargeOvenC, tMaxS);
}

/**
 * «Цвях» — scripted animation (not integrated): NMC with SOC ≥ 50 % → linear heating to 165 °C in 10 s, then
 * the runaway curve; otherwise smooth rise to 120 °C (NMC) / 100 °C (LFP) over 30 s, vent, smoke, slow cooling
 * with τ = 300 s.
 */
export function nailScenarioC(
  chem: Chemistry,
  socPct: number,
  tS: number,
): { tempC: number; runaway: boolean; vent: boolean } {
  const t = Math.max(0, tS);
  if (chem === 'NMC' && socPct >= 50) {
    const p = THERMAL_CHEM.NMC;
    const on = p.stages[1]!.tK;
    // vent (M3): the valve opens at its threshold on the way up (140 °C at t ≈ 8 s) and stays open
    if (t < 10) {
      const tempC = 25 + ((on - 25) * t) / 10;
      return { tempC, runaway: false, vent: tempC >= p.ventC };
    }
    return { tempC: on + (p.peakC - on) * (1 - Math.exp(-(t - 10) / p.tauRiseS)), runaway: true, vent: true };
  }
  const peak = chem === 'NMC' ? 120 : 100;
  if (t < 30) {
    const x = t / 30;
    const tempC = 25 + (peak - 25) * x * x * (3 - 2 * x);
    return { tempC, runaway: false, vent: tempC >= NAIL_SMOKE_VENT_C };
  }
  return { tempC: 25 + (peak - 25) * Math.exp(-(t - 30) / THERMAL_TAU_S), runaway: false, vent: true };
}

/**
 * Nail scenario without runaway: «дим із клапана» — the scripted valve opens at 90 °C on the rise and stays open
 * (M3; scenario value as in the pilot, below the §M7 oven thresholds because the internal short heats the jelly
 * roll locally).
 */
export const NAIL_SMOKE_VENT_C = 90;

/** Inter-cell coupling k, 1/s: without barrier 0.01, with an aerogel barrier 0.0005. */
export const PROPAGATION_K = { noBarrier: 0.01, barrier: 0.0005 } as const;

export interface ModuleRun {
  /** Time each cell entered runaway (null = never), model s. */
  runawayAtS: (number | null)[];
  /** Final temperatures, °C. */
  finalC: number[];
  /** Temperatures every 5 s for the chart. */
  trace: { timeS: number; tempsC: number[] }[];
}

/** 4 cells in a row at 25 °C ambient, cell 1 starts in runaway: dT_j/dt += k·Σ_neighbours (T_i − T_j). */
export function runModule(chem: Chemistry, barrier: boolean, tMaxS = 3600, nCells = 4): ModuleRun {
  const k = barrier ? PROPAGATION_K.barrier : PROPAGATION_K.noBarrier;
  const cells = Array.from({ length: nCells }, () => new ThermalCell(chem));
  cells[0]!.igniteAt(THERMAL_CHEM[chem].stages[1]!.tK);
  const trace: ModuleRun['trace'] = [];
  for (let t = 0; t < tMaxS; t += THERMAL_DT_S) {
    if (t % 5 === 0) trace.push({ timeS: t, tempsC: cells.map((c) => c.tempC) });
    const temps = cells.map((c) => c.tempC);
    cells.forEach((c, j) => {
      let flux = 0;
      if (j > 0) flux += temps[j - 1]! - temps[j]!;
      if (j < nCells - 1) flux += temps[j + 1]! - temps[j]!;
      c.step(THERMAL_DT_S, 25, k * flux);
    });
  }
  return {
    runawayAtS: cells.map((c) => (c.runaway ? c.events.runaway! : null)),
    finalC: cells.map((c) => c.tempC),
    trace,
  };
}

export interface LiveModule {
  readonly cells: readonly ThermalCell[];
  /** Model seconds since creation / `reset`. */
  readonly timeS: number;
  /** Cell temperatures, °C (live array). */
  readonly tempsC: readonly number[];
  /** Advance by `dtS` model seconds (internally in `THERMAL_DT_S` steps; any dt). */
  step(dtS: number): void;
  /** Put cell `j` into runaway now. */
  ignite(j: number): void;
  setBarrier(barrier: boolean): void;
  reset(): void;
}

/**
 * Live version of `runModule` (M3) for a step that animates propagation in real time: the same coupling
 * dT_j/dt += k·Σ_neighbours (T_i − T_j) at ambient `ambientC`, stepped by the caller. Stepping it by
 * `tMaxS` from a fresh `ignite(0)` reproduces `runModule` exactly.
 */
export function createLiveModule(
  chem: Chemistry,
  o: { barrier?: boolean; nCells?: number; ambientC?: number; igniteFirst?: boolean } = {},
): LiveModule {
  const n = o.nCells ?? 4;
  const ambient = o.ambientC ?? 25;
  let k = o.barrier ? PROPAGATION_K.barrier : PROPAGATION_K.noBarrier;
  let cells: ThermalCell[] = [];
  const temps: number[] = [];
  let t = 0;
  let carry = 0;
  const reset = (): void => {
    cells = Array.from({ length: n }, () => new ThermalCell(chem));
    if (o.igniteFirst ?? true) cells[0]!.igniteAt(THERMAL_CHEM[chem].stages[1]!.tK);
    t = 0;
    carry = 0;
    cells.forEach((c, j) => (temps[j] = c.tempC));
  };
  const substep = (): void => {
    const now = cells.map((c) => c.tempC);
    cells.forEach((c, j) => {
      let flux = 0;
      if (j > 0) flux += now[j - 1]! - now[j]!;
      if (j < n - 1) flux += now[j + 1]! - now[j]!;
      c.step(THERMAL_DT_S, ambient, k * flux);
    });
    t += THERMAL_DT_S;
  };
  reset();
  return {
    get cells() {
      return cells;
    },
    get timeS() {
      return t;
    },
    tempsC: temps,
    step(dtS) {
      carry += dtS;
      while (carry >= THERMAL_DT_S - 1e-9) {
        substep();
        carry -= THERMAL_DT_S;
      }
      cells.forEach((c, j) => (temps[j] = c.tempC));
    },
    ignite(j) {
      cells[j]?.igniteAt(Math.max(cells[j]!.tempC, THERMAL_CHEM[chem].stages[1]!.tK));
    },
    setBarrier(barrier) {
      k = barrier ? PROPAGATION_K.barrier : PROPAGATION_K.noBarrier;
    },
    reset,
  };
}
