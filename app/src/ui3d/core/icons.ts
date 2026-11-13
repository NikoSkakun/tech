/**
 * Procedural icon set (STYLE_GUIDE §6: simple geometric, 2 px-eq stroke at 24 px, one consistent family).
 *
 * Every icon is a signed-distance function on a 24×24 design grid (origin top-left, y down, negative =
 * inside). At start-up the set is rasterised once into a single-channel SDF atlas, so icons render through
 * the shape batch with analytic antialiasing at any size — no image files, no extra draw calls.
 */
import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from 'three';

type Sdf = (x: number, y: number) => number;

const STROKE = 2;
const TAU = Math.PI * 2;

const circle =
  (cx: number, cy: number, r: number): Sdf =>
  (x, y) =>
    Math.hypot(x - cx, y - cy) - r;

const ring = (cx: number, cy: number, r: number, w = STROKE): Sdf => {
  const c = circle(cx, cy, r);
  return (x, y) => Math.abs(c(x, y)) - w / 2;
};

const box =
  (cx: number, cy: number, hw: number, hh: number, r = 0): Sdf =>
  (x, y) => {
    const qx = Math.abs(x - cx) - hw + r;
    const qy = Math.abs(y - cy) - hh + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };

const frame = (cx: number, cy: number, hw: number, hh: number, r = 0, w = STROKE): Sdf => {
  const b = box(cx, cy, hw, hh, r);
  return (x, y) => Math.abs(b(x, y)) - w / 2;
};

const seg =
  (ax: number, ay: number, bx: number, by: number, w = STROKE): Sdf =>
  (x, y) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0), 1);
    return Math.hypot(x - ax - dx * t, y - ay - dy * t) - w / 2;
  };

const union =
  (...parts: Sdf[]): Sdf =>
  (x, y) => {
    let d = Infinity;
    for (const p of parts) d = Math.min(d, p(x, y));
    return d;
  };

const cut =
  (a: Sdf, b: Sdf): Sdf =>
  (x, y) =>
    Math.max(a(x, y), -b(x, y));

/** Open polyline with round joints. */
const path = (pts: number[], w = STROKE): Sdf => {
  const parts: Sdf[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2)
    parts.push(seg(pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, w));
  return union(...parts);
};

/** Filled polygon (signed), optionally rounded by `r`. */
const poly = (pts: number[], r = 0): Sdf => {
  const n = pts.length / 2;
  return (x, y) => {
    let d = Infinity;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[i * 2]!;
      const yi = pts[i * 2 + 1]!;
      const xj = pts[j * 2]!;
      const yj = pts[j * 2 + 1]!;
      const ex = xj - xi;
      const ey = yj - yi;
      const t = Math.min(Math.max(((x - xi) * ex + (y - yi) * ey) / (ex * ex + ey * ey || 1), 0), 1);
      d = Math.min(d, Math.hypot(x - xi - ex * t, y - yi - ey * t));
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return (inside ? -d : d) - r;
  };
};

/** Circular arc stroke from angle `a0` to `a1` (radians, clockwise from 12 o'clock). */
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, w = STROKE): Sdf => {
  const pts: number[] = [];
  const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 0.22));
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
  }
  return path(pts, w);
};

const gear = (): Sdf => {
  const teeth: Sdf[] = [circle(12, 12, 6.4)];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    teeth.push(
      seg(12 + Math.sin(a) * 6, 12 - Math.cos(a) * 6, 12 + Math.sin(a) * 8.6, 12 - Math.cos(a) * 8.6, 3.3),
    );
  }
  return cut(union(...teeth), circle(12, 12, 2.9));
};

const speaker = poly([4, 9.5, 7.5, 9.5, 12, 5.5, 12, 18.5, 7.5, 14.5, 4, 14.5], 0.6);

