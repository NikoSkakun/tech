/**
 * Fuel of the VVER-1000 at real size (metres) for the «powers of ten» exhibit of step 5: one UO₂ pellet
 * (Ø 7,6 mm × 10 mm, central hole), the hero fuel rod (glass cladding Ø 9,1 mm × 3,8 m with its pellet column,
 * spring and gas plenum), one hexagonal assembly (331 positions of a hex lattice, pitch 12,75 mm: 312 rods,
 * 18 guide tubes on ring 3, a central tube; spacer grids, nozzles) and the core (163 assemblies on a hex
 * lattice, pitch 23,6 cm). Instanced meshes with K materials; the exhibit (`fuel-zoom.ts`) scales and stages them.
 */
import { type BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, LatheGeometry, Matrix4, Object3D, Vector2, type Material } from 'three';
import { K, col } from '@/style';

export const PELLET = { r: 0.0038, h: 0.01, hole: 0.0007 } as const;
export const ROD = { r: 0.00455, length: 3.8, column: 3.53, pitch: 0.01275 } as const;
export const FA = { length: 4.57, flat: 0.234, pitch: 0.236, rings: 10 } as const;
export const CORE = { rings: 7, height: 3.53 } as const;

/** Hex lattice positions (x, z) of rings 0…n, ring by ring; `skipCorners` drops the 6 corners of the last ring. */
export function hexLattice(n: number, pitch: number, skipCorners = false): { x: number; z: number; ring: number }[] {
  const out: { x: number; z: number; ring: number }[] = [{ x: 0, z: 0, ring: 0 }];
  const dirs = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
  for (let k = 1; k <= n; k++) {
    let q = -k;
    let r = k; // start at the corner (-k, +k) and walk the six sides
    for (let side = 0; side < 6; side++)
      for (let s = 0; s < k; s++) {
        if (!(skipCorners && k === n && s === 0)) out.push({ x: pitch * (q + r / 2), z: pitch * ((Math.sqrt(3) / 2) * r), ring: k });
        q += dirs[side]![0];
        r += dirs[side]![1];
      }
  }
  return out;
}

export function pelletGeometry(): BufferGeometry {
  const { r, h, hole } = PELLET;
  const c = 0.0004; // chamfer
  const pts = [[hole, 0], [r - c, 0], [r, c], [r, h - c], [r - c, h], [hole, h], [hole, 0]].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(pts, 32);
}

const m4 = new Matrix4();
const dummy = new Object3D();

