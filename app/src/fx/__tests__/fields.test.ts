import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { contourLines } from '../fields/contours';
import {
  barMagnetField,
  currentLoopField,
  dipoleField,
  pointChargesField,
  pointChargesPotential,
  solenoidField,
  straightWireField,
} from '../fields/sources';
import { seedsOnRing, seedsOnSphere, streamline } from '../fields/streamlines';

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

describe('field sources', () => {
  it('point charge: radial, 1/r²', () => {
    const E = pointChargesField([{ position: v(0, 0, 0), q: 2 }]);
    const a = E(v(1, 0, 0), new Vector3());
    const b = E(v(0, 2, 0), new Vector3());
    expect(a.x).toBeCloseTo(2, 6);
    expect(a.y).toBeCloseTo(0, 6);
    expect(b.y).toBeCloseTo(0.5, 6);
  });

  it('straight wire: tangential (right-hand rule), 1/r', () => {
    const B = straightWireField(v(0, 0, 0), v(0, 1, 0), 1);
    const a = B(v(1, 5, 0), new Vector3());
    // current along +Y, point on +X → field along −Z
    expect(a.x).toBeCloseTo(0, 6);
    expect(a.y).toBeCloseTo(0, 6);
    expect(a.z).toBeCloseTo(-1, 6);
    expect(B(v(2, 0, 0), new Vector3()).length()).toBeCloseTo(0.5, 6);
  });

  it('current loop: on-axis field matches the analytic formula', () => {
    // B(z) = 2π·I·R² / (R² + z²)^(3/2) in units where μ₀/4π = 1
    const R = 1.5;
    const B = currentLoopField(v(0, 0, 0), v(0, 0, 1), R, 1, 64);
    for (const z of [0, 0.7, 2]) {
      const exact = (2 * Math.PI * R * R) / Math.pow(R * R + z * z, 1.5);
      expect(B(v(0, 0, z), new Vector3()).z).toBeCloseTo(exact, 2);
    }
  });

  it('dipole and bar magnet agree far away; solenoid is uniform inside', () => {
    const far = v(0, 12, 5);
    const d = 0.2;
    const bar = barMagnetField(v(d / 2, 0, 0), v(-d / 2, 0, 0), 1)(far, new Vector3());
    const dip = dipoleField(v(0, 0, 0), v(d, 0, 0))(far, new Vector3());
    expect(bar.distanceTo(dip) / dip.length()).toBeLessThan(0.01);
    const S = solenoidField(v(0, 0, 0), v(1, 0, 0), 0.5, 6, 1, 24);
    const c = S(v(0, 0, 0), new Vector3());
    const off = S(v(0.6, 0.2, 0.1), new Vector3());
    expect(off.x / c.x).toBeGreaterThan(0.93);
    expect(Math.abs(off.y / off.x)).toBeLessThan(0.05);
  });
});

describe('streamlines (RK4)', () => {
  it('line of a straight wire closes into a circle of constant radius', () => {
    const B = straightWireField(v(0, 0, 0), v(0, 1, 0), 1);
    const line = streamline(B, v(1.2, 0.3, 0), { step: 0.02, maxLength: 20 });
    expect(line.closed).toBe(true);
    expect(line.length).toBeCloseTo(2 * Math.PI * 1.2, 1);
    for (const p of line.points) {
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(1.2, 4);
      expect(p.y).toBeCloseTo(0.3, 6);
    }
  });

  it('line of a single charge is straight and leaves through the bounds', () => {
    const E = pointChargesField([{ position: v(0, 0, 0), q: 1 }]);
    const line = streamline(E, v(0.3, 0.4, 0), { step: 0.05, bounds: { center: v(0, 0, 0), radius: 3 }, detectLoop: false });
    const end = line.points[line.points.length - 1]!;
    expect(end.length()).toBeGreaterThan(3);
    expect(end.clone().normalize().distanceTo(v(0.6, 0.8, 0))).toBeLessThan(1e-6);
  });

  it('line from + ends at − ; the dipole pattern is mirror-symmetric', () => {
    const plus = v(-1, 0, 0);
    const minus = v(1, 0, 0);
    const E = pointChargesField([{ position: plus, q: 1 }, { position: minus, q: -1 }]);
    const opts = { step: 0.02, maxLength: 30, stops: [{ position: minus, radius: 0.1 }], detectLoop: false };
    const up = streamline(E, v(-1, 0.1, 0), opts);
    const down = streamline(E, v(-1, -0.1, 0), opts);
    expect(up.points[up.points.length - 1]!.distanceTo(minus)).toBeLessThan(0.11);
    const top = Math.max(...up.points.map((p) => p.y));
    const bottom = Math.min(...down.points.map((p) => p.y));
    expect(top).toBeCloseTo(-bottom, 6);
    // the apex lies on the mid-plane x = 0
    const apex = up.points.reduce((a, b) => (b.y > a.y ? b : a));
    expect(Math.abs(apex.x)).toBeLessThan(0.02);
  });

  it('seed helpers', () => {
    const s = seedsOnSphere(v(1, 2, 3), 0.5, 40);
    expect(s).toHaveLength(40);
    for (const p of s) expect(p.distanceTo(v(1, 2, 3))).toBeCloseTo(0.5, 6);
    const centroid = s.reduce((a, p) => a.add(p), new Vector3()).divideScalar(40);
    expect(centroid.distanceTo(v(1, 2, 3))).toBeLessThan(0.03);
    for (const p of seedsOnRing(v(0, 0, 0), v(0, 1, 0), 2, 8)) expect(Math.abs(p.y)).toBeLessThan(1e-9);
  });
});

describe('contours (marching squares)', () => {
  it('equipotentials of a point charge are circles r = q / φ', () => {
    const phi = pointChargesPotential([{ position: v(0, 0, 0), q: 1 }]);
    const lines = contourLines(phi, { center: v(0, 0, 0), size: 6, resolution: 96 }, [0.5, 1]);
    expect(lines).toHaveLength(2);
    for (const c of lines) {
      expect(c.closed).toBe(true);
      for (const p of c.points) expect(p.length()).toBeCloseTo(1 / c.level, 1);
    }
  });
});
