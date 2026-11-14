/** The dam cross-sections of step 3 morph cleanly: same point count, start at the upstream foot, real heights. */
import { describe, expect, it } from 'vitest';
import { DAM_HEIGHT, PROFILES, blend, resample, upstreamFaceX } from '../parts/dam-profiles';

describe('dam profiles', () => {
  it('resamples every type to the same count, starting at the upstream foot', () => {
    for (const [type, poly] of Object.entries(PROFILES)) {
      const r = resample(poly, 48);
      expect(r, type).toHaveLength(48);
      expect(r[0], type).toEqual([poly[0]![0], poly[0]![1]]);
      expect(Math.max(...r.map((p) => p[1])), type).toBeCloseTo(
        DAM_HEIGHT[type as keyof typeof DAM_HEIGHT],
        6,
      );
    }
  });

  it('blends half-way between two types', () => {
    const a = resample(PROFILES.gravity, 32);
    const b = resample(PROFILES.embankment, 32);
    const m = blend(a, b, 0.5);
    expect(m[0]).toEqual([(a[0]![0] + b[0]![0]) / 2, 0]);
  });

  it('finds the upstream face: vertical for gravity, sloped for the embankment', () => {
    expect(upstreamFaceX(PROFILES.gravity, 50)).toBe(0);
    expect(upstreamFaceX(PROFILES.embankment, 50)).toBeCloseTo(-65, 6);
  });
});
