/**
 * `MixDonut` of step 10: a thick 3D ring cut into sectors (one mesh per sector, plant-type colours). `set(shares,
 * t)` blends the sector angles between the previous and the new mix (t = 0…1), rebuilding the extruded arcs —
 * cheap for ≤ 10 sectors. The ring lies in its local XY plane (facing +Z); sector 0 starts at 12 o'clock and runs
 * clockwise. A `mid(sector)` point (on the outer rim) anchors labels and rays.
 */
import { ExtrudeGeometry, Group, Mesh, Shape, Vector3 } from 'three';
import { K, col } from '@/style';
import { SECTORS, SECTOR_COLOR, type Sector } from '../mix-data';

export interface Donut {
  group: Group;
  meshes: Record<Sector, Mesh>;
  /** Current angles [start, end] per sector (radians, clockwise from 12 o'clock). */
  angles: Record<Sector, [number, number]>;
  set(from: Partial<Record<Sector, number>>, to: Partial<Record<Sector, number>>, t: number): void;
  mid(s: Sector, out?: Vector3): Vector3;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

function arc(r0: number, r1: number, a0: number, a1: number, depth: number): ExtrudeGeometry {
  const shape = new Shape();
  const n = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 72));
  const p = (r: number, a: number): [number, number] => [Math.sin(a) * r, Math.cos(a) * r];
  shape.moveTo(...p(r1, a0));
  for (let i = 1; i <= n; i++) shape.lineTo(...p(r1, a0 + ((a1 - a0) * i) / n));
  for (let i = n; i >= 0; i--) shape.lineTo(...p(r0, a0 + ((a1 - a0) * i) / n));
  const bevel = Math.min(0.5, depth * 0.2);
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function createDonut(radius: number, width: number, depth: number): Donut {
  const group = new Group();
  group.name = 'mix-donut';
  const meshes = {} as Record<Sector, Mesh>;
  const angles = {} as Record<Sector, [number, number]>;
  for (const s of SECTORS) {
    const tint = s === 'thermalUa' ? col('slate').lerp(col('steel'), 0.35) : SECTOR_COLOR[s];
    const m = new Mesh(arc(radius - width, radius, 0, 0.01, depth), K.toon({ color: tint, gloss: 0.55, rim: 0.8 }));
    m.castShadow = true;
    m.name = `sector-${s}`;
    group.add(m);
    meshes[s] = m;
    angles[s] = [0, 0];
  }
  const GAP = 0.025;
  return {
    group,
    meshes,
    angles,
    set(from, to, t) {
      const k = smooth(Math.min(1, Math.max(0, t)));
      const total = (x: Partial<Record<Sector, number>>): number => SECTORS.reduce((a, s) => a + (x[s] ?? 0), 0) || 1;
      const tf = total(from);
      const tt = total(to);
      let a = 0;
      for (const s of SECTORS) {
        const share = ((from[s] ?? 0) / tf) * (1 - k) + ((to[s] ?? 0) / tt) * k;
        const span = share * Math.PI * 2;
        const m = meshes[s];
        m.geometry.dispose();
        m.visible = span > GAP * 2;
        m.geometry = arc(radius - width, radius, a + GAP, a + Math.max(GAP * 2, span) - GAP, depth);
        angles[s] = [a, a + span];
        a += span;
      }
    },
    mid(s, out = new Vector3()) {
      const [a0, a1] = angles[s];
      const a = (a0 + a1) / 2;
      return group.localToWorld(out.set(Math.sin(a) * (radius + 2), Math.cos(a) * (radius + 2), 0));
    },
  };
}
