/**
 * The manifest is eager and tiny, so it mirrors the chapter title and the step ids / titles of the generated
 * content by hand. This test is the guard: it fails when the mirror drifts from the content, when a hotspot
 * helper would return nothing, or when a simulation label the UI relies on disappears.
 */
import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/plant-wind.json';
import { DRIVETRAINS, ROTOR_SILHOUETTES } from '@electricity/sim/plant-wind';
import content, { L, hotspotNames } from '../content';
import manifest from '../index';

describe('plant-wind manifest and content', () => {
  it('mirrors the generated chapter title and steps', () => {
    expect(manifest.id).toBe(raw.id);
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect(manifest.subtitle).toBe(raw.steps[0]!.title);
  });

  it('keeps every hotspot of the document reachable by name', () => {
    const expected: Record<string, number> = { overview: 3, 'wind-power': 1, betz: 1, blade: 2, nacelle: 10, drivetrain: 2, 'power-curve': 1, 'wind-farm': 2, 'capacity-factor': 1, offshore: 4, role: 2 };
    for (const [step, count] of Object.entries(expected)) expect(hotspotNames(step), step).toHaveLength(count);
  });

  it('passes the scene labels through defineContent', () => {
    expect(content.labels?.dayNight).toBe(L.dayNight);
    expect(Object.values(L).every((s) => s.length > 0)).toBe(true);
  });

  it('relies on labels the simulation library provides', () => {
    expect(ROTOR_SILHOUETTES.map((s) => s.diameterM)).toEqual([20, 82, 170, 236, 310]);
    expect(Object.keys(DRIVETRAINS)).toEqual(['A_DFIG', 'B_DIRECT', 'C_MEDIUM']);
  });
});
