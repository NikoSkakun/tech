/**
 * `GapCell` of step 4: two round metal electrode tablets with a 1 mm gap (drawn 1,5 units — not to scale) filled
 * with the chosen insulator. Inside: bound electrons beside their molecules that only lean toward «+» in the field
 * (polarisation), `amber` field lines whose number grows with E, avalanche chains of `cyan` flashes near the
 * threshold, a `violet`-white spark at breakdown and, in solids, a charred track that stays.
 * Local frame: gap centre at the origin, «−» electrode on the left (x < 0), «+» on the right; E points to −x.
 */
import { Group, Mesh, Vector3, type BufferGeometry } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createArc, createFlash, createOrbs, createSparks, RibbonLines } from '@/fx';
import { Builder, G } from '@/kit';
import { K, SEMANTIC, type ColorToken } from '@/style';
import type { InsulatorId } from '@electricity/sim/matter';

export const GAP = 1.5;
const R = 1.05;
const H = 1.9;
const MOL = 24;
const LINES = 25;

const LOOK: Record<InsulatorId, { color: ColorToken; opacity: number } | null> = {
  air: null,
  oil: { color: 'amber', opacity: 0.42 },
  glass: { color: 'sky', opacity: 0.22 },
  pvc: { color: 'mist', opacity: 0.4 },
  ptfe: { color: 'white', opacity: 0.55 },
  mica: { color: 'amber.light', opacity: 0.35 },
};

export interface GapCell {
  group: Group;
  /** E/E_b (≥ 0): field-line density and polarisation. */
  ratio: number;
  setMaterial(id: InsulatorId): void;
  /** One avalanche chain (3…8 flashes) from the «−» side. */
  avalanche(length: number): void;
  /** The spark of a breakdown. */
  strike(): void;
  /** Charred track (solids): shown / hidden; a new seed draws a new path. */
  setBurn(on: boolean, seed?: number): void;
  /** Local anchors. */
  molecule: Vector3;
  track: Vector3;
  update(dt: number, t: number): void;
}

export function createGapCell(ctx: ChapterContext): GapCell {
  const group = new Group();
  group.name = 'gap-cell';
  const b = new Builder('electrodes');
  for (const s of [-1, 1]) {
    const x = s * (GAP / 2);
    // tablet (axis x) with a rounded rim, a stem and a terminal cap in the pole colour
    b.cyl(R, 0.3, {
      seg: 64,
      slot: 'metal',
      c: ['steel', 'mist'],
      axis: 'x',
      at: [s < 0 ? x - 0.3 : x, 0, 0],
    });
    b.cyl(0.16, 1.1, {
      seg: 24,
      slot: 'metal',
      c: 'steel',
      axis: 'x',
      at: [s < 0 ? x - 1.4 : x + 0.3, 0, 0],
    });
    b.cyl(0.32, 0.36, {
      seg: 32,
      slot: 'gloss',
      c: s < 0 ? SEMANTIC.dcMinus : SEMANTIC.dcPlus,
      axis: 'x',
      at: [s < 0 ? x - 1.76 : x + 1.4, 0, 0],
    });
    b.ring(R * 0.82, 0.02, {
      seg: 64,
      slot: 'glow',
      c: 'teal',
      axis: 'x',
      at: [s < 0 ? x - 0.31 : x + 0.31, 0, 0],
    });
  }
  // insulating stand under the cell
  b.box(4.6, 0.16, 1.2, { r: 0.07, c: ['bg.deep', 'bg.indigo'], at: [0, -R - 0.55, 0] });
  for (const s of [-1, 1]) b.cyl(0.09, 0.45, { seg: 16, c: 'slate', at: [s * 1.6, -R - 0.42, 0] });
  group.add(b.build().group);

  const slab = new Mesh(
    G.rbox(GAP - 0.04, H, H, 0.1, 2),
    K.glass({ color: 'sky', opacity: 0.3, edgeOpacity: 0.7 }),
  );
  slab.renderOrder = 2;
  const atoms = createOrbs({ kind: 'neutron', count: MOL * 2, radius: 0.065 });
  const bound = createOrbs({ kind: 'electron', count: MOL, radius: 0.045 });
  const lines = new RibbonLines({
    capacity: LINES * 2 + 4,
    color: SEMANTIC.fieldE,
    width: 0.03,
    dashStrength: 0.6,
    dashSpeed: -0.8,
    intensity: 1.1,
  });
  const sparks = createSparks(ctx, { color: 'cyan', size: 0.05 });
  const free = createOrbs({ kind: 'electron', count: 8, radius: 0.05 });
  const arc = createArc({
    from: [-GAP / 2, 0, 0],
    to: [GAP / 2, 0, 0],
    branches: 2,
    continuous: false,
    color: 'violet.light',
  });
  const flash = createFlash({ size: 2.2, color: 'violet.light' });
  const burnMat = K.toon({ color: 'ink', rim: 0.3 });
  const burn = new Mesh(G.box(0.01, 0.01, 0.01), burnMat);
  burn.visible = false;
  group.add(slab, atoms, bound, lines, sparks, free, arc, flash, burn);
  return wire(group, slab, atoms, bound, lines, sparks, free, arc, flash, burn);
}

