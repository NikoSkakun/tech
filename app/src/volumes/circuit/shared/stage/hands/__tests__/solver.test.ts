import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BATTERY } from '../../layout';
import { BULB } from '../../bulb';
import { Body } from '../body';
import { Carry } from '../carry';
import { REST, batterySpec, lampSpec, restWalls } from '../parts';
import { createSolver } from '../solver';

const run = (step: (dt: number) => void, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) step(1 / 60);
};
const inside = (b: Body): boolean =>
  b.x.x >= REST.x0 && b.x.x <= REST.x1 && b.x.z >= REST.z0 && b.x.z <= REST.z1;

describe('the loose parts fall by physics and come to rest on the board, inside the loop', () => {
  it('a battery let go above the board lands, rolls a little, lies on its side and sleeps', () => {
    const b = new Body(batterySpec());
    b.setPose(new Vector3(0, 1.3, 0), new Quaternion());
    b.v.set(1.5, 0, -0.8);
    b.dynamic = true;
    const solver = createSolver([b], restWalls());
    run((dt) => solver.step(dt), 4);
    expect(b.asleep).toBe(true);
    expect(b.x.y).toBeCloseTo(BATTERY.radius, 1);
    expect(inside(b)).toBe(true);
  });

  it('a lamp let go upright cannot stand on its round contact: it topples onto its globe and sleeps', () => {
    const l = new Body(lampSpec(BULB));
    l.setPose(new Vector3(0, 1, 0), new Quaternion());
    l.dynamic = true;
    const solver = createSolver([l], restWalls());
    run((dt) => solver.step(dt), 6);
    expect(l.asleep).toBe(true);
    const up = new Vector3(0, 1, 0).applyQuaternion(l.q);
    expect(Math.abs(up.y)).toBeLessThan(0.6);
    expect(inside(l)).toBe(true);
  });

  it('a part let go outside the limits drifts in as it falls (soft walls, no jump)', () => {
    const b = new Body(batterySpec());
    b.setPose(new Vector3(0, 1.3, 1.6), new Quaternion());
    b.dynamic = true;
    const solver = createSolver([b], restWalls());
    let step = 0;
    const last = b.x.clone();
    run((dt) => {
      solver.step(dt);
      step = Math.max(step, Math.hypot(b.x.x - last.x, b.x.z - last.z));
      last.copy(b.x);
    }, 4);
    expect(b.x.z).toBeLessThanOrEqual(REST.z1 - BATTERY.radius + 0.02);
    expect(step).toBeLessThan(0.05);
  });

  it('the two parts do not pass through each other', () => {
    const l = new Body(lampSpec(BULB));
    l.setPose(new Vector3(0, 0.66, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2));
    l.dynamic = true;
    const b = new Body(batterySpec());
    b.setPose(new Vector3(-0.9, 2.2, 0), new Quaternion());
    b.dynamic = true;
    const solver = createSolver([l, b], restWalls());
    run((dt) => solver.step(dt), 4);
    const globe = l.toBoard(new Vector3(0, BULB.globeY, 0), new Vector3());
    const axis = new Vector3(1, 0, 0).applyQuaternion(b.q);
    const rel = globe.clone().sub(b.x);
    const along = Math.min(Math.max(rel.dot(axis), -0.7), 0.7);
    const gap = rel.addScaledVector(axis, -along).length() - BULB.globe - BATTERY.radius;
    expect(gap).toBeGreaterThan(-0.05);
  });
});

describe('the rubber band', () => {
  it('reaches the pointer fast and never overshoots (critically damped)', () => {
    const c = new Carry();
    c.start(new Vector3(), new Quaternion());
    const goal = new Vector3(1, 0, 0);
    let most = 0;
    let t95 = -1;
    for (let i = 1; i <= 60; i++) {
      c.follow(goal, 1 / 60);
      most = Math.max(most, c.pos.x);
      if (t95 < 0 && c.pos.x > 0.95) t95 = i / 60;
    }
    expect(most).toBeLessThanOrEqual(1 + 1e-9);
    expect(t95).toBeGreaterThan(0);
    expect(t95).toBeLessThan(0.25);
  });
});
