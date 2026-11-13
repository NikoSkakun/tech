/**
 * Sim binding for step 11: the illustrative thermal-runaway model (§M7) stepped live in accelerated time for
 * an NMC and an LFP cell side by side («близнюковий режим»), in four scenarios:
 *
 * - `oven`        both cells sit in an oven at a chosen temperature (model time ×30);
 * - `overcharge`  no BMS: the effective ambient ramps 25 + 2·t/60 °C (×300); with BMS the charge is cut at the
 *                 sim's cut-off time (`runOvercharge(chem, true).cutoffS`, shown at ×30);
 * - `nail`        scripted curve `nailScenarioC` in real time (not integrated);
 * - `propagation` four cells in a row per chemistry (`createLiveModule`), cell 1 starts in runaway, with or
 *                 without barriers (×30).
 */
import {
  THERMAL_CHEM,
  THERMAL_DT_S,
  ThermalCell,
  createLiveModule,
  nailScenarioC,
  overchargeOvenC,
  runOvercharge,
  type Chemistry,
  type LiveModule,
} from '@electricity/sim/lab-battery';

export type ThermalScenario = 'oven' | 'overcharge' | 'nail' | 'propagation';
export const THERMAL_SPEED: Record<ThermalScenario, number> = {
  oven: 30,
  overcharge: 300,
  nail: 1,
  propagation: 30,
};
export const CHEMS2: readonly Chemistry[] = ['NMC', 'LFP'];
export const MODULE_CELLS = 4;
/** The chart of the propagation scenario follows the first neighbour of the burning cell (cell № 2). */
export const PLOTTED_ROW_CELL = 1;

export interface CellView {
  tempC: number;
  /** Stages passed so far. */
  sei: boolean;
  separator: boolean;
  vent: boolean;
  runaway: boolean;
}

export interface ThermalOptions {
  scenario: ThermalScenario;
  ovenC: number;
  socPct: number;
  bms: boolean;
  barrier: boolean;
}

export interface ThermalSession {
  options: ThermalOptions;
  running: boolean;
  /** Model time, s. */
  timeS: number;
  /** Ambient the cells see right now, °C. */
  ambientC: number;
  /** The BMS has cut the overcharge (success state). */
  bmsCut: boolean;
  cell: Record<Chemistry, CellView>;
  /** Propagation rows: four cells per chemistry. */
  row: Record<Chemistry, CellView[]>;
  /** Chart samples: model time (s) and the temperature of each chemistry's plotted cell. */
  trace: { t: number[]; NMC: number[]; LFP: number[]; ambient: number[] };
  start(options: ThermalOptions): void;
  /** Advance by `dt` screen seconds; returns the chemistries that entered runaway during this tick. */
  tick(dt: number): Chemistry[];
}

const cold = (): CellView => ({ tempC: 25, sei: false, separator: false, vent: false, runaway: false });

function view(c: ThermalCell, out: CellView): CellView {
  const p = THERMAL_CHEM[c.chem];
  out.tempC = c.tempC;
  out.sei ||= c.tempC >= p.stages[0]!.tK;
  out.separator ||= c.tempC >= p.separatorC;
  out.vent ||= c.tempC >= p.ventC;
  out.runaway = c.runaway;
  return out;
}

/** Model time at which the BMS of the twin rig has cut the overcharge of both cells, s (sim scenario value). */
export const BMS_CUTOFF_S = Math.max(...CHEMS2.map((chem) => runOvercharge(chem, true).cutoffS ?? 0));

/**
 * Model seconds per screen second of a run — what the step's honesty chip prints. The overcharge takes 72–113
 * model minutes without a BMS (×300), but only `BMS_CUTOFF_S` with one, so that run is shown at ×30.
 */
export function thermalSpeed(o: Pick<ThermalOptions, 'scenario' | 'bms'>): number {
  return o.scenario === 'overcharge' && o.bms ? THERMAL_SPEED.oven : THERMAL_SPEED[o.scenario];
}

