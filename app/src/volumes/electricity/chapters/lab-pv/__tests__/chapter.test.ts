import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/lab-pv.json';
import meta from '@electricity/content/generated/lab-pv.manifest.json';
import { cap, doc, docPair, xref } from '../content';
import { CELL_TECHS } from '../data/cell-tech';
import manifest from '../index';
import { L, fill } from '../labels';
import { LIGHT_LOSSES } from '../parts/loss-pie';
import { AM15_BANDS } from '../parts/spectrum';
import { createBenchModel } from '../sim-bindings/bench-model';
import { createShadeState } from '../sim-bindings/shade-state';
import { createStringDesign, worst } from '../sim-bindings/string-design';

describe('lab-pv manifest', () => {
  it('takes ids, titles and blurbs from the generated manifest, in document order', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(meta.steps.map((s) => s.title));
    expect(manifest.title).toBe(raw.title);
    expect(manifest.steps).toHaveLength(11);
  });
  it('is a lab under `home`', () => {
    expect(manifest.group).toBe('labs');
    expect(manifest.parent).toBe('home');
  });
});

describe('lab-pv labels', () => {
  it('finds every document label the steps use (a document change must not pass silently)', () => {
    expect(doc('sunlight', 0)).toBe('Висота Сонця');
    expect(docPair('pv-effect', 4)).toEqual(['Без поля', 'З полем']);
    expect(docPair('light-and-heat', 2)).toHaveLength(2);
    expect(docPair('shading', 5)[1]).toContain('10');
    expect(doc('orientation', 8).split(' / ')).toHaveLength(3);
    expect(docPair('lifecycle', 1)[0]).toContain('TOPCon');
    expect(doc('mppt', 7)).toBe('Глобальне сканування');
    expect(() => doc('mppt', 99)).toThrow();
    expect(cap('розшарування')).toBe('Розшарування');
  });
  it('has no empty own labels and fills placeholders', () => {
    for (const [key, text] of Object.entries(L)) expect(text.trim().length, key).toBeGreaterThan(0);
    expect(fill(L.photonChip, { nm: 550, ev: '2,25' })).toBe('λ = 550 nm · E = 2,25 eV');
  });
  it('resolves cross-reference targets as full addresses', () => {
    expect(xref('plant-solar', 'trackers')).toBe('electricity/plant-solar/trackers');
    expect(xref('nowhere')).toBeUndefined();
  });
  it('places every hotspot of the document (ids used by the steps exist in the content)', () => {
    const used = ['atmosphere', '1-m-frame', 'built-in-field', 'hole', 'silver-fingers', 'mono-vs-poly', 'bifacial', 'label', 'frame', 'mc4', 'i-sc', 'v-oc', 'thermometer', 'mounting-gap', 'bypass-diode', 'hot-cell', 'optimizer', 'sun-path', 'east-west-roof', 'tracker', 'dc-isolator', 'spd', 'earthing', 'climber', 'two-mppt-inputs', 'microcracks', 'glass'];
    const all = raw.steps.flatMap((s) => s.hotspots.map((h) => h.id));
    expect([...used].sort()).toEqual([...all].sort());
  });
});

describe('lab-pv chapter data', () => {
  it('keeps the document numbers of step 2 and step 3', () => {
    expect(LIGHT_LOSSES.reduce((s, x) => s + x.share, 0)).toBe(100);
    expect(CELL_TECHS.map((t) => t.vocV)).toEqual([0.64, 0.69, 0.72, 0.745, 0.73]);
    for (const t of CELL_TECHS) for (const layer of Object.values(t.layers)) expect(L[layer.name]).toBeTruthy();
  });
  it('spectrum bands reproduce the document shares (≈ 5 % UV / 43 % visible / 52 % IR)', () => {
    const energy = (from: number, to: number): number => AM15_BANDS.filter((b) => b.from >= from && b.to <= to).reduce((s, b) => s + b.w * (b.to - b.from), 0);
    const total = energy(0, 9999);
    expect(energy(0, 400) / total).toBeCloseTo(0.05, 1);
    expect(energy(400, 700) / total).toBeCloseTo(0.43, 1);
    expect(energy(700, 9999) / total).toBeCloseTo(0.52, 1);
  });
});

describe('lab-pv simulation bindings (document control points, §M1 / §M4)', () => {
  it('bench: R = 2.484 Ω sits in the MPP of the STC curve', () => {
    const s = createBenchModel().sample({ g: 1000, tc: 25, shade: null, bypass: true, modules: 1, load: { kind: 'resistor', ohm: 2.484 } });
    expect(s.op.pW).toBeCloseTo(439.9, 0);
    expect(s.branch.every((b) => Math.abs(b - s.op.iA / 13.9) < 1e-6)).toBe(true);
  });
  it('shade: one fully shaded half-cell → 287.9 W with diodes (one diode open, orange hot spot), 243 W without', () => {
    const shade = createShadeState();
    shade.paint(0, true);
    const model = createBenchModel();
    const on = model.sample({ g: 1000, tc: 25, shade: shade.total, bypass: true, modules: 1, load: { kind: 'mpp' } });
    expect(on.op.pW).toBeCloseTo(287.9, 0);
    expect(on.diode.filter((d) => d > 0.01)).toHaveLength(1);
    expect(on.hot[0]?.colour).toBe('orange');
    const off = model.sample({ g: 1000, tc: 25, shade: shade.total, bypass: false, modules: 1, load: { kind: 'mpp' } });
    expect(off.op.pW).toBeCloseTo(243.0, 0);
    expect(off.hot).toHaveLength(0);
  });
  it('strings: 6 + 6 is fine, 12 in one string exceeds 500 V', () => {
    const d = createStringDesign(12, 6);
    expect(d.report(0, -20, 70, false).check.severity).toBe('ok');
    for (let i = 6; i < 12; i++) {
      d.cycle(i); // B → not connected
      d.cycle(i); // → A
    }
    expect(d.count(0)).toBe(12);
    expect(worst(d.report(0, -20, 70, false).check.warnings)).toBe('overvoltage');
  });
});
