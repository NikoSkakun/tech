import { describe, expect, it } from 'vitest';
import {
  ringLayout,
  ringPoint,
  ringS,
  valuePerPx,
  valueS,
  type RingFrame,
  type RingLayout,
} from '../tools/focus-ring-layout';
import { applySway, createSway, SWAY_YAW } from '../../world/sway';

const frame: RingFrame = { width: 1280, height: 720, floor: 630, under: 36, left: 0, right: 920, freeX: 460 };
const bottom = (l: RingLayout): number => l.cy + l.r + l.t;

describe('focus ring layout (F-ring-dock: always the bottom arc, apart from the lens)', () => {
  it('stands at the bottom, above the floor with room for the mark names under the band', () => {
    const l = ringLayout(frame);
    expect(bottom(l)).toBeCloseTo(frame.floor - frame.under, 6);
    // the arc's ends rise: the whole band is above the floor, its middle the lowest point
    const end = ringPoint(l, l.half, 1);
    expect(end.y).toBeLessThan(bottom(l));
    expect(end.y).toBeGreaterThan(0.75 * frame.height);
  });

  it('depends on the viewport only: the same frame gives the same arc', () => {
    expect(ringLayout({ ...frame })).toEqual(ringLayout(frame));
  });

  it('is a gentle arc, never a straight bar, and sized by the viewport', () => {
    const small = ringLayout(frame);
    const big = ringLayout({ width: 2000, height: 1040, floor: 920, under: 40, left: 0, right: 1460, freeX: 730 });
    expect(small.r).toBeLessThan(1e4);
    expect(big.half / small.half).toBeCloseTo(1040 / 720, 1);
    expect(big.t).toBeGreaterThan(small.t);
  });

  it('keeps the arc inside the free area and maps values along it, both ways', () => {
    for (const f of [frame, { ...frame, right: 500, freeX: 480 }]) {
      const l = ringLayout(f);
      expect(l.cx - l.half - l.t).toBeGreaterThanOrEqual(f.left - 1e-6);
      expect(l.cx + l.half + l.t).toBeLessThanOrEqual(f.right + 1e-6);
    }
    const l = ringLayout(frame);
    const s0 = valueS(l, 0, 0, 2);
    const s2 = valueS(l, 2, 0, 2);
    expect(s0).toBeLessThan(0);
    expect(s2).toBeCloseTo(-s0, 6);
    const p = ringPoint(l, valueS(l, 1.2, 0, 2), 0);
    expect(ringS(l, p.x, p.y)).toBeCloseTo(valueS(l, 1.2, 0, 2), 6);
  });

  it('a drag along the arc moves the value by the arc length the finger travelled (marker under the finger)', () => {
    const l = ringLayout(frame);
    const a = ringPoint(l, valueS(l, 0.5, 0, 2), 0.5);
    const b = ringPoint(l, valueS(l, 1.5, 0, 2), 0.5);
    const ds = ringS(l, b.x, b.y) - ringS(l, a.x, a.y);
    expect(0.5 + ds * valuePerPx(l, 0, 2)).toBeCloseTo(1.5, 6);
  });
});

describe('lens mode sway', () => {
  it('follows the hand within a few degrees and springs back on release', () => {
    const sway = createSway(false);
    sway.hold(5000, 0, 720);
    for (let i = 0; i < 60; i++) sway.step(1 / 60);
    expect(Math.abs(sway.yaw)).toBeLessThanOrEqual(SWAY_YAW);
    expect(Math.abs(sway.yaw)).toBeGreaterThan(0.09);
    sway.release();
    for (let i = 0; i < 120; i++) sway.step(1 / 60);
    expect(Math.abs(sway.yaw)).toBeLessThan(1e-3);
  });

  it('turns a shot about its target, keeping the distance', () => {
    const shot = { position: [0, 0, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    applySway(shot, 0.1, 0.05);
    const [x, y, z] = shot.position as [number, number, number];
    expect(Math.hypot(x, y, z)).toBeCloseTo(10, 6);
    expect(Math.abs(x)).toBeGreaterThan(0.5);
  });
});
