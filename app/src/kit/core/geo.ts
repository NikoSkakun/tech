/**
 * Geometry toolbox of the kit (STYLE_GUIDE §3: rounded, chunky, bevelled).
 *
 * Conventions shared by every helper:
 *  - geometries are *merge sources* for `Builder` (indexed, with `position`, `normal`, `uv`); they are never
 *    uploaded on their own, so they need no disposal;
 *  - "standing" shapes (`cyl`, `cone`, `dome`, `lathe`) have their base at y = 0 and grow along +Y; `rbox`,
 *    `sphere`, `capsule`, `ring` are centred;
 *  - `uv.x` of swept shapes (`tube`) runs along the path in world units, so `K.energy({ repeat })` means
 *    "pulses per metre" whatever the length is; `uv.y` runs around the section;
 *  - lathe profiles run bottom → top on the outside (counter-clockwise in the (r, y) half-plane), which makes
 *    the normals point outward.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Quaternion,
  Shape,
  ShapeUtils,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';

/** A point of a lathe profile or 2D outline: [r, y] or [x, y]. */
export type Pt = readonly [number, number];

function geometry(
  position: number[],
  normal: number[],
  uv: number[],
  index: number[],
): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/* ------------------------------------------------------------------------------------------ boxes */

/** Plain hard-edged box, centred. For tiny tertiary details where a bevel would not be visible (12 triangles). */
export function box(w: number, h: number, d: number): BufferGeometry {
  return new BoxGeometry(w, h, d);
}

/**
 * Rounded box, centred. `r` = edge radius, `seg` = bevel segments per quarter turn
 * (1 = chamfer with smooth normals, 108 triangles; 2 = 300; 3 = 588).
 */
export function rbox(w: number, h: number, d: number, r?: number, seg = 2): BufferGeometry {
  const half = [w / 2, h / 2, d / 2] as const;
  const radius = Math.min(r ?? Math.min(w, h, d) * 0.15, half[0], half[1], half[2]);
  if (radius <= 1e-6) return box(w, h, d);
  const inner = [half[0] - radius, half[1] - radius, half[2] - radius] as const;
  // Samples along one axis of a cube face: the flat part, then bevel samples placed at inner + r·tan(a) so
  // that after projection onto the rounded surface the bevel is divided into equal angles.
  const samples = (axis: number): number[] => {
    const c: number[] = [];
    const flat = inner[axis]!;
    for (let k = seg; k >= 1; k--) c.push(-(flat + radius * Math.tan(((k / seg) * Math.PI) / 4)));
    if (flat > 1e-6) c.push(-flat, flat);
    else c.push(0);
    for (let k = 1; k <= seg; k++) c.push(flat + radius * Math.tan(((k / seg) * Math.PI) / 4));
    return c;
  };
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = [0, 0, 0];
  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3;
    const v = (a + 2) % 3;
    const cu = samples(u);
    const cv = samples(v);
    for (const s of [1, -1]) {
      const base = pos.length / 3;
      for (let j = 0; j < cv.length; j++) {
        for (let i = 0; i < cu.length; i++) {
          p[a] = s * half[a]!;
          p[u] = cu[i]!;
          p[v] = cv[j]!;
          const q = [0, 1, 2].map((k) => Math.min(Math.max(p[k]!, -inner[k]!), inner[k]!));
          const dx = p[0]! - q[0]!;
          const dy = p[1]! - q[1]!;
          const dz = p[2]! - q[2]!;
          const len = Math.hypot(dx, dy, dz) || 1;
          nor.push(dx / len, dy / len, dz / len);
          pos.push(
            q[0]! + (dx / len) * radius,
            q[1]! + (dy / len) * radius,
            q[2]! + (dz / len) * radius,
          );
          uv.push(i / (cu.length - 1), j / (cv.length - 1));
        }
      }
      for (let j = 0; j < cv.length - 1; j++) {
        for (let i = 0; i < cu.length - 1; i++) {
          const k0 = base + j * cu.length + i;
          const k1 = k0 + 1;
          const k2 = k0 + cu.length;
          const k3 = k2 + 1;
          if (s > 0) idx.push(k0, k1, k2, k1, k3, k2);
          else idx.push(k0, k2, k1, k1, k2, k3);
        }
      }
    }
  }
  return geometry(pos, nor, uv, idx);
}