interface Chain {
  points: Vector3[];
  age: number;
}

const STEP_S = 0.07;

function wire(
  group: Group,
  slab: Mesh,
  atoms: ReturnType<typeof createOrbs>,
  bound: ReturnType<typeof createOrbs>,
  lines: RibbonLines,
  sparks: ReturnType<typeof createSparks>,
  free: ReturnType<typeof createOrbs>,
  arc: ReturnType<typeof createArc>,
  flash: ReturnType<typeof createFlash>,
  burn: Mesh,
): GapCell {
  let material: InsulatorId = 'air';
  let seedN = 1;
  const rnd = (): number => {
    const s = Math.sin(seedN++ * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };
  // molecules: fixed sites in solids, drifting in air / oil
  const homes = Array.from({ length: MOL }, (_, i) => {
    const s = Math.sin(i * 78.233) * 43758.5453;
    const f = (k: number): number => {
      const v = Math.sin(i * 12.9898 + k * 4.1414) * 43758.5453;
      return v - Math.floor(v);
    };
    void s;
    return new Vector3((f(1) - 0.5) * (GAP - 0.35), (f(2) - 0.5) * (H - 0.4), (f(3) - 0.5) * (H - 0.4));
  });
  const axes = homes.map((_, i) =>
    new Vector3(Math.cos(i * 2.4), Math.sin(i * 1.7), Math.sin(i * 3.1)).normalize(),
  );
  const fieldLines = Array.from({ length: LINES }, (_, i) => {
    const y = ((i % 5) / 4 - 0.5) * (H - 0.5);
    const z = (Math.floor(i / 5) / 4 - 0.5) * (H - 0.5);
    return { points: [new Vector3(GAP / 2 - 0.02, y, z), new Vector3(-GAP / 2 + 0.02, y, z)] };
  });
  // order the lines so that the first ones are spread over the whole face
  const order = [12, 0, 4, 20, 24, 2, 10, 14, 22, 6, 8, 16, 18, 1, 3, 5, 9, 15, 19, 21, 23, 7, 11, 13, 17];
  const chains: Chain[] = [];
  let shownLines = -1;
  const p = new Vector3();

  const cell: GapCell = {
    group,
    ratio: 0,
    molecule: homes[3]!.clone(),
    track: new Vector3(),
    setMaterial(id) {
      material = id;
      const look = LOOK[id];
      slab.visible = look !== null;
      if (look) {
        const m = slab.material as ReturnType<typeof K.glass>;
        m.dispose();
        slab.material = K.glass({ color: look.color, opacity: look.opacity, edgeOpacity: 0.75 });
      }
      chains.length = 0;
    },
    avalanche(length) {
      if (chains.length >= 4) return;
      const start = new Vector3(-GAP / 2 + 0.08, (rnd() - 0.5) * (H - 0.6), (rnd() - 0.5) * (H - 0.6));
      const points = [start];
      for (let k = 1; k < length; k++) {
        const last = points[k - 1]!;
        points.push(
          new Vector3(
            last.x + (GAP - 0.16) / (length - 1),
            last.y + (rnd() - 0.5) * 0.3,
            last.z + (rnd() - 0.5) * 0.3,
          ),
        );
      }
      chains.push({ points, age: 0 });
    },
    strike() {
      const y = (rnd() - 0.5) * 0.6;
      arc.from.set(-GAP / 2, y, (rnd() - 0.5) * 0.4);
      arc.to.set(GAP / 2, y + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4);
      arc.strike(0.4);
      flash.fire();
      sparks.burst([0, y, 0], 30);
    },
    setBurn(on, seed) {
      burn.visible = on;
      if (!on) return;
      if (seed !== undefined) seedN = seed;
      const pts: Vector3[] = [];
      const y0 = (rnd() - 0.5) * 0.7;
      for (let k = 0; k <= 8; k++)
        pts.push(new Vector3(-GAP / 2 + (GAP * k) / 8, y0 + (rnd() - 0.5) * 0.28, (rnd() - 0.5) * 0.28));
      const old: BufferGeometry = burn.geometry;
      burn.geometry = G.tube(pts, 0.035, { seg: 6 });
      old.dispose();
      cell.track.copy(pts[4]!);
    },
    update(dt, t) {
      const r = Math.min(cell.ratio, 1.2);
      // field lines: 3 … 25 with log(E); dashes run from «+» to «−»
      const n = Math.round(3 + 22 * Math.min(r, 1));
      if (n !== shownLines) {
        shownLines = n;
        lines.setLines(order.slice(0, n).map((k) => fieldLines[k]!));
      }
      lines.dashSpeed = -(0.4 + 1.6 * r);
      // molecules: two atoms; the bound electron leans toward «+» (polarisation, exaggerated)
      const moving = material === 'air' || material === 'oil';
      for (let i = 0; i < MOL; i++) {
        const h = homes[i]!;
        p.copy(h);
        if (moving) {
          p.x += 0.1 * Math.sin(t * 0.5 + i);
          p.y += 0.12 * Math.sin(t * 0.37 + i * 2);
          p.z += 0.1 * Math.cos(t * 0.44 + i);
        }
        const ax = axes[i]!;
        const spin = moving ? t * 0.6 + i : 0;
        const c = Math.cos(spin);
        const s = Math.sin(spin);
        const dx = (ax.x * c - ax.z * s) * 0.07;
        const dz = (ax.x * s + ax.z * c) * 0.07;
        atoms.setPosition(2 * i, p.x + dx, p.y + ax.y * 0.07, p.z + dz);
        atoms.setPosition(2 * i + 1, p.x - dx, p.y - ax.y * 0.07, p.z - dz);
        bound.setPosition(i, p.x + 0.04 + 0.12 * r, p.y + 0.11 + 0.02 * Math.sin(t * 5 + i), p.z);
        if (i === 3) cell.molecule.copy(p);
      }
      atoms.commit();
      bound.commit();
      // avalanche chains: a flash at every step, the newest electron racing toward «+»
      for (let k = chains.length - 1; k >= 0; k--) {
        const c = chains[k]!;
        const before = Math.floor(c.age / STEP_S);
        c.age += dt;
        const now = Math.floor(c.age / STEP_S);
        if (now !== before && now < c.points.length) sparks.burst(c.points[now]!.toArray(), 3 + now);
        if (now >= c.points.length + 3) chains.splice(k, 1);
      }
      for (let k = 0; k < 8; k++) {
        const c = chains[k >> 1];
        if (!c) {
          free.setPosition(k, 0, 0, 0, 0);
          continue;
        }
        const f = Math.min(c.age / (STEP_S * (c.points.length - 1)), 1);
        const idx = Math.min(Math.floor(f * (c.points.length - 1)), c.points.length - 2);
        const local = f * (c.points.length - 1) - idx;
        p.lerpVectors(c.points[idx]!, c.points[idx + 1]!, local);
        p.y += (k & 1) * 0.12;
        free.setPosition(k, p.x, p.y, p.z, f < 1 ? 1 : 0);
      }
      free.commit();
    },
  };
  cell.setMaterial('air');
  return cell;
}
