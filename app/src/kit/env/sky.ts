/**
 * Drifting clouds: flat-bottomed merged puffs in several variants, instanced. Units: metres (scale the parent
 * group like the rest of the diorama).
 */
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '@/engine/api';
import { K, col } from '@/style';
import { Builder, KitModel, MatSet } from '../core/builder';
import * as G from '../core/geo';

/** One puff: a dome with a flat, slightly rounded underside. */
function puff(b: Builder, x: number, z: number, r: number, h: number): void {
  const profile: G.Pt[] = [
    [0, 0],
    [r * 0.8, 0],
    [r * 0.96, r * 0.06],
    [r, r * 0.2],
  ];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    profile.push([Math.cos(a) * r, r * 0.2 + Math.sin(a) * (h - r * 0.2)]);
  }
  profile[profile.length - 1] = [0, h];
  const top = col('white');
  const under = col('white').lerp(col('sky.light'), 0.55);
  b.lathe(profile, {
    seg: 14,
    slot: 'soft',
    at: [x, 0, z],
    crease: 80,
    c: (p, _n, out) => out.copy(under).lerp(top, Math.min(Math.max(p.y / (h * 0.45), 0), 1)),
  });
}

const CLOUD_VARIANTS: readonly (readonly [x: number, z: number, r: number, h: number])[][] = [
  [
    [0, 0, 5, 4.6],
    [-5.5, 0.6, 3.6, 3.0],
    [5.2, -0.5, 3.9, 3.3],
    [9.4, 0.4, 2.5, 1.9],
  ],
  [
    [0, 0, 4.2, 3.8],
    [4.6, 0.8, 4.8, 4.9],
    [-4.4, -0.4, 3.0, 2.4],
    [9.8, 0, 3.2, 2.6],
    [-7.6, 0.5, 2.0, 1.5],
  ],
  [
    [0, 0, 3.8, 3.2],
    [4.0, -0.6, 2.8, 2.2],
    [-3.6, 0.5, 2.6, 2.0],
  ],
];

export interface CloudsOptions {
  count?: number;
  rng: Rng;
  /** Orbit radius range around the origin. Default [70, 110]. */
  radius?: readonly [number, number];
  /** Altitude bands the clouds are drawn from (kept off the sight line to the island top). */
  heights?: readonly (readonly [number, number])[];
  /** Size multiplier range. Default [1, 2.2]. */
  size?: readonly [number, number];
  /** Drift speed multiplier (0 = static). Default 1. */
  speed?: number;
}

/** Clouds drifting around the scene; they cast soft moving shadows. Call `update` every frame. */
export function clouds(o: CloudsOptions): KitModel {
  const { rng } = o;
  const count = o.count ?? 7;
  const radius = o.radius ?? [70, 110];
  const heights = o.heights ?? [
    [-28, -6],
    [48, 66],
  ];
  const size = o.size ?? [1, 2.2];
  const material = K.toon({ color: 'white', vertexColors: true, softness: 0.22, terminator: -0.15, highlight: 0.2, rim: 0.5, fog: false });
  const group = new Group();
  group.name = 'clouds';
  interface Cloud {
    mesh: InstancedMesh;
    index: number;
    r: number;
    y: number;
    phase: number;
    speed: number;
    scale: number;
  }
  const list: Cloud[] = [];
  let triangles = 0;
  CLOUD_VARIANTS.forEach((variant, vi) => {
    const n = Math.floor(count / CLOUD_VARIANTS.length) + (vi < count % CLOUD_VARIANTS.length ? 1 : 0);
    if (n === 0) return;
    const b = new Builder('cloud');
    for (const [x, z, r, h] of variant) puff(b, x, z, r, h);
    const geo = b.geometry('soft');
    const mesh = new InstancedMesh(geo, material, n);
    mesh.name = `clouds:${vi}`;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    triangles += G.triangleCount(geo) * n;
    for (let i = 0; i < n; i++) {
      const band = heights[list.length % heights.length]!;
      list.push({
        mesh,
        index: i,
        r: rng.range(radius[0], radius[1]),
        y: rng.range(band[0], band[1]),
        phase: ((list.length + rng.range(-0.3, 0.3)) / count) * Math.PI * 2,
        speed: rng.range(0.012, 0.03) * (rng.next() < 0.5 ? 1 : -1),
        scale: rng.range(size[0], size[1]),
      });
    }
    group.add(mesh);
  });
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const up = new Vector3(0, 1, 0);
  const speed = o.speed ?? 1;
  const model = new KitModel(group, {}, {}, new MatSet(), triangles);
  model.update = (_dt, t) => {
    for (const c of list) {
      const a = c.phase + t * c.speed * speed;
      q.setFromAxisAngle(up, -a + Math.PI / 2);
      p.set(Math.cos(a) * c.r, c.y + Math.sin(t * 0.2 + c.phase) * 0.6, Math.sin(a) * c.r);
      c.mesh.setMatrixAt(c.index, m.compose(p, q, s.setScalar(c.scale)));
      c.mesh.instanceMatrix.needsUpdate = true;
    }
  };
  model.update(0, 0);
  return model;
}
