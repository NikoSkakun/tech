/**
 * Generic journey-map emblems, one per chapter group — used until a chapter ships its own `emblem.ts`.
 *
 * Emblem convention (also for chapter-provided ones, see docs/UI_API.md): a small model that fits a unit
 * sphere (radius ≤ 1) centred on the origin, Y up, front toward +Z, built from rounded primitives in palette
 * colours; static (the map bobs and spins it as a whole). The generic ones are merged into a single
 * vertex-coloured geometry each, so all chapters of a group draw as one instanced mesh.
 */
import {
  BoxGeometry,
  BufferAttribute,
  ConeGeometry,
  CylinderGeometry,
  Matrix4,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { col, type ColorToken } from '@/style';

type Xform = {
  p?: [number, number, number];
  r?: [number, number, number];
  s?: number | [number, number, number];
};

const _m = new Matrix4();
const _r = new Matrix4();

function part(g: BufferGeometry, color: ColorToken, x: Xform = {}): BufferGeometry {
  const s = x.s ?? 1;
  _m.makeScale(...(typeof s === 'number' ? ([s, s, s] as const) : s));
  if (x.r) {
    _m.premultiply(_r.makeRotationX(x.r[0]));
    _m.premultiply(_r.makeRotationY(x.r[1]));
    _m.premultiply(_r.makeRotationZ(x.r[2]));
  }
  if (x.p) _m.premultiply(_r.makeTranslation(...x.p));
  g.applyMatrix4(_m);
  const c = col(color);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

const sphere = (r: number): BufferGeometry => new SphereGeometry(r, 20, 14);
const box = (w: number, h: number, d: number): BufferGeometry => new BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 18): BufferGeometry =>
  new CylinderGeometry(rt, rb, h, seg);

const BUILDERS: Record<string, () => BufferGeometry[]> = {
  // atom: nucleus cluster and two tilted orbits with electrons
  micro: () => [
    part(sphere(0.26), 'coral', { p: [0.08, 0.04, 0] }),
    part(sphere(0.22), 'mist', { p: [-0.14, -0.06, 0.08] }),
    part(sphere(0.2), 'coral', { p: [0.02, -0.12, -0.14] }),
    part(new TorusGeometry(0.8, 0.035, 8, 48), 'cyan', { r: [1.2, 0, 0.5] }),
    part(new TorusGeometry(0.8, 0.035, 8, 48), 'cyan', { r: [1.2, 0, -0.9] }),
    part(sphere(0.11), 'cyan.light', { p: [0.7, 0.36, 0.16] }),
    part(sphere(0.11), 'cyan.light', { p: [-0.5, 0.6, -0.18] }),
  ],
  // horseshoe magnet with coloured poles and a coil
  em: () => [
    part(new TorusGeometry(0.46, 0.17, 12, 28, Math.PI), 'steel', { p: [0, 0.12, 0] }),
    part(cyl(0.17, 0.17, 0.62), 'coral', { p: [-0.46, -0.19, 0] }),
    part(cyl(0.17, 0.17, 0.62), 'blue', { p: [0.46, -0.19, 0] }),
    part(cyl(0.175, 0.175, 0.14), 'white', { p: [-0.46, -0.52, 0] }),
    part(cyl(0.175, 0.175, 0.14), 'white', { p: [0.46, -0.52, 0] }),
    part(new TorusGeometry(0.23, 0.05, 8, 20), 'amber', { p: [0, 0.6, 0], r: [0, Math.PI / 2, 0] }),
    part(new TorusGeometry(0.23, 0.05, 8, 20), 'amber', { p: [0.1, 0.58, 0], r: [0, Math.PI / 2, 0] }),
    part(new TorusGeometry(0.23, 0.05, 8, 20), 'amber', { p: [-0.1, 0.58, 0], r: [0, Math.PI / 2, 0] }),
  ],
  // power plant: hall, chimney with a stripe, cooling tower
  plants: () => [
    part(box(0.9, 0.46, 0.6), 'mist', { p: [-0.18, -0.38, 0] }),
    part(box(0.94, 0.08, 0.64), 'coral', { p: [-0.18, -0.12, 0] }),
    part(cyl(0.09, 0.12, 0.95, 12), 'white', { p: [-0.42, 0.2, 0.05] }),
    part(cyl(0.1, 0.1, 0.12, 12), 'coral', { p: [-0.42, 0.52, 0.05] }),
    part(cyl(0.22, 0.34, 0.5, 20), 'steel.light', { p: [0.52, -0.36, 0] }),
    part(cyl(0.27, 0.22, 0.34, 20), 'steel.light', { p: [0.52, 0.06, 0] }),
    part(sphere(0.2), 'white', { p: [0.56, 0.46, 0], s: [1.2, 0.8, 1] }),
  ],
  // transmission pylon with crossarms and insulators
  grid: () => [
    part(cyl(0.05, 0.3, 1.5, 4), 'steel', { p: [0, -0.1, 0] }),
    part(box(1.2, 0.07, 0.09), 'steel.light', { p: [0, 0.3, 0] }),
    part(box(0.84, 0.07, 0.09), 'steel.light', { p: [0, 0.56, 0] }),
    ...[-0.55, 0.55].flatMap((x) => [part(sphere(0.07), 'yellow', { p: [x, 0.2, 0] })]),
    ...[-0.38, 0.38].flatMap((x) => [part(sphere(0.07), 'yellow', { p: [x, 0.46, 0] })]),
    part(sphere(0.07), 'yellow', { p: [0, 0.72, 0] }),
  ],
  // house with a warm window and a chimney
  home: () => [
    part(box(0.95, 0.62, 0.8), 'white', { p: [0, -0.34, 0] }),
    part(new ConeGeometry(0.86, 0.52, 4), 'coral', { p: [0, 0.23, 0], r: [0, Math.PI / 4, 0] }),
    part(box(0.2, 0.36, 0.04), 'green', { p: [-0.2, -0.47, 0.41] }),
    part(box(0.24, 0.22, 0.04), 'yellow', { p: [0.2, -0.28, 0.41] }),
    part(box(0.13, 0.3, 0.13), 'steel', { p: [0.3, 0.34, 0] }),
  ],
  // battery with terminals and a charge mark
  labs: () => [
    part(cyl(0.38, 0.38, 1.0, 24), 'lime', { p: [0, -0.1, 0] }),
    part(cyl(0.39, 0.39, 0.2, 24), 'bg.indigo', { p: [0, 0.32, 0] }),
    part(cyl(0.16, 0.16, 0.14, 16), 'mist', { p: [0, 0.5, 0] }),
    part(box(0.34, 0.09, 0.05), 'white', { p: [0, -0.16, 0.38] }),
    part(box(0.09, 0.34, 0.05), 'white', { p: [0, -0.16, 0.38] }),
  ],
};

const cache = new Map<string, BufferGeometry>();

/** Names of the emblems a volume can give to its groups (`volume.ts` → `journey.emblems`). */
export const EMBLEM_NAMES: readonly string[] = Object.keys(BUILDERS);

/**
 * Merged, vertex-coloured geometry of a generic emblem by name (cached, engine-lifetime). An unknown name
 * (a group without an emblem of its own) gets the first one.
 */
export function emblemGeometry(name: string): BufferGeometry {
  const group = name in BUILDERS ? name : EMBLEM_NAMES[0]!;
  let g = cache.get(group);
  if (!g) {
    const parts = BUILDERS[group]!();
    g = mergeGeometries(parts, false)!;
    for (const p of parts) p.dispose();
    g.userData.shared = true;
    cache.set(group, g);
  }
  return g;
}
