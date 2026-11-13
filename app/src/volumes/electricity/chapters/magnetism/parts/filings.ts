/**
 * Iron filings («ошурки», step `magnet-field`): small `steel` slivers sprinkled over the table that fall,
 * then line up along the field. Only filings where the magnets' field is strong enough stay visible, so their
 * density draws the familiar pattern. One instanced mesh; positions are seeded (deterministic).
 */
import { InstancedMesh, Matrix4, Quaternion, Vector3, type Group } from 'three';
import { Builder } from '@/kit';
import type { Rng } from '@/engine/api';
import { group } from '../world';

export interface Filings {
  group: Group;
  /** Field (sim components east, north, T) of the magnets only at a world point. */
  field: (x: number, z: number, out: { x: number; y: number }) => void;
  /** Hidden where true (inside magnets). */
  mask: (x: number, z: number) => boolean;
  /** Start the sprinkle at engine time `t` (or settle at once). */
  drop(t: number, instant: boolean): void;
  update(dt: number, t: number): void;
}

export function createFilings(rng: Rng, count: number, radius: number): Filings {
  const g = group('filings');
  const b = new Builder('filing');
  b.box(0.11, 0.016, 0.02, { r: 0, slot: 'metal', c: 'mist', mid: true });
  const mesh = new InstancedMesh(b.geometry('metal'), b.mats.get('metal'), count);
  mesh.frustumCulled = false;
  g.add(mesh);
  const xs = new Float32Array(count);
  const zs = new Float32Array(count);
  const ang = new Float32Array(count);
  const delay = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const r = radius * Math.sqrt(rng.next());
    const a = rng.next() * Math.PI * 2;
    xs[k] = Math.cos(a) * r;
    zs[k] = Math.sin(a) * r;
    ang[k] = rng.next() * Math.PI;
    delay[k] = rng.next() * 0.9;
  }
  let t0 = -100;
  const v = { x: 0, y: 0 };
  const m4 = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const p = new Vector3();
  const s = new Vector3();
  const self: Filings = {
    group: g,
    field: (_x, _z, out) => ((out.x = 0), (out.y = 0)),
    mask: () => false,
    drop(t, instant) {
      t0 = instant ? -100 : t;
    },
    update(dt, t) {
      const ease = Math.min(dt * 8, 1);
      for (let k = 0; k < count; k++) {
        const x = xs[k]!;
        const z = zs[k]!;
        self.field(x, z, v);
        const mag = Math.hypot(v.x, v.y);
        // visible where |B| > ~0,25 mT, fully at ~1 mT (log-ish): the pattern thins out with distance
        const seen = self.mask(x, z) ? 0 : Math.min(Math.max((Math.log10(mag + 1e-9) + 3.6) / 0.6, 0), 1);
        const fall = Math.min(Math.max((t - t0 - delay[k]!) / 0.5, 0), 1);
        const y = 0.012 + (1 - fall * fall) * 1.6;
        // once landed, each sliver turns along B (a filing has no N or S: the line matters, not the sense)
        if (fall >= 1 && mag > 0) {
          let target = Math.atan2(v.y, v.x);
          let d = target - ang[k]!;
          d = Math.atan2(Math.sin(2 * d), Math.cos(2 * d)) / 2;
          target = ang[k]! + d;
          ang[k] = ang[k]! + (target - ang[k]!) * ease;
        }
        q.setFromAxisAngle(up, ang[k]! + (1 - fall) * 3 * t);
        const sc = seen * (fall > 0 ? 1 : 0);
        mesh.setMatrixAt(k, m4.compose(p.set(x, y, z), q, s.set(sc, sc, sc)));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
  return self;
}
