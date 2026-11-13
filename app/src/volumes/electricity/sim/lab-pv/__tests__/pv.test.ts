import { describe, expect, it } from 'vitest';
import {
  LM440,
  PvString,
  analyseString,
  cellTemperatureC,
  hotSpots,
  optimiserPowerW,
  sectionIrradianceFromShade,
  shadeFromShapes,
  halfCellRectMm,
  uniformString,
  HALF_CELLS,
} from '..';

const relP = (a: number, b: number) => Math.abs(a / b - 1);

/** lab-pv §M1 control table: module, bypass on unless stated; tolerance ≤ 0.5 % in P, ≤ 0.05 V in V. */
const TABLE: {
  label: string;
  g: number[];
  tc: number;
  bypass: boolean;
  voc: number;
  isc: number;
  vmp: number;
  imp: number;
  pmp: number;
  local?: number;
  iscTol?: number;
}[] = [
  {
    label: 'STC',
    g: [1000, 1000, 1000],
    tc: 25,
    bypass: true,
    voc: 39.4,
    isc: 13.9,
    vmp: 33.06,
    imp: 13.31,
    pmp: 439.9,
  },
  {
    label: '800/25',
    g: [800, 800, 800],
    tc: 25,
    bypass: true,
    voc: 39.09,
    isc: 11.12,
    vmp: 33.12,
    imp: 10.65,
    pmp: 352.8,
  },
  {
    label: '500/25',
    g: [500, 500, 500],
    tc: 25,
    bypass: true,
    voc: 38.44,
    isc: 6.95,
    vmp: 33.04,
    imp: 6.66,
    pmp: 220.1,
  },
  {
    label: '200/25',
    g: [200, 200, 200],
    tc: 25,
    bypass: true,
    voc: 37.17,
    isc: 2.78,
    vmp: 32.36,
    imp: 2.66,
    pmp: 86.2,
  },
  {
    label: '1000/65',
    g: [1000, 1000, 1000],
    tc: 65,
    bypass: true,
    voc: 35.46,
    isc: 14.15,
    vmp: 28.93,
    imp: 13.37,
    pmp: 386.7,
  },
  {
    label: '1000/-10',
    g: [1000, 1000, 1000],
    tc: -10,
    bypass: true,
    voc: 42.85,
    isc: 13.68,
    vmp: 36.75,
    imp: 13.22,
    pmp: 485.7,
  },
  {
    label: '800/45 NMOT',
    g: [800, 800, 800],
    tc: 45,
    bypass: true,
    voc: 37.1,
    isc: 11.22,
    vmp: 31.02,
    imp: 10.68,
    pmp: 331.4,
  },
  {
    label: '[1000,1000,500]',
    g: [1000, 1000, 500],
    tc: 25,
    bypass: true,
    voc: 39.08,
    isc: 13.9,
    vmp: 21.66,
    imp: 13.3,
    pmp: 287.9,
    local: 243.0,
  },
  {
    label: '[1000,1000,500] no bypass',
    g: [1000, 1000, 500],
    tc: 25,
    bypass: false,
    voc: 39.08,
    isc: 7.0,
    vmp: 35.45,
    imp: 6.86,
    pmp: 243.0,
    iscTol: 0.05,
  },
  {
    label: '[1000,1000,100] no bypass',
    g: [1000, 1000, 100],
    tc: 25,
    bypass: false,
    voc: 38.34,
    isc: 1.44,
    vmp: 36.01,
    imp: 1.37,
    pmp: 49.4,
    iscTol: 0.05,
  },
  {
    label: '[1000,300,300]',
    g: [1000, 300, 300],
    tc: 25,
    bypass: true,
    voc: 38.29,
    isc: 13.9,
    vmp: 34.17,
    imp: 4.06,
    pmp: 138.7,
    local: 136.0,
  },
];

