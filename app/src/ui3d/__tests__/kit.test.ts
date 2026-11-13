import { describe, expect, it } from 'vitest';
import { iconDistance, ICON_NAMES } from '../core/icons';
import { layoutTree, UiNode } from '../core/node';
import { niceTicks, nudge, quantize, tToValue, valueToT } from '../widgets/slider-scale';
import { mathMarkup } from '../widgets/math';

describe('slider scale', () => {
  it('maps log scales both ways', () => {
    const s = { min: 0.05, max: 1000, scale: 'log' as const };
    expect(valueToT(s, 0.05)).toBe(0);
    expect(valueToT(s, 1000)).toBeCloseTo(1);
    expect(tToValue(s, 0.5)).toBeCloseTo(Math.sqrt(0.05 * 1000), 6);
    expect(tToValue({ ...s, step: 2 }, 0.5)).toBe(7.1);
  });
  it('rounds to steps, snaps and stops', () => {
    expect(quantize({ min: 0, max: 1200, step: 50 }, 1012)).toBe(1000);
    expect(quantize({ min: 0, max: 1, step: 0.1 }, 0.30000001)).toBe(0.3);
    expect(quantize({ min: 0, max: 1200, snaps: [1000] }, 990)).toBe(1000);
    const wheel = { min: 1e-10, max: 1e-2, scale: 'log' as const, stops: [1e-2, 1e-3, 1e-5, 1e-9, 1e-10] };
    expect(quantize(wheel, 3e-6)).toBe(1e-5);
    expect(nudge(wheel, 1e-5, 1)).toBe(1e-3);
    expect(nudge(wheel, 1e-10, -1)).toBe(1e-10);
    expect(nudge({ min: 0, max: 10, step: 0.5 }, 2, 3)).toBe(3.5);
  });
  it('produces nice ticks', () => {
    expect(niceTicks(0, 45, 5)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(1, 1000, 5, true)).toEqual([1, 10, 100, 1000]);
    expect(niceTicks(-4, 6, 5)).toEqual([-4, -2, 0, 2, 4, 6]);
  });
});

describe('layout', () => {
  const box = (w: number | 'fill' | 'hug', h: number | 'fill' | 'hug', props = {}): UiNode =>
    new UiNode({ width: w, height: h, ...props });
  it('stacks a column with gap and padding and hugs its content', () => {
    const a = box(100, 20);
    const b = box(60, 30);
    const colNode = new UiNode({ dir: 'col', gap: 10, pad: [5, 8], align: 'center', children: [a, b] });
    const root = new UiNode({ dir: 'stack', children: [colNode] });
    layoutTree(root, 400, 300);
    expect([colNode.bw, colNode.bh]).toEqual([116, 70]);
    expect([a.bx, a.by, b.bx, b.by]).toEqual([8, 5, 28, 35]);
  });
  it('shares the free width among fill children by grow', () => {
    const a = box(50, 10);
    const b = box('fill', 10);
    const c = box('fill', 10, { grow: 3 });
    const rowNode = new UiNode({ dir: 'row', gap: 10, width: 'fill', children: [a, b, c] });
    layoutTree(new UiNode({ dir: 'col', children: [rowNode] }), 270, 100);
    expect([b.bw, c.bw]).toEqual([50, 150]);
    expect(c.bx).toBe(120);
  });
  it('wraps rows and places floats', () => {
    const kids = [box(60, 20), box(60, 20), box(60, 30)];
    const badge = box(10, 10, { float: { ax: 1, ay: 0, px: 0.5, py: 0.5 } });
    const wrap = new UiNode({ dir: 'row', wrap: true, gap: 10, width: 140, children: [...kids, badge] });
    layoutTree(new UiNode({ dir: 'col', children: [wrap] }), 500, 500);
    expect(wrap.bh).toBe(60);
    expect([kids[2]!.bx, kids[2]!.by]).toEqual([0, 30]);
    expect([badge.bx, badge.by]).toEqual([135, -5]);
  });
  it('skips hidden children', () => {
    const a = box(40, 40);
    const b = box(40, 40, { visible: false });
    const n = new UiNode({ dir: 'col', gap: 6, children: [a, b] });
    layoutTree(new UiNode({ dir: 'col', children: [n] }), 100, 100);
    expect(n.bh).toBe(40);
  });
});

describe('icons', () => {
  it('every icon has ink inside its 24-unit cell and a clear margin', () => {
    for (const name of ICON_NAMES) {
      let inside = 0;
      for (let y = 0.5; y < 24; y++)
        for (let x = 0.5; x < 24; x++) if (iconDistance(name, x, y) < 0) inside++;
      expect(inside, name).toBeGreaterThan(12);
      expect(iconDistance(name, 0.2, 0.2), name).toBeGreaterThan(0);
    }
  });
});

describe('math markup', () => {
  it('typesets plain indices and exponents, leaves emphasis alone', () => {
    expect(mathMarkup('FF = P_mp / (V_oc · I_sc)')).toBe('FF = P_{mp} / (V_{oc} · I_{sc})');
    expect(mathMarkup('R ≈ 1,2 fm · A^(1/3)')).toBe('R ≈ 1,2 fm · A^{1/3}');
    expect(mathMarkup('10^-19 C і x^2')).toBe('10^{-19} C і x^2');
    expect(mathMarkup('_Пояснення._ струм I_L')).toBe('_Пояснення._ струм I_{L}');
    expect(mathMarkup('U_{rms} уже в дужках')).toBe('U_{rms} уже в дужках');
  });
});
