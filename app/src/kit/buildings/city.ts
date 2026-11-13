/**
 * City-block scatter: many simple towers and slabs with window grids, merged into two meshes (walls + lit
 * windows) — the "city that consumes the power" of grid and distribution dioramas, glowing at night.
 * Units: metres. The block is centred on the origin.
 */
import { Rng } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';

const glass = () => col('blue.dark').lerp(col('sky'), 0.3);

const TONES = ['mist', 'white', 'sky.light', 'pink.light', 'yellow.light', 'violet.light', 'steel.light'] as const;

/** One simple building: box, window grid on all sides (a share lit), roof kerb and a random roof box. */
export function addSimpleTower(b: Builder, w: number, d: number, floors: number, rng: Rng, o: { color?: ColorLike; lit?: number } = {}): void {
  const fh = 3;
  const H = floors * fh + 0.6;
  const wall = col(o.color ?? rng.pick(TONES));
  const lit = o.lit ?? 0.55;
  b.box(w, H, d, { r: 0.15, c: [wall.clone().multiplyScalar(0.8), wall] });
  b.box(w + 0.2, 0.4, d + 0.2, { r: 0.06, c: wall.clone().multiplyScalar(0.78), at: [0, H - 0.1, 0] });
  if (rng.next() < 0.7) b.box(w * 0.35, 1.6, d * 0.35, { r: 0.08, c: wall.clone().multiplyScalar(0.88), at: [rng.signed(w * 0.2), H + 0.2, rng.signed(d * 0.2)] });
  if (floors > 9 && rng.next() < 0.6) {
    b.cyl(0.06, 4, { seg: 5, slot: 'metal', c: 'slate', at: [0, H + 0.3, 0], bevel: 0 });
    b.sphere(0.2, { seg: 6, slot: 'glow', c: 'red', at: [0, H + 4.4, 0] });
  }
  const nx = Math.max(2, Math.round(w / 3));
  const nz = Math.max(2, Math.round(d / 3));
  // whole window rows merged into strips where the building is "office-like" would look repetitive:
  // individual panes with a seeded lit pattern read as a living city at night
  for (let f = 0; f < floors; f++) {
    const y = 0.9 + f * fh;
    for (let i = 0; i < nx; i++) {
      const x = ((i + 0.5) / nx - 0.5) * (w - 0.8);
      for (const s of [-1, 1]) b.box(w / nx - 1.1, 1.5, 0.08, { r: 0, slot: rng.next() < lit ? 'window' : 'gloss', c: glass(), at: [x, y, s * (d / 2 + 0.01)] });
    }
    for (let i = 0; i < nz; i++) {
      const z = ((i + 0.5) / nz - 0.5) * (d - 0.8);
      for (const s of [-1, 1]) b.box(0.08, 1.5, d / nz - 1.1, { r: 0, slot: rng.next() < lit ? 'window' : 'gloss', c: glass(), at: [s * (w / 2 + 0.01), y, z] });
    }
  }
}

export interface CityBlockOptions {
  /** Block size [x, z] in metres. Default [120, 90]. */
  size?: readonly [number, number];
  /** Lot pitch (building + street). Default 26. */
  lot?: number;
  /** Storey range. Default [3, 14]. */
  floors?: readonly [number, number];
  /** Taller buildings toward the centre (downtown profile). Default true. */
  downtown?: boolean;
  /** Share of lots left empty (squares, parks). Default 0.12. */
  gaps?: number;
  lit?: number;
  seed?: number;
  /** Asphalt ground slab with pavements under the block. Default true. */
  ground?: boolean;
}

/** Anchors: `centre`, `feederN` (N = 1…4, street corners where distribution feeders can arrive). */
export function addCityBlock(b: Builder, o: CityBlockOptions = {}): void {
  const rng = new Rng((o.seed ?? 1) * 2749 + 11);
  const [sx, sz] = o.size ?? [120, 90];
  const lot = o.lot ?? 26;
  const [f0, f1] = o.floors ?? [3, 14];
  const nx = Math.max(1, Math.floor(sx / lot));
  const nz = Math.max(1, Math.floor(sz / lot));
  if (o.ground ?? true) {
    b.box(sx, 0.3, sz, { r: 0.1, slot: 'matte', c: col('slate').lerp(col('steel'), 0.35), at: [0, -0.3, 0] });
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = ((i + 0.5) / nx - 0.5) * sx;
      const z = ((j + 0.5) / nz - 0.5) * sz;
      const pw = sx / nx - 7;
      const pd = sz / nz - 7;
      if (o.ground ?? true) b.box(pw + 3, 0.16, pd + 3, { r: 0.08, slot: 'matte', c: col('mist').lerp(col('steel.light'), 0.3), at: [x, -0.02, z] });
      if (rng.next() < (o.gaps ?? 0.12)) continue;
      const central = 1 - Math.min(1, Math.hypot(x / (sx / 2), z / (sz / 2)));
      const t = (o.downtown ?? true) ? central * 0.75 + rng.next() * 0.25 : rng.next();
      const floors = Math.round(f0 + (f1 - f0) * t);
      const w = pw * rng.range(0.6, 1);
      const d = pd * rng.range(0.6, 1);
      b.frame({ at: [x + rng.signed((pw - w) / 2), 0.1, z + rng.signed((pd - d) / 2)] }, () => addSimpleTower(b, w, d, floors, rng, { lit: o.lit }));
    }
  }
  b.anchor('centre', 0, 0, 0);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([ax, az], k) => b.anchor(`feeder${k + 1}`, (ax! * sx) / 2, 0, (az! * sz) / 2));
}

export function cityBlock(o: CityBlockOptions = {}): KitModel {
  const b = new Builder('city-block');
  addCityBlock(b, o);
  return b.build();
}