describe('lab-pv §M1 single-diode module ЛМ-440', () => {
  for (const row of TABLE) {
    it(`control point ${row.label}`, () => {
      const a = analyseString({ modules: [row.g], tcC: row.tc, bypass: row.bypass }, 400);
      expect(Math.abs(a.vocV - row.voc)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(a.iscA - row.isc)).toBeLessThanOrEqual(row.iscTol ?? 0.01);
      expect(Math.abs(a.mpp.vV - row.vmp)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(a.mpp.iA - row.imp)).toBeLessThanOrEqual(0.02);
      expect(relP(a.mpp.pW, row.pmp)).toBeLessThanOrEqual(0.005);
      if (row.local !== undefined) {
        expect(a.localMaxima.length).toBe(2);
        const other = a.localMaxima.find((m) => Math.abs(m.pW - a.mpp.pW) > 1)!;
        expect(relP(other.pW, row.local)).toBeLessThanOrEqual(0.005);
      }
    });
  }

  it('[1000,1000,100] with bypass gives 287.9 W (section bypassed)', () => {
    const a = analyseString({ modules: [[1000, 1000, 100]], tcC: 25 });
    expect(relP(a.mpp.pW, 287.9)).toBeLessThan(0.005);
  });

  it('γ = (P(65)/P(25) − 1)/40 = −0.302 %/°C', () => {
    const p25 = analyseString(uniformString(1000, 25)).mpp.pW;
    const p65 = analyseString(uniformString(1000, 65)).mpp.pW;
    expect(((p65 / p25 - 1) / 40) * 100).toBeCloseTo(-0.302, 3);
  });

  it('string of 10 modules, one section at 100 W/m²: 4247 W @ 13.31 A with bypass, 536 W @ 1.39 A without', () => {
    const mods = Array.from({ length: 10 }, (_, m) => (m === 0 ? [1000, 1000, 100] : [1000, 1000, 1000]));
    const withBp = analyseString({ modules: mods, tcC: 25, bypass: true }, 600).mpp;
    expect(Math.abs(withBp.pW - 4247)).toBeLessThan(5);
    expect(withBp.iA).toBeCloseTo(13.31, 1);
    const noBp = analyseString({ modules: mods, tcC: 25, bypass: false }, 600).mpp;
    expect(Math.abs(noBp.pW - 536)).toBeLessThan(3);
    expect(noBp.iA).toBeCloseTo(1.39, 1);
  });

  it('step 5 operating points on a rheostat (STC)', () => {
    const s = new PvString(uniformString(1000, 25));
    const cases = [
      { r: 1, v: 13.9, i: 13.9, p: 193 },
      { r: 2, v: 27.8, i: 13.9, p: 386 },
      { r: 2.484, v: 33.06, i: 13.31, p: 439.9 },
      { r: 5, v: 37.2, i: 7.45, p: 277 },
      { r: 10, v: 38.4, i: 3.84, p: 147 },
    ];
    for (const c of cases) {
      const op = s.operatingPointR(c.r);
      expect(Math.abs(op.vV - c.v)).toBeLessThan(0.06);
      expect(Math.abs(op.iA - c.i)).toBeLessThan(0.02);
      expect(relP(op.pW, c.p)).toBeLessThan(0.005);
      expect(op.vV).toBeCloseTo(op.iA * c.r, 6);
    }
    // range bounds of the slider
    expect(s.operatingPointR(0.05).iA).toBeCloseTo(13.9, 1);
    expect(s.operatingPointR(1000).vV).toBeGreaterThan(39);
  });

  it('cell temperature via NMOT: Tc = Ta + 25/800·G', () => {
    expect(cellTemperatureC(33, 1000)).toBeCloseTo(64.25, 6);
    expect(cellTemperatureC(-15, 700)).toBeCloseTo(6.875, 6);
    expect(cellTemperatureC(20, 800)).toBeCloseTo(45, 6);
  });

  it('invariants: V(I) decreasing, curve ends on the current axis, Pmp ≤ Voc·Isc, no NaN at range bounds', () => {
    for (const [g, tc] of [
      [0, 25],
      [1, -25],
      [1200, 85],
      [10, 85],
    ] as const) {
      const s = new PvString(uniformString(g, tc));
      const a = s.analyse(300);
      for (let k = 1; k < a.points.length; k++)
        expect(a.points[k]!.vV).toBeLessThanOrEqual(a.points[k - 1]!.vV + 1e-9);
      for (const p of a.points) expect(Number.isFinite(p.vV) && Number.isFinite(p.iA)).toBe(true);
      expect(a.mpp.pW).toBeLessThanOrEqual(a.vocV * a.iscA + 1e-9);
      expect(Number.isFinite(a.fillFactor)).toBe(true);
    }
  });
});