/** Instanced cylinders standing on y = 0 at the given (x, z). */
export function standing(geo: BufferGeometry, mat: Material, spots: readonly { x: number; z: number }[], y = 0): InstancedMesh {
  const mesh = new InstancedMesh(geo, mat, spots.length);
  spots.forEach((s, i) => {
    dummy.position.set(s.x, y, s.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export interface FuelModels {
  /** Hero pellet column (pellets of the hero rod), instanced. */
  pellets: InstancedMesh;
  /** The hero rod's cladding (glass), end plugs and spring. */
  heroRod: Group;
  /** The other 311 rods of the hero assembly + 18 guide tubes + central tube. */
  rods: InstancedMesh;
  guides: InstancedMesh;
  /** Spacer grids and nozzles of the hero assembly. */
  frame: Group;
  /** The other 162 assemblies of the core (hex prisms), instanced with colours. */
  assemblies: InstancedMesh;
  rodSpots: { x: number; z: number; ring: number }[];
  faSpots: { x: number; z: number; ring: number }[];
  /** Index of the hero rod in `rodSpots` (outer ring, nearest to +Z). */
  hero: number;
}

export function buildFuelModels(): FuelModels {
  const rodSpots = hexLattice(FA.rings, ROD.pitch);
  const hero = rodSpots.reduce((best, s, i) => (s.z > rodSpots[best]!.z + 1e-9 ? i : best), 0);
  const guideSpots = rodSpots.filter((s) => s.ring === 3 || s.ring === 0);
  const fuelSpots = rodSpots.filter((s, i) => s.ring !== 3 && s.ring !== 0 && i !== hero);
  const rods = standing(new CylinderGeometry(ROD.r, ROD.r, ROD.length, 10).translate(0, ROD.length / 2, 0), K.metal({ color: 'mist' }), fuelSpots);
  const guides = standing(new CylinderGeometry(0.0063, 0.0063, FA.length + 0.05, 12).translate(0, (FA.length + 0.05) / 2 - 0.25, 0), K.metal({ color: 'steel' }), guideSpots);
  // hero rod: pellet column + glass cladding + plugs + spring in the plenum
  const n = Math.round(ROD.column / PELLET.h);
  const pellets = new InstancedMesh(pelletGeometry(), K.toon({ color: 'slate', highlight: 0.5 }), n);
  const hs = rodSpots[hero]!;
  for (let i = 0; i < n; i++) {
    dummy.position.set(hs.x, 0.04 + i * PELLET.h, hs.z);
    dummy.updateMatrix();
    pellets.setMatrixAt(i, dummy.matrix);
  }
  pellets.instanceMatrix.needsUpdate = true;
  const heroRod = new Group();
  const clad = new InstancedMesh(new CylinderGeometry(ROD.r, ROD.r, ROD.length, 32, 1, true).translate(0, ROD.length / 2, 0), K.glass({ color: 'mist', opacity: 0.22, edgeOpacity: 0.7 }), 1);
  clad.setMatrixAt(0, m4.makeTranslation(hs.x, 0, hs.z));
  const plugs = standing(new CylinderGeometry(ROD.r * 1.02, ROD.r * 1.02, 0.03, 24), K.metal({ color: 'steel' }), [hs, hs]);
  plugs.setMatrixAt(1, m4.makeTranslation(hs.x, ROD.length - 0.015, hs.z));
  plugs.setMatrixAt(0, m4.makeTranslation(hs.x, 0.015, hs.z));
  const spring = new InstancedMesh(new CylinderGeometry(ROD.r * 0.7, ROD.r * 0.7, 0.18, 12, 6, true), K.metal({ color: 'steel.light' }), 1);
  spring.setMatrixAt(0, m4.makeTranslation(hs.x, 0.04 + ROD.column + 0.11, hs.z));
  heroRod.add(clad, plugs, spring);
  // spacer grids (thin hex rings) and the two nozzles of the hero assembly
  const frame = new Group();
  const ringGeo = new CylinderGeometry(FA.flat / Math.sqrt(3), FA.flat / Math.sqrt(3), 0.02, 6, 1, true).rotateY(Math.PI / 6);
  const grids = standing(ringGeo, K.metal({ color: 'steel.light' }), Array.from({ length: 13 }, () => ({ x: 0, z: 0 })));
  for (let i = 0; i < 13; i++) grids.setMatrixAt(i, m4.makeTranslation(0, 0.25 + i * 0.27, 0));
  const nozzleGeo = new CylinderGeometry(FA.flat / Math.sqrt(3), FA.flat / Math.sqrt(3), 0.22, 6).rotateY(Math.PI / 6);
  const nozzles = standing(nozzleGeo, K.metal({ color: 'slate.light' }), [{ x: 0, z: 0 }, { x: 0, z: 0 }]);
  nozzles.setMatrixAt(0, m4.makeTranslation(0, -0.15, 0));
  nozzles.setMatrixAt(1, m4.makeTranslation(0, FA.length - 0.2, 0));
  frame.add(grids, nozzles);
  // the core: the other 162 assemblies as hex prisms with a top face that can show the «age» colour
  const faSpots = hexLattice(CORE.rings, FA.pitch, true);
  const prism = new CylinderGeometry(FA.flat / Math.sqrt(3), FA.flat / Math.sqrt(3), FA.length, 6).rotateY(Math.PI / 6).translate(0, FA.length / 2 - 0.25, 0);
  const assemblies = standing(prism, K.toon({ color: 'white' }), faSpots.slice(1));
  const c = new Color();
  for (let i = 0; i < faSpots.length - 1; i++) assemblies.setColorAt(i, c.copy(col('steel.light')));
  return { pellets, heroRod, rods, guides, frame, assemblies, rodSpots, faSpots, hero };
}