export function createThermalSession(): ThermalSession {
  let single: Record<Chemistry, ThermalCell> = { NMC: new ThermalCell('NMC'), LFP: new ThermalCell('LFP') };
  let rows: Record<Chemistry, LiveModule> = { NMC: createLiveModule('NMC'), LFP: createLiveModule('LFP') };
  let sampleAt = 0;
  const self: ThermalSession = {
    options: { scenario: 'oven', ovenC: 25, socPct: 80, bms: true, barrier: false },
    running: false,
    timeS: 0,
    ambientC: 25,
    bmsCut: false,
    cell: { NMC: cold(), LFP: cold() },
    row: { NMC: [], LFP: [] },
    trace: { t: [], NMC: [], LFP: [], ambient: [] },
    start(options) {
      self.options = { ...options };
      self.running = true;
      self.timeS = 0;
      self.bmsCut = false;
      sampleAt = 0;
      single = { NMC: new ThermalCell('NMC'), LFP: new ThermalCell('LFP') };
      self.cell = { NMC: cold(), LFP: cold() };
      // cell 1 of each row starts in runaway (§M7); the sim's live module couples the neighbours
      rows = {
        NMC: createLiveModule('NMC', { nCells: MODULE_CELLS, barrier: options.barrier }),
        LFP: createLiveModule('LFP', { nCells: MODULE_CELLS, barrier: options.barrier }),
      };
      for (const chem of CHEMS2) self.row[chem] = rows[chem].cells.map(cold);
      self.trace = { t: [], NMC: [], LFP: [], ambient: [] };
    },
    tick(dt) {
      if (!self.running) return [];
      const o = self.options;
      const before = CHEMS2.filter(
        (c) => self.cell[c].runaway || self.row[c].slice(1).some((v) => v.runaway),
      );
      let left = dt * thermalSpeed(o);
      const end = self.timeS + left;
      if (o.scenario === 'nail') {
        self.timeS = end;
        for (const chem of CHEMS2) {
          const n = nailScenarioC(chem, o.socPct, self.timeS);
          const v = self.cell[chem];
          v.tempC = n.tempC;
          v.sei ||= n.tempC >= THERMAL_CHEM[chem].stages[0]!.tK;
          v.vent ||= n.vent; // the scripted valve of the scenario (stays open)
          v.runaway = n.runaway;
        }
      } else if (o.scenario === 'overcharge' && o.bms) {
        // the BMS opens at 4,25 V (NMC) / 3,65 V (LFP): nothing heats up
        self.timeS = Math.min(end, BMS_CUTOFF_S);
        self.bmsCut = self.timeS >= BMS_CUTOFF_S;
      } else if (o.scenario === 'propagation') {
        for (const chem of CHEMS2) {
          rows[chem].setBarrier(o.barrier);
          rows[chem].step(left);
        }
        self.timeS = end;
      } else
        while (left > 1e-9) {
          const h = Math.min(THERMAL_DT_S, left);
          left -= h;
          self.ambientC = o.scenario === 'oven' ? o.ovenC : overchargeOvenC(self.timeS);
          for (const chem of CHEMS2) single[chem].step(h, self.ambientC);
          self.timeS += h;
        }
      if (o.scenario === 'propagation') self.ambientC = 25;
      for (const chem of CHEMS2) {
        if (o.scenario !== 'nail') view(single[chem], self.cell[chem]);
        rows[chem].cells.forEach((c, j) => view(c, self.row[chem][j]!));
      }
      // chart samples: ≈ 300 points over a typical run
      const every = o.scenario === 'nail' ? 0.25 : o.scenario === 'overcharge' ? (o.bms ? 4 : 30) : 4;
      if (self.timeS >= sampleAt) {
        sampleAt = self.timeS + every;
        self.trace.t.push(self.timeS);
        for (const chem of CHEMS2)
          self.trace[chem].push(
            o.scenario === 'propagation' ? self.row[chem][PLOTTED_ROW_CELL]!.tempC : self.cell[chem].tempC,
          );
        self.trace.ambient.push(
          o.scenario === 'nail' || (o.scenario === 'overcharge' && o.bms) ? 25 : self.ambientC,
        );
      }
      return CHEMS2.filter(
        (c) => !before.includes(c) && (self.cell[c].runaway || self.row[c].slice(1).some((v) => v.runaway)),
      );
    },
  };
  self.start(self.options);
  self.running = false;
  return self;
}
