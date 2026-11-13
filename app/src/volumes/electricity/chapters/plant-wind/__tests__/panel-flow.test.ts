/**
 * The streamlines of step 4 are drawn from this potential-flow solution; the test holds it to textbook
 * values for a NACA 4418-like section, so the picture stays honest: lift at zero angle from the camber,
 * a lift slope near 2π per radian, no air through the surface, clean departure from the trailing edge.
 */
import { describe, expect, it } from 'vitest';
import { createPanelFlow } from '../parts/panel-flow';
import { flowOutline } from '../parts/section';

const DEG = Math.PI / 180;
const flow = createPanelFlow(flowOutline(), { cell: 0.05 });
const v: [number, number] = [0, 0];

describe('plant-wind panel flow (step 4 streamlines)', () => {
  it('gives the lift of a cambered 18 % section', () => {
    const cl0 = flow.liftOf(flow.kuttaGamma(0));
    const cl6 = flow.liftOf(flow.kuttaGamma(6 * DEG));
    expect(cl0).toBeGreaterThan(0.35);
    expect(cl0).toBeLessThan(0.65);
    const slopePerRad = (cl6 - cl0) / (6 * DEG);
    expect(slopePerRad).toBeGreaterThan(2 * Math.PI * 0.95);
    expect(slopePerRad).toBeLessThan(2 * Math.PI * 1.25);
  });

  it('returns to the free stream far from the section', () => {
    flow.velocity(-1.8, 1.5, 6 * DEG, flow.kuttaGamma(6 * DEG), v);
    expect(v[0]).toBeCloseTo(Math.cos(6 * DEG), 0);
    expect(Math.hypot(v[0], v[1])).toBeGreaterThan(0.85);
    expect(Math.hypot(v[0], v[1])).toBeLessThan(1.15);
  });

  it('is faster over the suction side than under the section', () => {
    const g = flow.kuttaGamma(6 * DEG);
    const over = Math.hypot(...flow.velocity(0, 0.2, 6 * DEG, g, v));
    const under = Math.hypot(...flow.velocity(0, -0.16, 6 * DEG, g, v));
    expect(over).toBeGreaterThan(1.15);
    expect(under).toBeLessThan(1);
  });

  it('knows what is inside the section', () => {
    expect(flow.inside(0, 0.02)).toBe(true);
    expect(flow.inside(0, 0.3)).toBe(false);
    expect(flow.inside(-0.35, 0)).toBe(false);
  });
});
