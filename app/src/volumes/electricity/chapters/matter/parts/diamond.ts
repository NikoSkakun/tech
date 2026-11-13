/**
 * The real 3D lattice of silicon (diamond type: every atom bonded to 4 neighbours in a tetrahedron), shown at the
 * start of step 6 before it "flattens" into the planar scheme: `flat` 0 → 1 squeezes the block along z.
 */
import { CylinderGeometry, Euler, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { createOrbs } from '@/fx';
import { K } from '@/style';

export interface Diamond {
  group: Group;
  /** 0 = 3D block, 1 = squeezed flat. */
  flat: number;
  update(t: number): void;
}

export function createDiamond(cells = 2, a = 1.25): Diamond {
  const group = new Group();
  const inner = new Group();
  group.add(inner);
  const h = (cells * a) / 2;
  const sites: Vector3[] = [];
  const basis = [
    [0, 0, 0],
    [0.5, 0.5, 0],
    [0.5, 0, 0.5],
    [0, 0.5, 0.5],
  ];
  const eps = 1e-6;
  for (let i = -1; i <= cells; i++)
    for (let j = -1; j <= cells; j++)
      for (let k = -1; k <= cells; k++)
        for (const [bx, by, bz] of basis)
          for (const s of [0, 0.25]) {
            const p = new Vector3((i + bx! + s) * a - h, (j + by! + s) * a - h, (k + bz! + s) * a - h);
            if (Math.abs(p.x) <= h + eps && Math.abs(p.y) <= h + eps && Math.abs(p.z) <= h + eps)
              sites.push(p);
          }
  const bonds: [Vector3, Vector3][] = [];
  const nn = (a * Math.sqrt(3)) / 4;
  for (let i = 0; i < sites.length; i++)
    for (let j = i + 1; j < sites.length; j++)
      if (Math.abs(sites[i]!.distanceTo(sites[j]!) - nn) < 0.01) bonds.push([sites[i]!, sites[j]!]);
  const atoms = createOrbs({ kind: 'ion', color: 'slate', glyph: 'none', count: sites.length, radius: 0.16 });
  const sticks = new InstancedMesh(
    new CylinderGeometry(0.035, 0.035, 1, 8),
    K.toon({ color: 'mist', rim: 0.6 }),
    bonds.length,
  );
  inner.add(atoms, sticks);
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const up = new Vector3(0, 1, 0);
  const pa = new Vector3();
  const pb = new Vector3();
  const sc = new Vector3();
  // turned and squeezed on the CPU: impostor orbs need a uniformly scaled parent
  const place = (p: Vector3, out: Vector3, f: number): Vector3 => {
    out.copy(p).applyEuler(e);
    out.z *= 1 - 0.95 * f;
    return out;
  };
  const d: Diamond = {
    group,
    flat: 0,
    update(t) {
      const f = d.flat;
      e.set(0.5 * (1 - f), (0.7 + 0.1 * Math.sin(t * 0.3)) * (1 - f), 0);
      sites.forEach((p, i) => {
        place(p, pa, f);
        atoms.setPosition(i, pa.x, pa.y, pa.z);
      });
      atoms.commit();
      bonds.forEach(([p, r], i) => {
        place(p, pa, f);
        place(r, pb, f);
        const len = pa.distanceTo(pb);
        q.setFromUnitVectors(up, pb.sub(pa).normalize());
        m.compose(pa.addScaledVector(pb, len / 2), q, sc.set(1, len, 1));
        sticks.setMatrixAt(i, m);
      });
      sticks.instanceMatrix.needsUpdate = true;
    },
  };
  return d;
}
