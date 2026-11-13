// M3 helpers requested by the lab-battery pilot (additive; the original fixtures stay in the other tests).
import { describe, expect, it } from 'vitest';
import {
  BMS_OVERCHARGE_CUTOFF_S,
  CELLS,
  chargeCcCv,
  createBms,
  createLiveModule,
  discharge,
  nailScenarioC,
  runModule,
  runOvercharge,
} from '..';

describe('CellSample running Wh and heat', () => {
  it('discharge: the last sample carries the run totals, values grow monotonically', () => {
    const r = discharge(CELLS['21700-NMC'], 1);
    const last = r.curve[r.curve.length - 1]!;
    expect(last.wh).toBeCloseTo(r.wh, 9);
    expect(last.heatJ).toBeCloseTo(r.heatJ, 9);
    expect(r.curve[0]!.wh).toBe(0);
    for (let i = 1; i < r.curve.length; i++) expect(r.curve[i]!.wh).toBeGreaterThanOrEqual(r.curve[i - 1]!.wh);
  });
  it('charge: energy in ≥ Ah × OCV-ish and positive heat', () => {
    const c = chargeCcCv(CELLS['LFP-100'], 0.5);
    const last = c.curve[c.curve.length - 1]!;
    expect(last.wh).toBeGreaterThan(c.ah * 3.0);
    expect(last.wh).toBeLessThan(c.ah * 3.7);
    expect(last.heatJ).toBeGreaterThan(0);
  });
});

describe('createBms.setCellSoc', () => {
  it('changes one cell and its voltage only', () => {
    const b = createBms({ socPct: Array.from({ length: 16 }, () => 50) });
    const before = [...b.state.cellVoltagesV];
    b.setCellSoc(3, 90);
    expect(b.state.socPct[3]).toBe(90);
    expect(b.state.cellVoltagesV[3]).toBeGreaterThan(before[3]!);
    expect(b.state.cellVoltagesV[4]).toBe(before[4]);
    b.reset();
    expect(b.state.socPct[3]).toBe(50); // reset returns to the configured SOCs
    expect(() => b.setCellSoc(16, 10)).toThrow();
  });
});

describe('thermal helpers', () => {
  it('runOvercharge with BMS reports the cut-off time', () => {
    expect(runOvercharge('NMC', true).cutoffS).toBe(BMS_OVERCHARGE_CUTOFF_S.NMC);
    expect(runOvercharge('NMC', false).cutoffS).toBeUndefined();
  });
  it('nail scenario vents and the valve stays open', () => {
    expect(nailScenarioC('NMC', 80, 5).vent).toBe(false); // 95 °C
    expect(nailScenarioC('NMC', 80, 9).vent).toBe(true); // 152.5 °C ≥ 140
    expect(nailScenarioC('NMC', 80, 60).vent).toBe(true);
    expect(nailScenarioC('LFP', 100, 10).vent).toBe(false);
    expect(nailScenarioC('LFP', 100, 25).vent).toBe(true);
    expect(nailScenarioC('LFP', 100, 900).vent).toBe(true); // cooled down, still vented
  });
  it('live module reproduces runModule', () => {
    for (const [chem, barrier] of [['LFP', false], ['NMC', true]] as const) {
      const ref = runModule(chem, barrier, 600);
      const live = createLiveModule(chem, { barrier });
      for (let i = 0; i < 60; i++) live.step(10);
      expect(live.timeS).toBe(600);
      live.tempsC.forEach((t, j) => expect(t).toBeCloseTo(ref.finalC[j]!, 9));
      expect(live.cells.map((c) => (c.runaway ? c.events.runaway! : null))).toEqual(ref.runawayAtS);
    }
  });
});
