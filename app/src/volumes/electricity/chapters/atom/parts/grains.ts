/**
 * Grain mosaic — the polycrystalline cross-section of the copper core: a unit disc (radius 1, facing +Z) of
 * Voronoi-like tiles, each crystallite in a slightly different copper shade with a chamfered rim, merged into
 * one vertex-coloured geometry (one draw call). The same mesh is the wire's cut face at 10⁻³ m and, hundreds
 * of times larger, the grain field at 10⁻⁵ m — so the dive between the two is truly continuous.
 */
import { BufferAttribute, BufferGeometry, Color, Vector2 } from 'three';
import type { Rng } from '@/engine/api';
import { col } from '@/style';

export interface GrainField {
  geometry: BufferGeometry;
  /** Centres of the crystallites (unit-disc coordinates), nearest to the middle first. */
  centres: Vector2[];
}

/** Clip a convex polygon with the half-plane of points closer to `a` than to `b`. */
function clipCloser(poly: Vector2[], a: Vector2, b: Vector2): Vector2[] {
  const nx = b.x - a.x;
  const ny = b.y - a.y;
  const limit = (nx * (a.x + b.x) + ny * (a.y + b.y)) / 2;
  const out: Vector2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const dp = nx * p.x + ny * p.y - limit;
    const dq = nx * q.x + ny * q.y - limit;
    if (dp <= 0) out.push(p);
    if (dp < 0 !== dq < 0 && dp !== dq) out.push(p.clone().lerp(q, dp / (dp - dq)));
  }
  return out;
}

export function createGrainField(rng: Rng, cells = 520): GrainField {
  // jittered hexagonal grid → near-uniform crystallites with irregular borders
  const spacing = Math.sqrt((Math.PI * 1.15) / cells);
  const seeds: Vector2[] = [];
  const rows = Math.ceil(1.1 / (spacing * 0.866));
  for (let j = -rows; j <= rows; j++) {
    for (let i = -rows - 2; i <= rows + 2; i++) {
      const x = (i + (j & 1) * 0.5) * spacing + rng.range(-0.3, 0.3) * spacing;
      const y = j * spacing * 0.866 + rng.range(-0.3, 0.3) * spacing;
      if (x * x + y * y < 1.1 * 1.1) seeds.push(new Vector2(x, y));
    }
  }
  const position: number[] = [];
  const normal: number[] = [];
  const color: number[] = [];
  const base = [col('orange'), col('amber'), col('orange')];
  const tint = new Color();
  const height = spacing * 0.1;
  const gap = spacing * 0.035;
  const chamfer = spacing * 0.09;
  const push = (p: Vector2, z: number, n: readonly [number, number, number], shade: number): void => {
    position.push(p.x, p.y, z);
    normal.push(n[0], n[1], n[2]);
    color.push(tint.r * shade, tint.g * shade, tint.b * shade);
  };
  const centres: Vector2[] = [];
  for (const seed of seeds) {
    const h = spacing * 1.5;
    let poly = [
      new Vector2(seed.x - h, seed.y - h),
      new Vector2(seed.x + h, seed.y - h),
      new Vector2(seed.x + h, seed.y + h),
      new Vector2(seed.x - h, seed.y + h),
    ];
    for (const other of seeds) {
      if (other === seed || other.distanceToSquared(seed) > 6.3 * spacing * spacing) continue;
      poly = clipCloser(poly, seed, other);
      if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;
    // keep the mosaic inside the unit disc: pull outside corners onto the rim
    for (const p of poly) if (p.lengthSq() > 1) p.normalize();
    if (seed.lengthSq() < 0.92) centres.push(seed.clone());
    const centre = poly.reduce((s, p) => s.add(p), new Vector2()).multiplyScalar(1 / poly.length);
    const inset = (p: Vector2, d: number): Vector2 => {
      const dir = p.clone().sub(centre);
      const len = dir.length() || 1;
      return p.clone().addScaledVector(dir, -Math.min(d / len, 0.8));
    };
    tint.copy(base[rng.int(0, base.length - 1)]!).lerp(base[rng.int(0, base.length - 1)]!, rng.next());
    const lightness = rng.range(0.8, 1.04);
    const top = poly.map((p) => inset(p, gap + chamfer));
    const rim = poly.map((p) => inset(p, gap));
    for (let i = 0; i < poly.length; i++) {
      const k = (i + 1) % poly.length;
      // top face (fan)
      push(centre, height, [0, 0, 1], lightness);
      push(top[i]!, height, [0, 0, 1], lightness);
      push(top[k]!, height, [0, 0, 1], lightness);
      // chamfer: slightly darker, normal tilted outward
      const out = rim[i]!.clone().add(rim[k]!).multiplyScalar(0.5).sub(centre).normalize();
      const n: [number, number, number] = [out.x * 0.7, out.y * 0.7, 0.71];
      const dark = lightness * 0.72;
      push(top[i]!, height, n, dark);
      push(rim[i]!, 0, n, dark);
      push(rim[k]!, 0, n, dark);
      push(top[i]!, height, n, dark);
      push(rim[k]!, 0, n, dark);
      push(top[k]!, height, n, dark);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normal), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(color), 3));
  centres.sort((a, b) => a.lengthSq() - b.lengthSq());
  return { geometry, centres };
}
