import { CatmullRomCurve3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/api';
import { catenaryLength, catenaryParameter, catenaryPoints } from '../conductors/catenary';
import { photonEnergyEV, wavelengthToColor } from '../core/color';
import { boltPoints } from '../drama/arc';
import { flowNetwork, splitByConductance } from '../flow/network';
import { bakePath, samplePath, tangentPath } from '../flow/paths';
import { coneDirection, sphereEmitter } from '../particles/emitters';
import { harmonics, mean, rectified, rms, sine, spectrum, spwm, square, thd, threePhase, triangle } from '../signals/waveforms';

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

describe('catenary', () => {
  it('parameter reproduces the requested sag', () => {
    const a = catenaryParameter(100, 8);
    expect(a * (Math.cosh(50 / a) - 1)).toBeCloseTo(8, 8);
    // shallow spans approach the parabola: a ≈ L² / 8s, S ≈ L + 8s² / 3L
    expect(catenaryParameter(100, 1)).toBeCloseTo(100 ** 2 / 8, -1);
    expect(catenaryLength(100, 1)).toBeCloseTo(100 + 8 / 300, 3);
  });

  it('level span: symmetric, lowest in the middle by exactly the sag', () => {
    const pts = catenaryPoints(v(0, 10, 0), v(40, 10, 0), 3, 40);
    expect(pts).toHaveLength(41);
    expect(pts[20]!.y).toBeCloseTo(7, 6);
    expect(pts[5]!.y).toBeCloseTo(pts[35]!.y, 8);
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(7, 6);
  });

  it('inclined span passes through both supports and hangs below the chord', () => {
    const a = v(0, 5, 0);
    const b = v(30, 12, 40);
    const pts = catenaryPoints(a, b, 4, 30);
    expect(pts[0]!.distanceTo(a)).toBeLessThan(1e-9);
    expect(pts[30]!.distanceTo(b)).toBeLessThan(1e-9);
    for (let i = 1; i < 30; i++) expect(pts[i]!.y).toBeLessThan(a.y + ((b.y - a.y) * i) / 30);
  });
});

describe('waveforms', () => {
  it('rms and mean of the classics', () => {
    expect(rms(sine())).toBeCloseTo(Math.SQRT1_2, 6);
    expect(rms(square())).toBeCloseTo(1, 9);
    expect(rms(triangle())).toBeCloseTo(1 / Math.sqrt(3), 4);
    expect(mean(rectified())).toBeCloseTo(2 / Math.PI, 5);
    expect(mean(rectified(true))).toBeCloseTo(1 / Math.PI, 5);
    expect(mean(square(0.25))).toBeCloseTo(-0.5, 2);
  });

  it('three phases sum to zero and are 120° apart', () => {
    for (const theta of [0, 0.7, 2.1, 5]) {
      expect(threePhase(0)(theta) + threePhase(1)(theta) + threePhase(2)(theta)).toBeCloseTo(0, 12);
      expect(threePhase(1)(theta + (2 * Math.PI) / 3)).toBeCloseTo(threePhase(0)(theta), 12);
    }
  });

  it('spectrum: square wave has odd harmonics 4 / πn; THD of a square ≈ 48 %', () => {
    const s = spectrum(square(), 9);
    for (const n of [1, 3, 5, 7, 9]) expect(s[n - 1]).toBeCloseTo(4 / (Math.PI * n), 2);
    for (const n of [2, 4, 6, 8]) expect(s[n - 1]).toBeLessThan(1e-3);
    expect(thd(spectrum(square(), 199))).toBeCloseTo(0.483, 1);
    expect(spectrum(harmonics([1, 0, 0.3]), 3)[2]).toBeCloseTo(0.3, 6);
  });

  it('SPWM: fundamental amplitude equals the modulation index', () => {
    expect(spectrum(spwm(0.8, 21), 1, 1 << 15)[0]).toBeCloseTo(0.8, 1);
    expect(spectrum(spwm(0.4, 21), 1, 1 << 15)[0]).toBeCloseTo(0.4, 1);
  });
});

describe('paths and networks', () => {
  it('baked path is uniform in arc length', () => {
    const curve = new CatmullRomCurve3([v(0, 0, 0), v(1, 2, 0), v(5, 2, 1), v(6, 0, 0)]);
    const path = bakePath(curve, 128);
    expect(path.length).toBeCloseTo(curve.getLength(), 1);
    const steps: number[] = [];
    for (let i = 1; i < 128; i++) steps.push(samplePath(path, i / 127).distanceTo(samplePath(path, (i - 1) / 127)));
    expect(Math.max(...steps) / Math.min(...steps)).toBeLessThan(1.02);
  });

  it('closed path wraps; tangent is unit length', () => {
    const square4 = [v(0, 0, 0), v(2, 0, 0), v(2, 2, 0), v(0, 2, 0)];
    const path = bakePath(square4, 64, true);
    expect(path.length).toBeCloseTo(8, 6);
    expect(samplePath(path, 1.25).distanceTo(samplePath(path, 0.25))).toBeLessThan(1e-6);
    expect(tangentPath(path, 0.1).distanceTo(v(1, 0, 0))).toBeLessThan(1e-6);
  });

  it('network routes share edges and weights are normalised', () => {
    const net = flowNetwork(
      { trunk: [v(0, 0, 0), v(1, 0, 0)], up: [v(1, 0, 0), v(2, 1, 0)], down: [v(1, 0, 0), v(2, -1, 0)] },
      [{ via: ['trunk', 'up'], weight: 3 }, { via: ['trunk', 'down'], weight: 1 }],
    );
    expect(net.weights).toEqual([0.75, 0.25]);
    expect((net.paths[0]!.path as Vector3[])[0]!.distanceTo((net.paths[1]!.path as Vector3[])[0]!)).toBe(0);
    expect(() => flowNetwork({}, [{ via: ['missing'], weight: 1 }])).toThrow();
    // two parallel resistors 10 Ω and 30 Ω: currents split 3 : 1
    expect(splitByConductance([1 / 10, 1 / 30])).toEqual([0.75, 0.25]);
  });
});

describe('misc', () => {
  it('wavelength → colour bands and photon energy', () => {
    expect(wavelengthToColor(300).band).toBe('uv');
    expect(wavelengthToColor(900).band).toBe('ir');
    const green = wavelengthToColor(530).color;
    expect(green.g).toBeGreaterThan(green.r);
    expect(green.g).toBeGreaterThan(green.b);
    const red = wavelengthToColor(680).color;
    expect(red.r).toBeGreaterThan(red.g + 0.5);
    expect(wavelengthToColor(400).waves).toBeGreaterThan(wavelengthToColor(700).waves);
    expect(photonEnergyEV(620)).toBeCloseTo(2.0, 2);
  });

  it('bolts are deterministic per seed and keep their end points', () => {
    const a = boltPoints(v(0, 0, 0), v(2, 0, 0), new Rng(5), 0.2, 4);
    const b = boltPoints(v(0, 0, 0), v(2, 0, 0), new Rng(5), 0.2, 4);
    const c = boltPoints(v(0, 0, 0), v(2, 0, 0), new Rng(6), 0.2, 4);
    expect(a).toHaveLength(17);
    expect(a.map((p) => p.toArray())).toEqual(b.map((p) => p.toArray()));
    expect(a[8]!.distanceTo(c[8]!)).toBeGreaterThan(0);
    expect(a[16]!.distanceTo(v(2, 0, 0))).toBe(0);
  });

  it('emitters: cone stays inside its half-angle; sphere points lie inside the radius', () => {
    const rng = new Rng(3);
    const axis = v(0, 1, 0);
    const d = new Vector3();
    const p = new Vector3();
    for (let i = 0; i < 200; i++) {
      expect(coneDirection(rng, axis, 0.4, d).angleTo(axis)).toBeLessThanOrEqual(0.4 + 1e-9);
      sphereEmitter(2)(rng, p, d);
      expect(p.length()).toBeLessThanOrEqual(2);
      expect(d.length()).toBeCloseTo(1, 6);
    }
  });
});
