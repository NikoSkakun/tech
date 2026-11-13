import { describe, expect, it } from 'vitest';
import { ORBITAL_IDS, orbitalPsi } from '@electricity/sim/atom';
import { nodalPoint } from '../sim-bindings/nodal';

describe('nodalPoint (hotspot «вузлова поверхня»)', () => {
  it('has no node for 1s', () => {
    expect(nodalPoint('1s')).toBeNull();
  });

  it('lies on a zero of the wave function for every other orbital', () => {
    for (const id of ORBITAL_IDS.filter((o) => o !== '1s')) {
      const p = nodalPoint(id);
      expect(p, id).not.toBeNull();
      // ψ at the point is negligible next to ψ a quarter of a Bohr radius away from the surface
      const here = Math.abs(orbitalPsi(id, p!.x, 0, p!.up));
      const scale = Math.max(
        Math.abs(orbitalPsi(id, p!.x + 0.25, 0.25, p!.up + 0.25)),
        Math.abs(orbitalPsi(id, p!.x - 0.25, 0.25, p!.up - 0.25)),
      );
      expect(here, id).toBeLessThan(scale * 1e-3);
    }
  });

  it('finds the known nodes: 2s sphere at 2 a₀, 3s outer sphere, 2p_z plane, d_z² cone', () => {
    expect(nodalPoint('2s')).toMatchObject({ kind: 'sphere' });
    expect(nodalPoint('2s')!.radius).toBeCloseTo(2, 4);
    expect(nodalPoint('3s')!.radius).toBeCloseTo((9 + 3 * Math.sqrt(3)) / 2, 3);
    expect(nodalPoint('2p_z')!.up).toBeCloseTo(0, 5);
    expect(nodalPoint('2p_x')!.x).toBeCloseTo(0, 5);
    const cone = nodalPoint('3d_z2')!;
    expect(Math.atan2(cone.x, cone.up)).toBeCloseTo(Math.acos(1 / Math.sqrt(3)), 4); // 54,74° from the axis
    expect(nodalPoint('2p_y')!.kind).toBe('picture-plane');
  });
});