/* ----------------------------------------------------------------------------------------- lathes */

/** Round the corners of an open polyline (lathe profile / outline). `radius` may be per-vertex (0 = keep sharp). */
export function fillet(points: readonly Pt[], radius: number | readonly number[], steps = 4): Pt[] {
  const out: Pt[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const r = typeof radius === 'number' ? radius : (radius[i] ?? 0);
    const p = points[i]!;
    const a = points[i - 1]!;
    const b = points[i + 1]!;
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const d = Math.min(r, la * 0.45, lb * 0.45);
    if (d <= 1e-6) {
      out.push(p);
      continue;
    }
    const s: Pt = [p[0] + ((a[0] - p[0]) / la) * d, p[1] + ((a[1] - p[1]) / la) * d];
    const e: Pt = [p[0] + ((b[0] - p[0]) / lb) * d, p[1] + ((b[1] - p[1]) / lb) * d];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const w0 = (1 - t) * (1 - t);
      const w1 = 2 * t * (1 - t);
      const w2 = t * t;
      out.push([w0 * s[0] + w1 * p[0] + w2 * e[0], w0 * s[1] + w1 * p[1] + w2 * e[1]]);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

export interface LatheOptions {
  /** Segments around the axis. Default 24. */
  seg?: number;
  phiStart?: number;
  phiLength?: number;
  /** Corners sharper than this angle (degrees) get split normals (crisp edge); gentler ones are smoothed. Default 32. */
  crease?: number;
}

/**
 * Surface of revolution around +Y. Unlike `THREE.LatheGeometry` it keeps deliberate creases crisp (flat caps
 * stay flat instead of looking pillowy) while fillets stay smooth.
 */
export function lathe(profile: readonly Pt[], opts: LatheOptions | number = {}): BufferGeometry {
  const o = typeof opts === 'number' ? { seg: opts } : opts;
  const seg = Math.max(3, Math.round(o.seg ?? 24));
  const phi0 = o.phiStart ?? 0;
  const phiLen = o.phiLength ?? Math.PI * 2;
  const creaseCos = Math.cos(((o.crease ?? 32) * Math.PI) / 180);
  const n = profile.length;
  const segN: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dr = profile[i + 1]![0] - profile[i]![0];
    const dy = profile[i + 1]![1] - profile[i]![1];
    const len = Math.hypot(dr, dy) || 1;
    segN.push([dy / len, -dr / len]);
  }
  interface Row {
    r: number;
    y: number;
    nr: number;
    ny: number;
    v: number;
  }
  const rows: Row[] = [];
  const segRows: [number, number][] = [];
  let dist = 0;
  let open = 0; // row index that starts the next segment
  for (let i = 0; i < n; i++) {
    const [r, y] = profile[i]!;
    if (i > 0) dist += Math.hypot(r - profile[i - 1]![0], y - profile[i - 1]![1]);
    const prev = segN[i - 1];
    const next = segN[i];
    if (prev && next && prev[0] * next[0] + prev[1] * next[1] < creaseCos) {
      rows.push({ r, y, nr: prev[0], ny: prev[1], v: dist });
      segRows.push([open, rows.length - 1]);
      rows.push({ r, y, nr: next[0], ny: next[1], v: dist });
      open = rows.length - 1;
    } else {
      let nr = (prev?.[0] ?? 0) + (next?.[0] ?? 0);
      let ny = (prev?.[1] ?? 0) + (next?.[1] ?? 0);
      const len = Math.hypot(nr, ny) || 1;
      nr /= len;
      ny /= len;
      rows.push({ r, y, nr, ny, v: dist });
      if (i > 0) segRows.push([open, rows.length - 1]);
      open = rows.length - 1;
    }
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const cols = seg + 1;
  for (const row of rows) {
    for (let j = 0; j <= seg; j++) {
      const phi = phi0 + (j / seg) * phiLen;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      pos.push(row.r * c, row.y, row.r * s);
      nor.push(row.nr * c, row.ny, row.nr * s);
      uv.push(j / seg, dist > 0 ? row.v / dist : 0);
    }
  }
  for (const [ra, rb] of segRows) {
    const a = rows[ra]!;
    const b = rows[rb]!;
    for (let j = 0; j < seg; j++) {
      const a0 = ra * cols + j;
      const a1 = a0 + 1;
      const b0 = rb * cols + j;
      const b1 = b0 + 1;
      if (a.r > 1e-7) idx.push(a0, b0, a1);
      if (b.r > 1e-7) idx.push(a1, b0, b1);
    }
  }
  return geometry(pos, nor, uv, idx);
}

export interface CylOptions {
  /** Top radius (default = bottom radius). */
  rTop?: number;
  /** Rim bevel radius. Default 12 % of the smallest dimension; 0 = hard rim. */
  bevel?: number;
  seg?: number;
  /** No caps (pipes whose ends are hidden). */
  open?: boolean;
}

/** Bevelled cylinder / frustum standing on y = 0. */
export function cyl(r: number, h: number, o: CylOptions = {}): BufferGeometry {
  const rt = o.rTop ?? r;
  if (o.open) {
    return lathe(
      [
        [r, 0],
        [rt, h],
      ],
      { seg: o.seg ?? 20 },
    );
  }
  const bevel = o.bevel ?? Math.min(r, rt, h) * 0.12;
  const profile: Pt[] = [
    [0, 0],
    [r, 0],
    [rt, h],
    [0, h],
  ];
  return lathe(bevel > 0 ? fillet(profile, bevel, 3) : profile, { seg: o.seg ?? 20 });
}

/** Cone with a rounded tip, standing on y = 0. `tip` = radius of the flattened top (default 8 % of r). */
export function cone(r: number, h: number, o: { tip?: number; bevel?: number; seg?: number } = {}): BufferGeometry {
  const tip = o.tip ?? r * 0.08;
  const profile: Pt[] = [
    [0, 0],
    [r, 0],
    [tip, h],
    [0, h],
  ];
  return lathe(fillet(profile, [0, o.bevel ?? r * 0.08, tip * 0.9, 0], 3), { seg: o.seg ?? 20 });
}

/** Dome (half ellipsoid) with a flat base on y = 0. */
export function dome(r: number, h = r, seg = 24, base = true): BufferGeometry {
  const profile: Pt[] = base ? [[0, 0]] : [];
  const steps = Math.max(4, Math.round(seg / 3));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    profile.push([Math.cos(a) * r, Math.sin(a) * h]);
  }
  profile[profile.length - 1] = [0, h];
  return lathe(profile, { seg, crease: 60 });
}

/* --------------------------------------------------------------------------------- round primitives */

export function sphere(r: number, seg = 20): BufferGeometry {
  return new SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.6)));
}

