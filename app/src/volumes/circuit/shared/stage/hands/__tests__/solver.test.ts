import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BATTERY } from '../../layout';
import { BULB } from '../../bulb';
import { Body } from '../body';
import { Carry } from '../carry';
import { closest, reach } from '../contacts';
import { keepApart } from '../limits';
import { SIDES, batterySpec, floor, lampSpec, obstacles } from '../parts';
import { createSolver } from '../solver';

const run = (step: (dt: number) => void, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) step(1 / 60);
};
/** The part's outline against the stand's sides (most negative clearance; ≥ 0 inside). */
const clearance = (b: Body): number => Math.min(...SIDES.map((s) => s.n.dot(b.x) - s.o - reach(b, b.q, s.n)));
const inside = (b: Body): boolean => clearance(b) > -0.01;

describe('the loose parts fall by physics and come to rest on the board, inside the loop', () => {
  it('a battery let go above the board lands, rolls a little, lies on its side and sleeps', () => {
    const b = new Body(batterySpec());
    b.setPose(new Vector3(0, 1.3, 0), new Quaternion());
    b.v.set(1.5, 0, -0.8);
    b.dynamic = true;
    const solver = createSolver([b], floor());
    run((dt) => solver.step(dt), 4);
    expect(b.asleep).toBe(true);
    expect(b.x.y).toBeCloseTo(BATTERY.radius, 1);
    expect(inside(b)).toBe(true);
  });

  it('a lamp let go upright cannot stand on its round contact: it topples onto its globe and sleeps', () => {
    const l = new Body(lampSpec(BULB));
    l.setPose(new Vector3(0, 1, 0), new Quaternion());
    l.dynamic = true;
    const solver = createSolver([l], floor());
    run((dt) => solver.step(dt), 6);
    expect(l.asleep).toBe(true);
    const up = new Vector3(0, 1, 0).applyQuaternion(l.q);
    expect(Math.abs(up.y)).toBeLessThan(0.6);
    expect(inside(l)).toBe(true);
  });

  it('thrown hard at the stand\'s edge, a part is braked to a stop at it and never crosses it', () => {
    for (const v of [new Vector3(-9, 2, 0), new Vector3(0, 1, 7), new Vector3(6, 0, -6)]) {
      const b = new Body(batterySpec());
      b.setPose(new Vector3(0, 1.3, 0), new Quaternion());
      b.v.copy(v);
      b.dynamic = true;
      const solver = createSolver([b], floor());
      let worst = Infinity;
      run((dt) => {
        solver.step(dt);
        worst = Math.min(worst, clearance(b));
      }, 5);
      expect(worst).toBeGreaterThan(-0.01);
      expect(b.asleep).toBe(true);
    }
  });

  it('let go across a side wire, the battery lies over it and comes to rest', () => {
    for (const z of [0.2, -1.4]) {
      const b = new Body(batterySpec());
      b.setPose(new Vector3(2.3, 1.3, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.4));
      b.dynamic = true;
      const solver = createSolver([b, obstacles()], floor());
      run((dt) => solver.step(dt), 4);
      expect(b.asleep).toBe(true);
      expect(inside(b)).toBe(true);
    }
  });

  it('the two parts do not pass through each other', () => {
    const l = new Body(lampSpec(BULB));
    l.setPose(new Vector3(0, 0.66, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2));
    l.dynamic = true;
    const b = new Body(batterySpec());
    b.setPose(new Vector3(-0.9, 2.2, 0), new Quaternion());
    b.dynamic = true;
    const solver = createSolver([l, b], floor());
    run((dt) => solver.step(dt), 4);
    const globe = l.toBoard(new Vector3(0, BULB.globeY, 0), new Vector3());
    const axis = new Vector3(1, 0, 0).applyQuaternion(b.q);
    const rel = globe.clone().sub(b.x);
    const along = Math.min(Math.max(rel.dot(axis), -0.7), 0.7);
    const gap = rel.addScaledVector(axis, -along).length() - BULB.globe - BATTERY.radius;
    expect(gap).toBeGreaterThan(-0.05);
  });
});

describe('the field around the parts while one is carried', () => {
  it('a part carried straight across a lying one rises over it on the field, smoothly, never touching it', () => {
    const lamp = new Body(lampSpec(BULB));
    lamp.setPose(new Vector3(0, 0.66, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2));
    const b = new Body(batterySpec());
    const c = new Carry();
    const q = new Quaternion();
    c.start(new Vector3(0.2, 1.3, 1.2), q);
    let step = 0;
    let rose = 0;
    let gap = Infinity;
    const last = c.pos.clone();
    // the pointer sweeps from the near side to the far side, right across the lamp, in 2 s
    for (let i = 0; i <= 120; i++) {
      const goal = keepApart(b, q, new Vector3(0.2, 1.3, 1.2 - (2.6 * i) / 120), lamp);
      for (let k = 0; k < 4; k++) {
        c.follow(goal, 1 / 240);
        keepApart(b, q, c.pos, lamp);
      }
      step = Math.max(step, c.pos.distanceTo(last));
      last.copy(c.pos);
      rose = Math.max(rose, c.pos.y - 1.3);
      b.setPose(c.pos, q);
      for (const ca of b.spec.capsules)
        for (const cb of lamp.spec.capsules) {
          const [p0, p1, q0, q1] = [ca.a, ca.b, cb.a, cb.b].map((v, j) => (j < 2 ? b : lamp).toBoard(v, new Vector3()));
          const [s, t] = closest(p0!, p1!, q0!, q1!);
          gap = Math.min(gap, p0!.lerp(p1!, s).distanceTo(q0!.lerp(q1!, t)) - ca.r - cb.r);
        }
    }
    expect(rose).toBeGreaterThan(0.2);
    expect(gap).toBeGreaterThan(0.02);
    expect(step).toBeLessThan(0.08);
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
