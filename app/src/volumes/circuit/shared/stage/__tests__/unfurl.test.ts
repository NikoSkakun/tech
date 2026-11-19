import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { resample } from '../dyn-tube';
import { createUnfurl, fitEndFlat, liftEnd } from '../unfurl';

const Y = new Vector3(0, 1, 0);
const length = (p: readonly Vector3[]): number => p.slice(1).reduce((s, q, i) => s + q.distanceTo(p[i]!), 0);
/** The sharpest turn between two neighbouring pieces, radians. */
const kink = (p: readonly Vector3[]): number => {
  let worst = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i]!.clone().sub(p[i - 1]!).normalize();
    const b = p[i + 1]!.clone().sub(p[i]!).normalize();
    worst = Math.max(worst, Math.acos(Math.min(1, a.dot(b))));
  }
  return worst;
};

describe('a strip unrolls from the flashlight onto the stand (`unfurl.ts`)', () => {
  // a straight strip in the torch; an L with a rounded corner, three times as long, on the stand
  const n = 60;
  const home = new Quaternion().setFromAxisAngle(Y, -0.52);
  const from = resample([new Vector3(-1, 0, 0), new Vector3(1, 0, 0)], n);
  const corner: Vector3[] = [new Vector3(0, 0.2, 2)];
  for (let k = 0; k <= 12; k++) {
    const a = (k / 12) * (Math.PI / 2);
    corner.push(new Vector3(-2.5 - 0.5 * Math.sin(a), 0.2, 1.5 + 0.5 * Math.cos(a)));
  }
  corner.push(new Vector3(-3, 0.2, -1.5));
  const to = resample(corner, n);
  const wire = createUnfurl(from, to, home);
  const out: Vector3[] = [];

  it('is the torch shape at 0 and the stand shape at 1', () => {
    const start = new Vector3(0.3, 0.7, -0.4);
    wire.lay(start, home, 0, out);
    out.forEach((p, i) => expect(p.distanceTo(from[i]!.clone().sub(from[0]!).applyQuaternion(home).add(start))).toBeLessThan(1e-9));
    wire.lay(to[0]!, home, 1, out);
    out.forEach((p, i) => expect(p.distanceTo(to[i]!)).toBeLessThan(1e-9));
  });

  it('only grows and never bends sharper than the stand does', () => {
    let last = 0;
    for (let k = 0; k <= 20; k++) {
      wire.lay(to[0]!, home, k / 20, out);
      const l = length(out);
      expect(l).toBeGreaterThanOrEqual(last - 1e-9);
      last = l;
      expect(kink(out)).toBeLessThanOrEqual(kink(to) + 1e-6);
    }
  });

  it('is brought to its far end whole, and swept up to it without a corner', () => {
    wire.lay(to[0]!, home, 0.5, out);
    const before = kink(out);
    const end = out[n - 1]!.clone().add(new Vector3(0.4, 0, -0.3));
    fitEndFlat(out, end);
    expect(Math.hypot(out[n - 1]!.x - end.x, out[n - 1]!.z - end.z)).toBeLessThan(1e-9);
    expect(kink(out)).toBeCloseTo(before, 9);
    liftEnd(out, 0.3, 0.4);
    expect(out[n - 1]!.y).toBeCloseTo(0.2 + 0.3, 9);
    expect(out[0]!.y).toBeCloseTo(0.2, 9);
    expect(kink(out)).toBeLessThan(before + 0.05);
  });
});