/** Faceted low-poly blob for rocks, coal lumps, crystals (use with a flat-shaded slot). */
export function facet(r: number, detail = 0): BufferGeometry {
  return new IcosahedronGeometry(r, detail);
}

/** Capsule along +Y, centred; total length = `length`, including both round caps. */
export function capsule(r: number, length: number, seg = 14): BufferGeometry {
  return new CapsuleGeometry(r, Math.max(length - 2 * r, 0.0001), Math.max(3, Math.round(seg / 3)), seg);
}

/** Torus lying flat around the Y axis (a band around a vertical cylinder), centred. */
export function ring(R: number, r: number, seg = 28, tubeSeg = 8, arc = Math.PI * 2): BufferGeometry {
  const g = new TorusGeometry(R, r, tubeSeg, seg, arc);
  g.rotateX(Math.PI / 2);
  return g;
}

/* ---------------------------------------------------------------------------------- paths and tubes */

/** Replace the corners of a polyline by arcs of (at most) `bend` radius — elbows of pipes, cable routes. */
export function roundPath(points: readonly Vector3[], bend: number, steps = 6): Vector3[] {
  if (points.length < 3 || bend <= 0) return points.map((p) => p.clone());
  const out: Vector3[] = [points[0]!.clone()];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const a = points[i - 1]!;
    const b = points[i + 1]!;
    const la = a.distanceTo(p);
    const lb = b.distanceTo(p);
    const d = Math.min(bend, la * 0.48, lb * 0.48);
    if (d < 1e-6) {
      out.push(p.clone());
      continue;
    }
    const s = p.clone().lerp(a, d / la);
    const e = p.clone().lerp(b, d / lb);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      out.push(
        new Vector3()
          .addScaledVector(s, (1 - t) * (1 - t))
          .addScaledVector(p, 2 * t * (1 - t))
          .addScaledVector(e, t * t),
      );
    }
  }
  out.push(points[points.length - 1]!.clone());
  return out;
}

