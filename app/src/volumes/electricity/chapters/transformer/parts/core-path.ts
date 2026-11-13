/**
 * The closed magnetic path of the teaching transformer (steps 1–2): Faraday's ring (a circle) that «straightens»
 * into the rectangular core of a teaching transformer. Both outlines are sampled from the same start point (the
 * middle of the right limb) at equal arc-length steps, so lerping the samples morphs one into the other without
 * twisting. `sweepCore` builds the core as a stack of thin sheets along that path — with `gap` = 0 it reads as one
 * solid iron ring, with a gap the sheets of a laminated core show their edges as stripes.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { col } from '@/style';

/** Radius of the ring; half-width / half-height and corner radius of the rectangular core (world units). */
export const RING_R = 1.15;
export const RECT_HX = 1.15;
export const RECT_HY = 1.35;
const RECT_CR = 0.3;
/** Cross-section of the core: radial width and depth. */
export const CORE_W = 0.36;
export const CORE_D = 0.42;
export const SAMPLES = 160;

function circlePoint(s: number, out: Vector3): Vector3 {
  const a = s * Math.PI * 2;
  return out.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0);
}

/** Rounded rectangle walked counter-clockwise from (hx, 0), by arc length s ∈ [0, 1). */
function rectPoint(s: number, out: Vector3): Vector3 {
  const sx = RECT_HX - RECT_CR;
  const sy = RECT_HY - RECT_CR;
  const arc = (Math.PI / 2) * RECT_CR;
  // segments: right half-limb up, corner, top, corner, left, corner, bottom, corner, right half-limb up
  const segs: [number, (u: number) => void][] = [
    [sy, (u) => out.set(RECT_HX, u * sy, 0)],
    [arc, (u) => corner(sx, sy, 0, u)],
    [2 * sx, (u) => out.set(sx - u * 2 * sx, RECT_HY, 0)],
    [arc, (u) => corner(-sx, sy, 1, u)],
    [2 * sy, (u) => out.set(-RECT_HX, sy - u * 2 * sy, 0)],
    [arc, (u) => corner(-sx, -sy, 2, u)],
    [2 * sx, (u) => out.set(-sx + u * 2 * sx, -RECT_HY, 0)],
    [arc, (u) => corner(sx, -sy, 3, u)],
    [sy, (u) => out.set(RECT_HX, -sy + u * sy, 0)],
  ];
  function corner(cx: number, cy: number, q: number, u: number): void {
    const a = (q + u) * (Math.PI / 2);
    out.set(cx + Math.cos(a) * RECT_CR, cy + Math.sin(a) * RECT_CR, 0);
  }
  const total = segs.reduce((n, [l]) => n + l, 0);
  let d = (((s % 1) + 1) % 1) * total;
  for (const [l, f] of segs) {
    if (d <= l) {
      f(d / l);
      return out;
    }
    d -= l;
  }
  return out.set(RECT_HX, 0, 0);
}

/** Point of the morphing centre line: m = 0 ring, 1 rectangle. */
export function corePoint(s: number, m: number, out = new Vector3()): Vector3 {
  const a = circlePoint(s, new Vector3());
  rectPoint(s, out);
  return out.lerp(a, 1 - m);
}

/** The closed centre line as points (for flows of the flux). `inset` shifts it toward the inside of the loop. */
export function corePath(m: number, n = 96, inset = 0): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const p = corePoint(i / n, m);
    if (inset) {
      // outward normal of a counter-clockwise loop is (t.y, −t.x): step against it
      const t = corePoint((i + 0.5) / n, m).sub(corePoint((i - 0.5) / n, m)).normalize();
      p.x -= t.y * inset;
      p.y += t.x * inset;
    }
    pts.push(p);
  }
  return pts;
}

const STEEL = col('steel');
const STEEL_EDGE = col('slate').lerp(col('steel'), 0.35);
const IRON = col('slate').lerp(col('steel'), 0.6);

/**
 * Swept core: `sheets` thin plates stacked along Z, each a rounded-rectangle tube section swept along the path.
 * Vertex colours alternate between the sheets (the stripes of a laminated core) and fade to plain iron for m → 0.
 */
export function sweepCore(m: number, sheets = 7, gap = 0.014 * m): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const colr: number[] = [];
  const idx: number[] = [];
  const t = new Vector3();
  const n = new Vector3();
  const p = new Vector3();
  const c = new Color();
  const plate = (CORE_D - gap * (sheets - 1)) / sheets;
  // cross-section of one sheet in (radial, depth) coordinates: a flat rectangle, 8 corners with split normals
  for (let k = 0; k < sheets; k++) {
    const z0 = -CORE_D / 2 + k * (plate + gap);
    const z1 = z0 + plate;
    const shade = k % 2 === 0 ? STEEL : STEEL_EDGE;
    c.copy(IRON).lerp(shade, m);
    const ring: [number, number, number, number][] = [
      // [radial, depth, normal radial, normal depth]
      [-CORE_W / 2, z0, 0, -1], [CORE_W / 2, z0, 0, -1],
      [CORE_W / 2, z0, 1, 0], [CORE_W / 2, z1, 1, 0],
      [CORE_W / 2, z1, 0, 1], [-CORE_W / 2, z1, 0, 1],
      [-CORE_W / 2, z1, -1, 0], [-CORE_W / 2, z0, -1, 0],
    ];
    const base = pos.length / 3;
    for (let i = 0; i <= SAMPLES; i++) {
      const s = i / SAMPLES;
      corePoint(s, m, p);
      t.copy(corePoint(s + 1e-3, m)).sub(corePoint(s - 1e-3, m)).normalize();
      n.set(t.y, -t.x, 0); // outward normal of a counter-clockwise loop
      for (const [r, d, nr, nd] of ring) {
        pos.push(p.x + n.x * r, p.y + n.y * r, d);
        nor.push(n.x * nr, n.y * nr, nd);
        colr.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < SAMPLES; i++) {
      for (let f = 0; f < 4; f++) {
        const a = base + i * 8 + f * 2;
        const b = a + 1;
        const a2 = a + 8;
        const b2 = b + 8;
        idx.push(a, a2, b, b, a2, b2);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  return g;
}
