import { describe, expect, it } from 'vitest';
import { ringLayout, ringPoint, ringS, valueS, type RingFrame } from '../tools/focus-ring-layout';
import { applySway, createSway, SWAY_YAW } from '../../world/sway';

const frame: RingFrame = { width: 1280, height: 720, floor: 630, left: 0, right: 920, freeX: 460 };
const bottom = (l: ReturnType<typeof ringLayout>): number => l.cy + l.r + l.t;

describe('focus ring layout (F-lens-ring)', () => {
  it('rides a small lens: the band hugs its rim, not pinned', () => {
    const l = ringLayout({ cx: 480, cy: 360, r: 120 }, frame);
    expect(l.pinned).toBe(0);
    expect(l.cy).toBe(360);
    expect(l.r).toBeGreaterThan(120);
    expect(bottom(l)).toBeLessThan(frame.floor);
  });

  it('pins the band above the floor as the lens grows past the frame, and is never a straight bar', () => {
    for (const r of [300, 600, 2000, 1e6]) {
      const l = ringLayout({ cx: 460, cy: 360, r }, frame);
      expect(bottom(l)).toBeLessThanOrEqual(frame.floor + 1e-6);
      expect(l.r).toBeLessThanOrEqual(1.15 * frame.height + 1e-6);
    }
    const lost = ringLayout(null, frame);
    expect(lost.pinned).toBe(1);
    expect(bottom(lost)).toBeCloseTo(frame.floor, 6);
  });

  it('moves continuously as the lens grows (no jump anywhere, into the unprojectable lens too)', () => {
    let prev = ringLayout({ cx: 470, cy: 360, r: 80 }, frame);
    for (let r = 81; r < 3000; r *= 1.01) {
      const l = ringLayout({ cx: 470 - (r / 3000) * 10, cy: 360, r }, frame);
      const a = ringPoint(prev, 0, 0);
      const b = ringPoint(l, 0, 0);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(20);
      prev = l;
    }
    const lost = ringLayout(null, frame);
    const a = ringPoint(prev, 0, 0);
    const b = ringPoint(lost, 0, 0);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(12);
  });

  it('keeps the arc inside the free area and maps values along it, both ways', () => {
    const l = ringLayout(null, frame);
    expect(l.cx - l.half).toBeGreaterThan(frame.left);
    expect(l.cx + l.half).toBeLessThan(frame.right);
    const s0 = valueS(l, 0, 0, 2);
    const s2 = valueS(l, 2, 0, 2);
    expect(s0).toBeLessThan(0);
    expect(s2).toBeCloseTo(-s0, 6);
    const p = ringPoint(l, valueS(l, 1.2, 0, 2), 0);
    expect(ringS(l, p.x, p.y)).toBeCloseTo(valueS(l, 1.2, 0, 2), 6);
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