describe('lab-pv step 7 shading, hot spots, optimisers', () => {
  it('one fully shaded half-cell → section at 500 W/m²; 50 % shade → 750 W/m²', () => {
    const shade = new Float64Array(HALF_CELLS);
    shade[0] = 1; // top-left half-cell → section 0, top branch
    expect(sectionIrradianceFromShade(1000, shade)).toEqual([500, 1000, 1000]);
    shade[0] = 0.5;
    expect(sectionIrradianceFromShade(1000, shade)).toEqual([750, 1000, 1000]);
  });

  it('«пташка» on one half-cell = sections [500,1000,1000]: 287.9 W (−35 %) with diodes, 243.0 W (−45 %) without', () => {
    const shade = new Float64Array(HALF_CELLS);
    shade[5 + 6 * 12] = 1; // column 5 → section 2, bottom branch
    const g = sectionIrradianceFromShade(1000, shade);
    expect(g).toEqual([1000, 1000, 500]);
    const on = analyseString({ modules: [g], tcC: 25, bypass: true }).mpp.pW;
    const off = analyseString({ modules: [g], tcC: 25, bypass: false }).mpp.pW;
    expect(relP(on, 287.9)).toBeLessThan(0.005);
    expect(relP(off, 243.0)).toBeLessThan(0.005);
    expect(Math.round((on / 439.9 - 1) * 100)).toBe(-35);
    expect(Math.round((off / 439.9 - 1) * 100)).toBe(-45);
  });

  it('shadow shapes: a polygon exactly covering one half-cell with opacity 0.7 gives s = 0.7 there only', () => {
    const r = halfCellRectMm(7);
    const s = shadeFromShapes([
      {
        polygon: [
          [r.x0, r.y0],
          [r.x1, r.y0],
          [r.x1, r.y1],
          [r.x0, r.y1],
        ],
        opacity: 0.7,
      },
    ]);
    expect(s[7]).toBeCloseTo(0.7, 9);
    expect(s[8]).toBe(0);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(0.7, 9);
  });

  it('hot spot: with bypass |V_k| = 0.4 V → ≈ 70 W orange; without bypass → red; no hot spot at uniform MPP', () => {
    const s = new PvString({ modules: [[1000, 1000, 0]], tcC: 25, bypass: true });
    const hs = hotSpots(s, 13.3);
    expect(hs).toHaveLength(1);
    expect(hs[0]!.colour).toBe('orange');
    expect(hs[0]!.pHotW).toBeCloseTo(((17 * 0.6 + 0.4) * 13.3) / 2, 6);
    expect(hs[0]!.pHotW).toBeGreaterThan(68);
    const mods = Array.from({ length: 10 }, (_, m) => (m === 0 ? [1000, 1000, 100] : [1000, 1000, 1000]));
    const noBp = new PvString({ modules: mods, tcC: 25, bypass: false });
    const red = hotSpots(noBp, 5);
    expect(red[0]!.colour).toBe('red');
    expect(red[0]!.displayW).toBe(200);
    const ok = new PvString(uniformString(1000, 25));
    expect(hotSpots(ok, ok.mpp().iA)).toHaveLength(0);
  });

  it('optimisers: each module at its own MPP × 0.985', () => {
    const cfg = {
      modules: [
        [1000, 1000, 500],
        [1000, 1000, 1000],
      ],
      tcC: 25,
    };
    expect(optimiserPowerW(cfg)).toBeCloseTo((287.9 + 439.9) * 0.985, 0);
  });

  it('LM440 spec mirrors _shared-house §4', () => {
    expect(LM440.iscA).toBe(13.9);
    expect(LM440.vocV).toBe(39.4);
    expect(LM440.areaM2).toBe(1.953);
  });
});