/**
 * Sagging conductor between two supports. The sag curve is a true catenary y = a·cosh(x/a) for a level
 * span of the same horizontal length, added to the chord (the usual inclined-span approximation).
 * `sag` = mid-span drop below the chord, in the same units as the points.
 */
export function catenary(a: Vector3, b: Vector3, sag: number, segments = 24): Vector3[] {
  const span = Math.hypot(b.x - a.x, b.z - a.z) || a.distanceTo(b);
  const pts: Vector3[] = [];
  if (sag <= 1e-6 || span <= 1e-6) {
    for (let i = 0; i <= segments; i++) pts.push(a.clone().lerp(b, i / segments));
    return pts;
  }
  // solve sag = c·(cosh(L/2c) − 1) for the catenary parameter c (Newton; starts from the parabola value)
  let c = (span * span) / (8 * sag);
  for (let k = 0; k < 12; k++) {
    const x = span / (2 * c);
    const f = c * (Math.cosh(x) - 1) - sag;
    const df = Math.cosh(x) - 1 - x * Math.sinh(x);
    c -= f / df;
  }
  const top = Math.cosh(span / (2 * c));
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = a.clone().lerp(b, t);
    p.y += c * (Math.cosh((span * (t - 0.5)) / c) - top);
    pts.push(p);
  }
  return pts;
}

/** Total length of a polyline. */
export function pathLength(points: readonly Vector3[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += points[i]!.distanceTo(points[i - 1]!);
  return len;
}

/** Point and unit tangent at distance `s` along a polyline (clamped). */
export function pathAt(
  points: readonly Vector3[],
  s: number,
  outPoint: Vector3,
  outTangent?: Vector3,
): Vector3 {
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = a.distanceTo(b);
    if (s <= acc + d || i === points.length - 1) {
      const t = d > 0 ? Math.min(Math.max((s - acc) / d, 0), 1) : 0;
      outPoint.copy(a).lerp(b, t);
      if (outTangent) outTangent.copy(b).sub(a).normalize();
      return outPoint;
    }
    acc += d;
  }
  return outPoint.copy(points[points.length - 1]!);
}

export interface TubeOptions {
  /** Segments around the section. Default 10. */
  seg?: number;
  closed?: boolean;
  /** Flat end caps. Default true for open paths. */
  caps?: boolean;
  /** Radius multiplier along the path, t = 0…1. */
  taper?: (t: number) => number;
  /** Offset added to `uv.x` (to continue a pulse train over several pieces). */
  uOffset?: number;
}

/**
 * Tube swept along a dense polyline with rotation-minimising frames (no twisting at elbows).
 * `uv.x` = distance along the path in world units, `uv.y` = around the section.
 */
