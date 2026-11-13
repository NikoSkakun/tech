/**
 * A flock of small birds circling the scene: bodies and flapping wings, two instanced draw calls for the whole
 * flock. Units: metres (wingspan ≈ 1.2 m by default so they read from far — scale via `size`).
 */
import { Euler, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { KitModel, MatSet } from '../core/builder';
import * as G from '../core/geo';

export interface BirdsOptions {
  count?: number;
  rng: Rng;
  /** Centre of the circling. */
  centre?: readonly [number, number, number];
  /** Orbit radius range. Default [25, 45]. */
  radius?: readonly [number, number];
  /** Height range above the centre. Default [20, 34]. */
  height?: readonly [number, number];
  size?: number;
  color?: ColorLike;
  /** Flight speed, m/s. Default 6. */
  speed?: number;
}

export function birds(o: BirdsOptions): KitModel {
  const { rng } = o;
  const n = o.count ?? 7;
  const size = o.size ?? 1;
  const centre = o.centre ?? [0, 0, 0];
  const [r0, r1] = o.radius ?? [25, 45];
  const [h0, h1] = o.height ?? [20, 34];
  const mats = new MatSet();
  const mat = mats.get('double');
  const group = new Group();
  group.name = 'birds';
  const bodyGeo = G.capsule(0.11, 0.5, 8);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new InstancedMesh(bodyGeo, mat, n);
  // wing: a tapered flat plate hinged at the body (pivot at x = 0)
  const wingGeo = G.extrude([[0, -0.14], [0.6, -0.05], [0.62, 0.04], [0, 0.16]] as G.Pt[], 0.02);
  wingGeo.rotateX(-Math.PI / 2);
  const wing = new InstancedMesh(wingGeo, mat, n * 2);
  const tint = col(o.color ?? 'white');
  const flock = Array.from({ length: n }, (_, i) => {
    body.setColorAt(i, tint);
    wing.setColorAt(i * 2, tint);
    wing.setColorAt(i * 2 + 1, tint);
    // two or three loose groups, so the flock reads as a flock
    const lead = Math.floor(i / 3);
    return { r: r0 + (r1 - r0) * ((lead * 0.37) % 1) + rng.signed(2.5), h: h0 + (h1 - h0) * ((lead * 0.61) % 1) + rng.signed(1.2), phase: lead * 2.1 + (i % 3) * 0.09 + rng.signed(0.03), flap: rng.range(0, 6.28), dir: lead % 2 ? -1 : 1 };
  });
  for (const im of [body, wing]) {
    im.frustumCulled = false;
    im.castShadow = true;
    group.add(im);
  }
  const m = new Matrix4();
  const root = new Matrix4();
  const local = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const p = new Vector3();
  const s = new Vector3();
  const speed = o.speed ?? 6;
  const model = new KitModel(group, {}, {}, mats, n * 200);
  model.update = (_dt, t) => {
    flock.forEach((b, i) => {
      const a = b.phase + ((t * speed) / b.r) * b.dir;
      p.set(centre[0] + Math.cos(a) * b.r, centre[1] + b.h + Math.sin(t * 0.7 + b.phase) * 0.8, centre[2] + Math.sin(a) * b.r);
      // heading along the orbit tangent, banking into the turn
      root.compose(p, q.setFromEuler(e.set(0, -a + (b.dir > 0 ? Math.PI : 0), b.dir * 0.25, 'YXZ')), s.setScalar(size));
      body.setMatrixAt(i, root);
      const flap = Math.sin(t * 9 + b.flap) * 0.7;
      for (const side of [1, -1]) {
        local.makeRotationFromEuler(e.set(0, 0, side * flap, 'XYZ'));
        if (side < 0) local.scale(s.set(-1, 1, 1));
        wing.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), m.multiplyMatrices(root, local));
      }
    });
    body.instanceMatrix.needsUpdate = true;
    wing.instanceMatrix.needsUpdate = true;
  };
  model.update(0, 0);
  return model;
}
