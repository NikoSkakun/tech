/**
 * Micro-world of step 3 (≈ 10⁻⁹ m, not to scale): a stack of graphene sheets (the anode host), a layered
 * oxide crystal (the cathode host) and the separator between them. X runs anode (−) → cathode (+); ions
 * travel in the galleries between the layers.
 */
import { type Group, Mesh, OctahedronGeometry, Vector3 } from 'three';
import { Builder } from '@/kit';
import { K, col } from '@/style';
import { group } from '../world';

/** Shared layout of the micro-world. */
export const MICRO = {
  /** Electrode faces toward the electrolyte, and their far ends (current collectors). */
  anode: { face: -1.65, back: -4.05 },
  cathode: { face: 1.65, back: 4.05 },
  halfDepth: 1.15,
  /** Graphene sheets: y of the lowest one and the spacing when empty of lithium (0,335 nm in reality). */
  graphite: { y0: 0.55, spacing: 0.56, sheets: 5 },
  /** Oxide slabs. */
  oxide: { y0: 0.5, spacing: 0.78, slabs: 4 },
} as const;

export interface Graphite {
  group: Group;
  /** Lithiation 0…1: the sheets move apart by ≈ 10 % (LiC₆). */
  setLithiation(x: number): void;
  /** y of gallery j (between sheet j and j + 1) at the current lithiation. */
  galleryY(j: number): number;
}

/** A stack of honeycomb sheets. One merged sheet geometry, five meshes. */
export function createGraphite(): Graphite {
  const { anode, halfDepth, graphite } = MICRO;
  const a = 0.21; // C–C bond length in scene units
  const b = new Builder('graphene');
  const c = col('slate').lerp(col('steel'), 0.35);
  const bond = col('slate').lerp(col('ink'), 0.3);
  const dx = a * Math.sqrt(3);
  const inside = (p: Vector3): boolean =>
    p.x <= anode.face + 1e-3 && p.x >= anode.back - 1e-3 && Math.abs(p.z) <= halfDepth + 1e-3;
  // honeycomb = two interleaved triangular lattices A and B; every A atom has three B neighbours
  for (let i = -1; i < (anode.face - anode.back) / dx + 1; i++) {
    for (let j = -1; j < (2 * halfDepth) / (1.5 * a) + 1; j++) {
      const ax = anode.back + (i + (j % 2 ? 0.5 : 0)) * dx;
      const az = -halfDepth + j * 1.5 * a;
      const A = new Vector3(ax, 0, az);
      if (inside(A)) b.sphere(0.058, { at: [A.x, 0, A.z], seg: 8, c });
      for (const [ox, oz] of [
        [0, a],
        [dx / 2, -a / 2],
        [-dx / 2, -a / 2],
      ] as const) {
        const B = new Vector3(ax + ox, 0, az + oz);
        if (!inside(B)) continue;
        if (ox === 0) b.sphere(0.058, { at: [B.x, 0, B.z], seg: 8, c });
        if (inside(A)) b.rod([A.x, 0, A.z], [B.x, 0, B.z], 0.022, { seg: 5, c: bond });
      }
    }
  }
  const geometry = b.geometry('toon');
  const material = K.toon({ color: 'white', vertexColors: true, rim: 1.3, gloss: 0.3 });
  const g = group('graphite');
  const sheets = Array.from({ length: graphite.sheets }, () => {
    const m = new Mesh(geometry, material);
    m.castShadow = true;
    g.add(m);
    return m;
  });
  let spacing: number = graphite.spacing;
  const api: Graphite = {
    group: g,
    setLithiation(x) {
      spacing = graphite.spacing * (1 + 0.1 * Math.min(Math.max(x, 0), 1));
      sheets.forEach((m, i) => (m.position.y = graphite.y0 + i * spacing));
    },
    galleryY: (j) => graphite.y0 + (j + 0.5) * spacing,
  };
  api.setLithiation(0);
  return api;
}

/** Layered oxide (LCO / NMC type): slabs of edge-sharing octahedra (`violet`) with metal atoms (`blue`). */
export function createOxide(): { group: Group; galleryY(j: number): number } {
  const { cathode, halfDepth, oxide } = MICRO;
  const b = new Builder('oxide');
  const octa = new OctahedronGeometry(0.235, 0);
  const pitch = 0.37;
  for (let s = 0; s < oxide.slabs; s++) {
    const y = oxide.y0 + s * oxide.spacing;
    for (let i = 0; i * pitch <= cathode.back - cathode.face; i++) {
      for (let j = 0; j * pitch * 0.9 <= 2 * halfDepth; j++) {
        const x = cathode.face + i * pitch + (j % 2 ? pitch / 2 : 0);
        if (x > cathode.back) continue;
        const z = -halfDepth + j * pitch * 0.9;
        b.add(octa, {
          at: [x, y, z],
          rot: [0, Math.PI / 4, 0],
          slot: 'facet',
          c: s % 2 ? 'violet' : 'violet.light',
        });
        b.sphere(0.07, { at: [x, y + 0.2, z], seg: 8, slot: 'gloss', c: 'blue' });
      }
    }
  }
  const model = b.build();
  model.group.name = 'oxide';
  return { group: model.group, galleryY: (j) => oxide.y0 + (j + 0.5) * oxide.spacing + 0.06 };
}

/** Separator: a porous polymer "fence" in the YZ plane at x = 0 with square pores the ions slip through. */
export function createFence(): { group: Group; pore(i: number): Vector3 } {
  const b = new Builder('fence');
  const h = MICRO.halfDepth + 0.15;
  const pitch = 0.46;
  const ys: number[] = [];
  for (let y = 0.3; y <= 3.3; y += pitch) ys.push(y);
  const zs: number[] = [];
  for (let z = -h; z <= h + 1e-3; z += pitch) zs.push(z);
  for (const y of ys) b.rod([0, y, -h], [0, y, h], 0.055, { seg: 8, c: 'white' });
  for (const z of zs) b.rod([0, ys[0]!, z], [0, ys[ys.length - 1]!, z], 0.055, { seg: 8, c: 'mist' });
  const model = b.build();
  model.group.name = 'fence';
  const rows = ys.length - 1;
  const cols = zs.length - 1;
  return {
    group: model.group,
    // pore centres, visited in a scattered order so neighbouring ions take different pores
    pore: (i) => {
      const k = (i * 7 + 3) % (rows * cols);
      return new Vector3(0, ys[k % rows]! + pitch / 2, zs[Math.floor(k / rows)]! + pitch / 2);
    },
  };
}