export function tube(points: readonly Vector3[], radius: number, o: TubeOptions = {}): BufferGeometry {
  const seg = o.seg ?? 10;
  const closed = o.closed ?? false;
  const n = points.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const tangent = new Vector3();
  const prevTangent = new Vector3();
  const normal = new Vector3();
  const binormal = new Vector3();
  const q = new Quaternion();
  const v = new Vector3();
  const tangentAt = (i: number, out: Vector3): Vector3 => {
    const a = points[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)]!;
    const b = points[closed ? (i + 1) % n : Math.min(i + 1, n - 1)]!;
    return out.copy(b).sub(a).normalize();
  };
  tangentAt(0, tangent);
  // initial normal: any vector perpendicular to the first tangent, preferring "up"
  normal.set(0, 1, 0);
  if (Math.abs(tangent.y) > 0.92) normal.set(1, 0, 0);
  normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
  let dist = o.uOffset ?? 0;
  const rings = closed ? n + 1 : n;
  for (let i = 0; i < rings; i++) {
    const k = i % n;
    if (i > 0) {
      dist += points[k]!.distanceTo(points[(i - 1) % n]!);
      prevTangent.copy(tangent);
      tangentAt(k, tangent);
      q.setFromUnitVectors(prevTangent, tangent);
      normal.applyQuaternion(q);
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    }
    binormal.crossVectors(tangent, normal);
    const r = radius * (o.taper ? o.taper(i / (rings - 1)) : 1);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      v.copy(normal)
        .multiplyScalar(Math.cos(a))
        .addScaledVector(binormal, Math.sin(a));
      const p = points[k]!;
      pos.push(p.x + v.x * r, p.y + v.y * r, p.z + v.z * r);
      nor.push(v.x, v.y, v.z);
      uv.push(dist, j / seg);
    }
  }
  const cols = seg + 1;
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (!closed && (o.caps ?? true)) {
    for (const end of [0, 1]) {
      const i = end === 0 ? 0 : n - 1;
      tangentAt(i, tangent);
      if (end === 0) tangent.negate();
      const centre = pos.length / 3;
      const p = points[i]!;
      pos.push(p.x, p.y, p.z);
      nor.push(tangent.x, tangent.y, tangent.z);
      uv.push(end === 0 ? (o.uOffset ?? 0) : dist, 0.5);
      const first = pos.length / 3;
      for (let j = 0; j <= seg; j++) {
        const src = (i * cols + j) * 3;
        pos.push(pos[src]!, pos[src + 1]!, pos[src + 2]!);
        nor.push(tangent.x, tangent.y, tangent.z);
        uv.push(end === 0 ? (o.uOffset ?? 0) : dist, j / seg);
      }
      for (let j = 0; j < seg; j++) {
        if (end === 0) idx.push(centre, first + j + 1, first + j);
        else idx.push(centre, first + j, first + j + 1);
      }
    }
  }
  return geometry(pos, nor, uv, idx);
}

/** Straight tube between two points (struts, rods, wires). */
export function rod(a: Vector3, b: Vector3, radius: number, seg = 8): BufferGeometry {
  return tube([a, b], radius, { seg });
}

/* ---------------------------------------------------------------------------------------- extrusions */

export function rrectShape(w: number, h: number, r: number): Shape {
  const x = -w / 2;
  const y = -h / 2;
  const k = Math.min(r, w / 2, h / 2);
  const s = new Shape();
  s.moveTo(x + k, y);
  s.lineTo(x + w - k, y);
  s.quadraticCurveTo(x + w, y, x + w, y + k);
  s.lineTo(x + w, y + h - k);
  s.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  s.lineTo(x + k, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - k);
  s.lineTo(x, y + k);
  s.quadraticCurveTo(x, y, x + k, y);
  return s;
}

/** Closed polygon (counter-clockwise) with rounded corners. `r` may be per-vertex. */
export function polyShape(points: readonly Pt[], r: number | readonly number[] = 0): Shape {
  const n = points.length;
  const s = new Shape();
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const a = points[(i - 1 + n) % n]!;
    const b = points[(i + 1) % n]!;
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const d = Math.min(typeof r === 'number' ? r : (r[i] ?? 0), la * 0.45, lb * 0.45);
    const sx = p[0] + ((a[0] - p[0]) / la) * d;
    const sy = p[1] + ((a[1] - p[1]) / la) * d;
    if (i === 0) s.moveTo(sx, sy);
    else s.lineTo(sx, sy);
    if (d > 1e-6) s.quadraticCurveTo(p[0], p[1], p[0] + ((b[0] - p[0]) / lb) * d, p[1] + ((b[1] - p[1]) / lb) * d);
  }
  s.closePath();
  return s;
}

