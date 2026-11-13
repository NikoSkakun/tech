/**
 * Sim binding for step 11: the illustrative thermal-runaway model (§M7) stepped live in accelerated time for
 * an NMC and an LFP cell side by side («близнюковий режим»), in four scenarios:
 *
 * - `oven`        both cells sit in an oven at a chosen temperature (model time ×30);
 * - `overcharge`  no BMS: the effective ambient ramps 25 + 2·t/60 °C (×300); with BMS the charge is cut;
 * - `nail`        scripted curve `nailScenarioC` in real time (not integrated);
 * - `propagation` four cells in a row per chemistry, cell 1 starts in runaway, with or without barriers (×30).
 */
import {
  PROPAGATION_K,
  THERMAL_CHEM,
  THERMAL_DT_S,
  ThermalCell,
  nailScenarioC,
  overchargeOvenC,
  type Chemistry,
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

export function createThermalSession(): ThermalSession {
  let single: Record<Chemistry, ThermalCell> = { NMC: new ThermalCell('NMC'), LFP: new ThermalCell('LFP') };
  const rows: Record<Chemistry, ThermalCell[]> = { NMC: [], LFP: [] };
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
      for (const chem of CHEMS2) {
        rows[chem] = Array.from({ length: MODULE_CELLS }, () => new ThermalCell(chem));
        rows[chem][0]!.igniteAt(THERMAL_CHEM[chem].stages[1]!.tK); // cell 1 starts in runaway (§M7)
        self.row[chem] = rows[chem].map(cold);
      }
      self.trace = { t: [], NMC: [], LFP: [], ambient: [] };
    },
    tick(dt) {
      if (!self.running) return [];
      const o = self.options;
      const before = CHEMS2.filter(
        (c) => self.cell[c].runaway || self.row[c].slice(1).some((v) => v.runaway),
      );
      let left = dt * THERMAL_SPEED[o.scenario];
      const end = self.timeS + left;
      if (o.scenario === 'nail') {
        self.timeS = end;
        for (const chem of CHEMS2) {
          const n = nailScenarioC(chem, o.socPct, self.timeS);
          const v = self.cell[chem];
          v.tempC = n.tempC;
          v.sei ||= n.tempC >= THERMAL_CHEM[chem].stages[0]!.tK;
          // the nail shorts the cell locally: it vents once the bulk passes ≈ 90 °C (scripted, not the oven threshold)
          v.vent ||= n.tempC >= 90;
          v.runaway = n.runaway;
        }
      } else if (o.scenario === 'overcharge' && o.bms) {
        self.timeS = end;
        self.bmsCut = self.timeS > 240; // the BMS opens at 4,25 V (NMC) / 3,65 V (LFP): nothing heats up
      } else
        while (left > 1e-9) {
          const h = Math.min(THERMAL_DT_S, left);
          left -= h;
          self.ambientC =
            o.scenario === 'oven' ? o.ovenC : o.scenario === 'overcharge' ? overchargeOvenC(self.timeS) : 25;
          if (o.scenario === 'propagation') {
            const k = o.barrier ? PROPAGATION_K.barrier : PROPAGATION_K.noBarrier;
            for (const chem of CHEMS2) {
              const temps = rows[chem].map((c) => c.tempC);
              rows[chem].forEach((c, j) =>
                c.step(
                  h,
                  25,
                  k * ((temps[j - 1] ?? temps[j]!) + (temps[j + 1] ?? temps[j]!) - 2 * temps[j]!),
                ),
              );
            }
          } else for (const chem of CHEMS2) single[chem].step(h, self.ambientC);
          self.timeS += h;
        }
      for (const chem of CHEMS2) {
        if (o.scenario !== 'nail') view(single[chem], self.cell[chem]);
        rows[chem].forEach((c, j) => view(c, self.row[chem][j]!));
      }
      // chart samples: ≈ 300 points over a typical run
      const every = o.scenario === 'nail' ? 0.25 : o.scenario === 'overcharge' ? 30 : 4;
      if (self.timeS >= sampleAt) {
        sampleAt = self.timeS + every;
        const plotted = (chem: Chemistry): number =>
          o.scenario === 'propagation' ? self.row[chem][1]!.tempC : self.cell[chem].tempC;
        self.trace.t.push(self.timeS);
        self.trace.NMC.push(plotted('NMC'));
        self.trace.LFP.push(plotted('LFP'));
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