/** Icon definitions. Keep the stroke at `STROKE` and leave ~2 units of margin for optical consistency. */
const DEFS = {
  play: poly([9, 6, 18.5, 12, 9, 18], 1.4),
  pause: union(box(8.5, 12, 1.9, 6.5, 1.2), box(15.5, 12, 1.9, 6.5, 1.2)),
  next: path([9, 5, 16, 12, 9, 19], 2.4),
  prev: path([15, 5, 8, 12, 15, 19], 2.4),
  chevronUp: path([5, 15, 12, 8, 19, 15], 2.4),
  chevronDown: path([5, 9, 12, 16, 19, 9], 2.4),
  arrowRight: union(path([4, 12, 20, 12], 2.2), path([14, 6, 20, 12, 14, 18], 2.2)),
  arrowLeft: union(path([4, 12, 20, 12], 2.2), path([10, 6, 4, 12, 10, 18], 2.2)),
  map: union(
    path([3.5, 6.5, 9, 4.5, 15, 6.5, 20.5, 4.5, 20.5, 17.5, 15, 19.5, 9, 17.5, 3.5, 19.5, 3.5, 6.5]),
    path([9, 4.5, 9, 17.5], 1.6),
    path([15, 6.5, 15, 19.5], 1.6),
  ),
  settings: gear(),
  soundOn: union(
    speaker,
    arc(12, 12, 4.2, 0.55, Math.PI - 0.55, 1.9),
    arc(12, 12, 7.6, 0.6, Math.PI - 0.6, 1.9),
  ),
  soundOff: union(speaker, path([15.5, 9, 21, 15], 2), path([21, 9, 15.5, 15], 2)),
  fullscreen: union(
    path([4, 9, 4, 4, 9, 4]),
    path([15, 4, 20, 4, 20, 9]),
    path([20, 15, 20, 20, 15, 20]),
    path([9, 20, 4, 20, 4, 15]),
  ),
  fullscreenExit: union(
    path([4, 9, 9, 9, 9, 4]),
    path([15, 4, 15, 9, 20, 9]),
    path([20, 15, 15, 15, 15, 20]),
    path([9, 20, 9, 15, 4, 15]),
  ),
  info: union(ring(12, 12, 8.6), circle(12, 7.7, 1.35), path([12, 11.2, 12, 16.6], 2.2)),
  help: union(
    ring(12, 12, 8.6),
    arc(12, 9.6, 2.7, -1.35, 2.35, 2),
    path([13.4, 11.9, 12, 13.2, 12, 14.2], 2),
    circle(12, 17, 1.25),
  ),
  close: union(path([6, 6, 18, 18], 2.4), path([18, 6, 6, 18], 2.4)),
  resetView: union(arc(12, 12.5, 7, 0.95, TAU - 0.55, 2), poly([4.6, 3.4, 10.6, 4.6, 6.2, 9.4], 0.5)),
  plus: union(path([12, 5, 12, 19], 2.4), path([5, 12, 19, 12], 2.4)),
  minus: path([5, 12, 19, 12], 2.4),
  check: path([5, 12.5, 10, 17.5, 19, 7], 2.6),
  warning: union(
    cut(poly([12, 4.2, 20.6, 19, 3.4, 19], 1.6), poly([12, 8.2, 17.3, 17.2, 6.7, 17.2], 0.4)),
    path([12, 10.4, 12, 13.6], 2),
    circle(12, 15.8, 1.1),
  ),
  lightning: poly([13.6, 2.6, 5.4, 13.2, 10.8, 13.2, 9.6, 21.4, 18.6, 10.2, 13, 10.2], 0.5),
  home: union(
    path([3.5, 11.5, 12, 4, 20.5, 11.5], 2.2),
    path([6, 10.5, 6, 19.5, 18, 19.5, 18, 10.5]),
    path([10.5, 19.5, 10.5, 14.5, 13.5, 14.5, 13.5, 19.5], 1.7),
  ),
  book: union(
    path([12, 7, 12, 19.5], 1.8),
    path([12, 7, 9.5, 5.4, 3.5, 5.4, 3.5, 17.6, 9.5, 17.6, 12, 19.5]),
    path([12, 7, 14.5, 5.4, 20.5, 5.4, 20.5, 17.6, 14.5, 17.6, 12, 19.5]),
  ),
  layers: union(
    cut(poly([12, 3.6, 21, 8.4, 12, 13.2, 3, 8.4], 0.5), poly([12, 6.1, 16.4, 8.4, 12, 10.7, 7.6, 8.4], 0)),
    path([3.6, 12.4, 12, 16.9, 20.4, 12.4]),
    path([3.6, 16.2, 12, 20.7, 20.4, 16.2]),
  ),
  eye: union(
    path([2.5, 12, 5.5, 8.4, 9, 6.4, 12, 5.9, 15, 6.4, 18.5, 8.4, 21.5, 12]),
    path([2.5, 12, 5.5, 15.6, 9, 17.6, 12, 18.1, 15, 17.6, 18.5, 15.6, 21.5, 12]),
    circle(12, 12, 3),
  ),
  hand: union(
    box(12.2, 15.6, 5.2, 4.6, 2.6),
    seg(8.2, 13, 8.2, 8.4, 2.5),
    seg(11, 12, 11, 4.6, 2.5),
    seg(13.8, 12, 13.8, 6.4, 2.5),
    seg(16.4, 13, 16.4, 8.6, 2.3),
    seg(7.6, 16.6, 5, 13.6, 2.5),
  ),
  quiz: union(
    path([4, 5, 20, 5, 20, 16, 12.5, 16, 8, 20, 8, 16, 4, 16, 4, 5]),
    arc(12, 9.4, 2.1, -1.3, 2.3, 1.7),
    circle(12, 13.7, 0.95),
  ),
  chart: union(path([4, 4, 4, 20, 20, 20]), path([7, 16, 10.5, 11.5, 13.5, 13.8, 19, 7], 2)),
  lock: union(
    box(12, 15, 6.2, 4.8, 1.8),
    arc(12, 10.4, 3.9, -Math.PI / 2, Math.PI / 2),
    path([8.1, 10.4, 8.1, 12]),
    path([15.9, 10.4, 15.9, 12]),
  ),
  search: union(ring(10.5, 10.5, 5.8), path([15, 15, 20, 20], 2.4)),
  menu: union(path([4.5, 7, 19.5, 7], 2.2), path([4.5, 12, 19.5, 12], 2.2), path([4.5, 17, 19.5, 17], 2.2)),
  pin: cut(union(circle(12, 9.4, 6), poly([7.2, 13, 16.8, 13, 12, 21.4], 0.3)), circle(12, 9.4, 2.4)),
  target: union(
    ring(12, 12, 7.6),
    circle(12, 12, 2.6),
    path([12, 2, 12, 5]),
    path([12, 19, 12, 22]),
    path([2, 12, 5, 12]),
    path([19, 12, 22, 12]),
  ),
  star: poly(
    Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * TAU;
      const r = i % 2 === 0 ? 8.6 : 3.9;
      return [12 + Math.sin(a) * r, 12.6 - Math.cos(a) * r];
    }).flat(),
    0.9,
  ),
  dot: circle(12, 12, 4.2),
  link: union(path([8, 16, 17.5, 6.5], 2.2), path([10, 6.5, 17.5, 6.5, 17.5, 14], 2.2)),
  ruler: union(
    frame(12, 12, 9.2, 4.4, 1.2),
    path([7, 7.6, 7, 11], 1.5),
    path([10.4, 7.6, 10.4, 12.6], 1.5),
    path([13.8, 7.6, 13.8, 11], 1.5),
    path([17.2, 7.6, 17.2, 12.6], 1.5),
  ),
  mouse: union(frame(12, 12, 5.6, 8.4, 5.6), path([12, 6.6, 12, 10], 2)),
  touch: union(
    box(12.4, 16.4, 4.8, 4, 2.4),
    seg(10.4, 14, 10.4, 7.4, 2.5),
    seg(13.2, 14, 13.2, 11.4, 2.4),
    seg(15.8, 14.6, 15.8, 12.2, 2.3),
    seg(8.2, 17, 6.4, 14.6, 2.4),
    arc(10.4, 7.4, 4.3, -1.25, 1.25, 1.5),
  ),
  keyboard: union(
    frame(12, 12, 9.4, 6, 1.8),
    circle(7, 10, 1),
    circle(10.4, 10, 1),
    circle(13.8, 10, 1),
    circle(17.2, 10, 1),
    path([8, 14.4, 16, 14.4], 1.8),
  ),
  glossary: union(
    frame(12, 12, 6.6, 8.4, 1.6),
    path([9, 8, 15, 8], 1.7),
    path([9, 11.5, 15, 11.5], 1.7),
    path([9, 15, 12.6, 15], 1.7),
  ),
  expand: union(
    path([13.5, 4.5, 19.5, 4.5, 19.5, 10.5]),
    path([19.5, 4.5, 13, 11]),
    path([10.5, 19.5, 4.5, 19.5, 4.5, 13.5]),
    path([4.5, 19.5, 11, 13]),
  ),
  drag: union(
    path([12, 3.5, 12, 20.5]),
    path([3.5, 12, 20.5, 12]),
    path([9.6, 5.9, 12, 3.5, 14.4, 5.9]),
    path([9.6, 18.1, 12, 20.5, 14.4, 18.1]),
    path([5.9, 9.6, 3.5, 12, 5.9, 14.4]),
    path([18.1, 9.6, 20.5, 12, 18.1, 14.4]),
  ),
  clock: union(ring(12, 12, 8.6), path([12, 7, 12, 12, 15.6, 14.2], 2)),
  scale: union(path([4, 20, 20, 4], 2), path([14.5, 4, 20, 4, 20, 9.5], 2), circle(6, 18, 2.6)),
} as const satisfies Record<string, Sdf>;