export interface ExtrudeOptions {
  /** Edge bevel (kept inside the outline, so the shape stays true to size). Default 0. */
  bevel?: number;
  bevelSeg?: number;
  curveSeg?: number;
}

/** Extrude an XY outline along Z, centred on z = 0, total thickness `depth` (bevels included). */
export function extrude(outline: Shape | readonly Pt[], depth: number, o: ExtrudeOptions = {}): BufferGeometry {
  const shape = outline instanceof Shape ? outline : polyShape(outline);
  const bevel = Math.min(o.bevel ?? 0, depth * 0.49);
  const g = new ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelOffset: -bevel,
    bevelSegments: o.bevelSeg ?? 2,
    curveSegments: o.curveSeg ?? 8,
  });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
}

/* ------------------------------------------------------------------------------- solids of revolution */

/**
 * Revolve a *closed* cross-section (counter-clockwise in the (r, y) half-plane) through part of a turn and
 * close the two cut faces. This is how the kit builds cutaway shells (casings, stator frames, cooling-tower
 * shells, tanks with a window): the section faces are returned separately so they can get the "cut" colour.
 */
export function revolve(
  section: readonly Pt[],
  o: { seg?: number; phiStart?: number; phiLength?: number; crease?: number } = {},
): { shell: BufferGeometry; caps: BufferGeometry | null } {
  const phi0 = o.phiStart ?? 0;
  const phiLen = Math.min(o.phiLength ?? Math.PI * 2, Math.PI * 2);
  const closed = [...section, section[0]!];
  const shell = lathe(closed, { seg: o.seg ?? 32, phiStart: phi0, phiLength: phiLen, crease: o.crease });
  if (phiLen >= Math.PI * 2 - 1e-6) return { shell, caps: null };
  const contour = section.map(([r, y]) => new Vector2(r, y));
  const faces = ShapeUtils.triangulateShape(contour, []);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const end of [0, 1]) {
    const phi = phi0 + end * phiLen;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const sign = end === 0 ? -1 : 1; // the start face looks back along −φ, the end face along +φ
    const base = pos.length / 3;
    for (const [r, y] of section) {
      pos.push(r * c, y, r * s);
      nor.push(-s * sign, 0, c * sign);
      uv.push(r, y);
    }
    for (const f of faces) {
      const [i0, i1, i2] = f as [number, number, number];
      const a = section[i0]!;
      const b = section[i1]!;
      const d = section[i2]!;
      const ccw = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]) > 0;
      // counter-clockwise in (r, y) faces +φ
      if (ccw === (sign > 0)) idx.push(base + i0, base + i1, base + i2);
      else idx.push(base + i0, base + i2, base + i1);
    }
  }
  return { shell, caps: geometry(pos, nor, uv, idx) };
}

/**
 * Loft: skin through a list of closed section rings (each ring = the same number of points, same winding).
 * Used for aerofoil blades, hulls, car bodies. Normals are smooth; the ends are capped with fans.
 */
