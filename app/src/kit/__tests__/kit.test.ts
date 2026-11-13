import { Color, Vector3, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import {
  Builder,
  G,
  TOWER_SPECS,
  bandGeometry,
  bushingHeight,
  discsFor,
  insulationHeight,
  latticeTower,
  powerLine,
  samplePath,
  substation,
} from '@/kit';

describe('geometry toolbox', () => {
  it('catenary has the requested mid-span sag and keeps its end points', () => {
    const a = new Vector3(0, 30, 0);
    const b = new Vector3(300, 30, 0);
    const pts = G.catenary(a, b, 10, 40);
    expect(pts[0]!.distanceTo(a)).toBeLessThan(1e-9);
    expect(pts[40]!.distanceTo(b)).toBeLessThan(1e-9);
    expect(30 - pts[20]!.y).toBeCloseTo(10, 3);
    // a catenary is flatter than a parabola in the middle and steeper at the supports, so at quarter span it
    // hangs slightly lower than the parabola's 3/4 of the mid sag (ratio ≈ 0.75·(1 + u²/12), u = L/4c)
    expect(30 - pts[10]!.y).toBeGreaterThan(7.5);
    expect(30 - pts[10]!.y).toBeLessThan(7.52);
  });

  it('rounded box stays inside its nominal size', () => {
    const g = G.rbox(2, 1, 3, 0.2, 2);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x).toBeCloseTo(1, 5);
    expect(g.boundingBox!.max.y).toBeCloseTo(0.5, 5);
    expect(g.boundingBox!.min.z).toBeCloseTo(-1.5, 5);
  });

  it('band splitting keeps the surface area and assigns flat colours', () => {
    const plane = G.quads([[0, 0, 2, 2]]);
    const banded = bandGeometry(plane, (x) => x, [[0, new Color(1, 0, 0)]], new Color(0, 0, 1));
    const p = banded.getAttribute('position');
    const c = banded.getAttribute('color');
    let area = 0;
    const v = [new Vector3(), new Vector3(), new Vector3()];
    for (let i = 0; i < p.count; i += 3) {
      v.forEach((q, k) => q.fromBufferAttribute(p, i + k));
      area += v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).length() / 2;
      // every triangle lies entirely on one side of x = 0 and has one colour
      const xs = v.map((q) => q.x);
      const red = c.getX(i) === 1;
      expect(red ? Math.max(...xs) : -Math.min(...xs)).toBeLessThanOrEqual(1e-6);
      expect(c.getX(i + 1)).toBe(c.getX(i));
    }
    expect(area).toBeCloseTo(4, 5);
  });
});

describe('builder', () => {
  it('merges shapes into one mesh per material slot and keeps parts separate', () => {
    const b = new Builder('test');
    b.box(1, 1, 1, { c: 'coral' }).cyl(0.5, 1, { c: 'teal', at: [2, 0, 0] }).sphere(0.3, { slot: 'glow', c: 'yellow' });
    b.part('rotor', { at: [0, 2, 0] }).box(1, 0.2, 0.2, { c: 'mist' });
    b.anchor('top', 0, 3, 0);
    const m = b.build();
    expect(m.drawCalls).toBe(3);
    expect(m.part('rotor').position.y).toBe(2);
    expect(m.anchorLocal('top').y).toBe(3);
    expect(() => m.part('nope')).toThrow();
    const toon = m.group.children.find((o) => o.name === 'test:toon') as Mesh;
    expect(toon.geometry.getAttribute('color').count).toBe(toon.geometry.getAttribute('position').count);
  });
});

describe('grid set — technical honesty', () => {
  it('insulator discs, bundles and sizes grow with voltage', () => {
    expect([35, 110, 150, 220, 330, 400, 500, 750].map(discsFor)).toEqual([3, 8, 10, 14, 20, 23, 27, 40]);
    expect(TOWER_SPECS[110].shields).toBe(1);
    expect(TOWER_SPECS[330].bundle).toBe(2);
    expect(TOWER_SPECS[750].bundle).toBeGreaterThanOrEqual(4);
    expect(TOWER_SPECS[750].gap).toBeGreaterThan(TOWER_SPECS[330].gap);
    expect(bushingHeight(330)).toBeGreaterThan(bushingHeight(110));
    expect(insulationHeight(750)).toBeGreaterThan(insulationHeight(110) * 3);
  });

  it('towers expose three phases per circuit and the right number of shield wires', () => {
    const barrel = latticeTower({ voltage: 110, low: true });
    expect(barrel.phases).toHaveLength(6);
    expect(barrel.shields).toHaveLength(1);
    const portal = latticeTower({ voltage: 750, low: true });
    expect(portal.phases).toHaveLength(3);
    expect(portal.shields).toHaveLength(2);
    // phases hang below the tower top by at least the string length
    expect(portal.anchorLocal('p2').y).toBeLessThan(portal.spec.height - portal.spec.discs * 0.15);
  });

  it('a line strung between towers sags and ends on a substation gantry', () => {
    const a = latticeTower({ voltage: 110, circuits: 1, low: true });
    const b = latticeTower({ voltage: 110, circuits: 1, low: true });
    b.group.position.z = 120;
    const yard = substation({ kV: 110, bays: [{ type: 'line' }], fence: false });
    yard.group.position.z = 240;
    yard.group.rotation.y = Math.PI;
    const line = powerLine([a, b, yard.ports[0]!]);
    const span = line.paths['span0.p1']!;
    const mid = span[Math.floor(span.length / 2)]!;
    expect(mid.y).toBeLessThan(Math.min(span[0]!.y, span[span.length - 1]!.y));
    expect(Object.keys(line.paths).filter((k) => k.includes('.p'))).toHaveLength(6);
  });
});

describe('motion', () => {
  it('ping-pong sampler reverses at the ends, loop sampler wraps', () => {
    const pts = [new Vector3(0, 0, 0), new Vector3(10, 0, 0)];
    const p = new Vector3();
    const t = new Vector3();
    const pp = samplePath(pts, 'pingpong');
    expect(pp.at(12, p, t)).toBe(-1);
    expect(p.x).toBeCloseTo(8);
    expect(t.x).toBeCloseTo(-1);
    samplePath(pts, 'loop').at(12, p, t);
    expect(p.x).toBeCloseTo(2);
  });
});
