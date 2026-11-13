// M3 fx additions: probability cloud, replaceable flow paths, per-instance orb colours, normal-blend ribbons.
import { NormalBlending, Vector3, type InstancedBufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { RibbonLines } from '../core/ribbon';
import { PathSet } from '../flow/pathset';
import { createOrbs, createProbabilityCloud } from '..';

describe('fx M3', () => {
  it('probability cloud: fill() samples a static distribution', () => {
    const cloud = createProbabilityCloud({ capacity: 100, color: 'cyan' });
    cloud.fill(40, (i, out) => {
      out[0] = i;
      out[1] = 0;
      out[2] = 0;
    });
    expect(cloud.geometry.drawRange.count).toBe(40);
    expect(cloud.geometry.getAttribute('position').getX(39)).toBe(39);
    cloud.dispose();
  });

  it('PathSet.setPath re-bakes one row in place', () => {
    const set = new PathSet([{ path: [new Vector3(0, 0, 0), new Vector3(1, 0, 0)] }, { path: [new Vector3(0, 0, 0), new Vector3(0, 1, 0)] }], 16);
    set.setPath(0, [new Vector3(0, 0, 0), new Vector3(0, 0, 4)]);
    const data = set.texture.image.data as Float32Array;
    expect(data[(0 * 16 + 15) * 4 + 2]).toBeCloseTo(4, 5); // row 0, last sample, z
    expect(data[(1 * 16 + 15) * 4 + 1]).toBeCloseTo(1, 5); // row 1 untouched
    expect(set.paths[0]!.length).toBeCloseTo(4, 5);
    expect(() => set.setPath(2, [new Vector3(), new Vector3(1, 0, 0)])).toThrow();
  });

  it('orbs: per-instance colour and brightness', () => {
    const orbs = createOrbs({ kind: 'proton', count: 3, instanceColors: true });
    orbs.setInstanceColor(1, 'blue', 2);
    orbs.commit();
    const tint = orbs.geometry.getAttribute('aTint') as InstancedBufferAttribute;
    expect(tint.getW(1)).toBe(2);
    expect(tint.getZ(1)).toBeGreaterThan(tint.getX(1)); // blue
    expect(orbs.material.defines.FX_ORB_TINT).toBe('');
    expect(() => createOrbs({ kind: 'proton', count: 2 }).setInstanceColor(0, 'red')).toThrow();
  });

  it('ribbons: blend normal is alpha-blended', () => {
    const r = new RibbonLines({ capacity: 8, blend: 'normal' });
    expect(r.material.blending).toBe(NormalBlending);
    expect(r.material.defines.FX_RIBBON_NORMAL).toBe('');
  });
});