export type IconName = keyof typeof DEFS;

export const ICON_NAMES = Object.keys(DEFS) as IconName[];

/** Atlas layout shared with the shape shader. */
export const ICON_GRID = { cols: 8, cell: 64, design: 24, range: 2.5 } as const;

const index = new Map<string, number>(ICON_NAMES.map((n, i) => [n, i]));

export function iconIndex(name: IconName): number {
  return index.get(name) ?? 0;
}

/** Sample an icon's signed distance (design units) — exposed for unit tests. */
export function iconDistance(name: IconName, x: number, y: number): number {
  return DEFS[name](x, y);
}

let atlas: DataTexture | null = null;

/** The SDF atlas (R8; 0.5 = edge, > 0.5 inside). Built lazily, engine-lifetime. */
export function iconAtlas(): DataTexture {
  if (atlas) return atlas;
  const { cols, cell, design, range } = ICON_GRID;
  const rows = Math.ceil(ICON_NAMES.length / cols);
  const width = cols * cell;
  const height = rows * cell;
  const data = new Uint8Array(width * height);
  const unit = design / cell;
  ICON_NAMES.forEach((name, i) => {
    const f = DEFS[name];
    const ox = (i % cols) * cell;
    const oy = Math.floor(i / cols) * cell;
    for (let py = 0; py < cell; py++) {
      for (let px = 0; px < cell; px++) {
        const d = f((px + 0.5) * unit, (py + 0.5) * unit);
        data[(oy + py) * width + ox + px] = Math.round(Math.min(Math.max(0.5 - d / (2 * range), 0), 1) * 255);
      }
    }
  });
  const texture = new DataTexture(data, width, height, RedFormat, UnsignedByteType);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.userData.shared = true; // engine-lifetime: chapter disposal must skip it
  texture.needsUpdate = true;
  atlas = texture;
  return texture;
}

/** Number of atlas rows (the shader needs it to address cells). */
export function iconRows(): number {
  return Math.ceil(ICON_NAMES.length / ICON_GRID.cols);
}