export function loft(ringsIn: readonly (readonly Vector3[])[], caps = true): BufferGeometry {
  const m = ringsIn[0]!.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  ringsIn.forEach((ringPts, i) => {
    for (let j = 0; j <= m; j++) {
      const p = ringPts[j % m]!;
      pos.push(p.x, p.y, p.z);
      uv.push(i / (ringsIn.length - 1), j / m);
    }
  });
  const cols = m + 1;
  // Orientation is detected, not demanded from the caller: faces must look away from the section centre.
  const mid = Math.max(0, Math.floor(ringsIn.length / 2) - 1);
  const r0 = ringsIn[mid]!;
  const r1 = ringsIn[mid + 1]!;
  const centre0 = new Vector3();
  for (const p of r0) centre0.add(p);
  centre0.multiplyScalar(1 / m);
  let vote = 0;
  for (let j = 0; j < m; j++) {
    const a = r0[j]!;
    const n = new Vector3()
      .subVectors(r1[j]!, a)
      .cross(new Vector3().subVectors(r0[(j + 1) % m]!, a));
    vote += Math.sign(n.dot(new Vector3().subVectors(a, centre0)));
  }
  const outward = vote >= 0;
  for (let i = 0; i < ringsIn.length - 1; i++) {
    for (let j = 0; j < m; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (outward) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the seam normals (column 0 and column m are the same points)
  const normal = g.getAttribute('normal');
  for (let i = 0; i < ringsIn.length; i++) {
    const a = i * cols;
    const b = a + m;
    const nx = normal.getX(a) + normal.getX(b);
    const ny = normal.getY(a) + normal.getY(b);
    const nz = normal.getZ(a) + normal.getZ(b);
    const len = Math.hypot(nx, ny, nz) || 1;
    normal.setXYZ(a, nx / len, ny / len, nz / len);
    normal.setXYZ(b, nx / len, ny / len, nz / len);
  }
  if (!caps) return g;
  const parts: BufferGeometry[] = [g];
  for (const end of [0, ringsIn.length - 1]) {
    const ringPts = ringsIn[end]!;
    const centre = new Vector3();
    for (const p of ringPts) centre.add(p);
    centre.multiplyScalar(1 / m);
    const n = new Vector3()
      .subVectors(ringPts[1]!, ringPts[0]!)
      .cross(new Vector3().subVectors(ringPts[2 % m]!, ringPts[0]!))
      .normalize();
    // the outward direction of an end cap points away from the neighbouring ring
    const other = ringsIn[end === 0 ? 1 : ringsIn.length - 2]![0]!;
    const flip = n.dot(new Vector3().subVectors(ringPts[0]!, other)) < 0;
    if (flip) n.negate();
    const cp: number[] = [centre.x, centre.y, centre.z];
    const cn: number[] = [n.x, n.y, n.z];
    const cuv: number[] = [0.5, 0.5];
    const ci: number[] = [];
    for (let j = 0; j < m; j++) {
      const p = ringPts[j]!;
      cp.push(p.x, p.y, p.z);
      cn.push(n.x, n.y, n.z);
      cuv.push(0, 0);
      const a = 1 + j;
      const b = 1 + ((j + 1) % m);
      if (flip) ci.push(0, b, a);
      else ci.push(0, a, b);
    }
    parts.push(geometry(cp, cn, cuv, ci));
  }
  return mergeGeometries(parts);
}

/* ------------------------------------------------------------------------------------------- merging */

/** Merge geometries that have `position`, `normal`, `uv` (indexed or not) into one indexed geometry. */
export function mergeGeometries(parts: readonly BufferGeometry[]): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const g of parts) {
    const base = pos.length / 3;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const t = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (t) uv.push(t.getX(i), t.getY(i));
      else uv.push(0, 0);
    }
    const index = g.getIndex();
    if (index) for (let i = 0; i < index.count; i++) idx.push(base + index.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
  }
  return geometry(pos, nor, uv, idx);
}

/** Number of triangles of a geometry. */
export function triangleCount(g: BufferGeometry): number {
  const index = g.getIndex();
  return (index ? index.count : g.getAttribute('position').count) / 3;
}

/**
 * Many flat rectangles facing +Y in one geometry: `[x, z, width (x), depth (z)]` each, all at height `y`.
 * Two triangles per rectangle — for cell grids, tiles, markings, where boxes would waste triangles.
 */
export function quads(rects: readonly (readonly [number, number, number, number])[], y = 0): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  rects.forEach(([x, z, w, d], i) => {
    pos.push(x - w / 2, y, z + d / 2, x + w / 2, y, z + d / 2, x + w / 2, y, z - d / 2, x - w / 2, y, z - d / 2);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  return geometry(pos, nor, uv, idx);
}
