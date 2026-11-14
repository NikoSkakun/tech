/**
 * A Sankey band: a flat ribbon of rectangular cross-section whose centre follows a smooth S-curve from `a` to
 * `b` (both in the XY plane, z = 0) and whose height eases from `ha` to `hb`. `uv.x` = distance along the band in
 * metres (so `K.energy` pulses keep their spacing), `uv.y` = 0 bottom … 1 top. Vertex colours run from `ca` to
 * `cb` along the band. Pure geometry, no materials.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';

const smooth = (t: number): number => t * t * (3 - 2 * t);

export interface BandSpec {
  a: Vector3;
  b: Vector3;
  ha: number;
  hb: number;
  depth: number;
  ca: Color;
  cb: Color;
  /** Bend: `s` = horizontal S-curve (Sankey link), `drop` = leaves horizontally, ends falling down (loss branch). */
  shape?: 's' | 'drop';
  segments?: number;
}

export function bandGeometry(o: BandSpec): BufferGeometry {
  const n = o.segments ?? 32;
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new Color();
  const centre = (t: number, out: Vector3): Vector3 => {
    if (o.shape === 'drop') {
      // quarter turn: x eases out, y falls with t²
      return out.set(o.a.x + (o.b.x - o.a.x) * Math.sin((t * Math.PI) / 2), o.a.y + (o.b.y - o.a.y) * t * t, 0);
    }
    return out.set(o.a.x + (o.b.x - o.a.x) * t, o.a.y + (o.b.y - o.a.y) * smooth(t), 0);
  };
  const p = new Vector3();
  const prev = new Vector3();
  const nrm = new Vector3();
  const tmp = new Vector3();
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    centre(t, p);
    if (i > 0) s += p.distanceTo(prev);
    prev.copy(p);
    const h = (o.ha + (o.hb - o.ha) * smooth(t)) / 2;
    c.copy(o.ca).lerp(o.cb, smooth(t));
    // the band's height is measured vertically on an S-link (Sankey convention) and across the curve on a drop
    if (o.shape === 'drop') {
      centre(Math.min(1, t + 0.01), nrm).sub(centre(Math.max(0, t - 0.01), tmp)).normalize();
      nrm.set(-nrm.y, nrm.x, 0);
    } else nrm.set(0, 1, 0);
    // four corners of the cross-section: bottom-back, top-back, top-front, bottom-front
    const corners: [number, number, number][] = [
      [-h, -o.depth / 2, 0],
      [h, -o.depth / 2, 1],
      [h, o.depth / 2, 1],
      [-h, o.depth / 2, 0],
    ];
    for (const [dh, dz, v] of corners) {
      pos.push(p.x + nrm.x * dh, p.y + nrm.y * dh, dz);
      uv.push(s, v);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n; i++) {
    const r0 = i * 4;
    const r1 = r0 + 4;
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      idx.push(r0 + k, r1 + k, r1 + k1, r0 + k, r1 + k1, r0 + k1);
    }
  }
  // end caps
  const cap = (r: number, flip: boolean): void => {
    if (flip) idx.push(r, r + 2, r + 1, r, r + 3, r + 2);
    else idx.push(r, r + 1, r + 2, r, r + 2, r + 3);
  };
  cap(0, false);
  cap(n * 4, true);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
