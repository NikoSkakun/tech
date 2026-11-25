/**
 * The atoms floor (VISUAL.md §4.3 «Атоми», PATH `inside/atoms`, `inside/give`): the edge of one zinc grain as rows of
 * grey atoms, free electrons darting between them, and the event the chapter is about — an atom on the edge trembles,
 * leaves its two electrons in the grain and swims off into the lye as a zinc ion (`coral` ring). Each event is a pure
 * function of its own clock; `give(i)` starts one.
 */
import { type Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { K } from '@/style';
import { seeded } from '@circuit/shared/stage/battery-grains';
import { EDGE, edgeAtoms } from './layout';
import { electrons, zincIons } from './particles';
import { smooth } from '../scrub';

export const ATOM_R = 0.068;
const SWARM = 46;
const MAX_EVENTS = 14;
/** Seconds of one «give». */
export const GIVE_SECONDS = 2.2;

export interface Atoms {
  /** 0 … 1 shown. */
  shown: number;
  /** Indices of atoms on the front layer (the ones that can leave). */
  readonly front: readonly number[];
  /** The front atom nearest to a point (micro units, in the field's frame), or −1. */
  nearest(point: Vector3, within?: number): number;
  /** An atom leaves: false if it is gone already or too many are leaving. */
  give(i: number): boolean;
  /** Atoms that have left (events finished or running). */
  readonly given: number;
  /** Put every atom back (step entry). */
  reset(): void;
  atomAt(i: number, out: Vector3): Vector3;
  /** Where the newest zinc ion is now (micro). */
  readonly lastIon: Vector3;
  update(dt: number, t: number): void;
}

export function createAtoms(parent: Group): Atoms {
  const sites = edgeAtoms(ATOM_R * 2.15);
  const mesh = new InstancedMesh(
    new IcosahedronGeometry(1, 3),
    K.toon({ color: 'steel', emissive: 'mist', emissiveIntensity: 0.35, highlight: 0.8, gloss: 0.4 }),
    sites.length,
  );
  mesh.frustumCulled = false;
  parent.add(mesh);
  const swarm = electrons(parent, SWARM, 0.022);
  const freed = electrons(parent, MAX_EVENTS * 2, 0.026);
  const ions = zincIons(parent, MAX_EVENTS, ATOM_R);
  const front = sites.map((s, i) => (s.layer === 0 ? i : -1)).filter((i) => i >= 0);
  const rnd = seeded(505);
  const paths = Array.from({ length: SWARM }, () => ({
    ax: rnd() * 6.28,
    ay: rnd() * 6.28,
    az: rnd() * 6.28,
    fx: 0.5 + rnd() * 0.8,
    fy: 0.4 + rnd() * 0.9,
    fz: 0.5 + rnd() * 0.7,
  }));
  const events: { atom: number; t0: number; dy: number; dz: number }[] = [];
  const gone = new Set<number>();
  let clock = 0;
  const lastIon = new Vector3();
  const m4 = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const sc = new Vector3();

  const atoms: Atoms = {
    shown: 0,
    front,
    nearest(point, within = ATOM_R * 3) {
      let best = -1;
      let bd = within;
      for (const i of front) {
        if (gone.has(i)) continue;
        const s = sites[i]!;
        const d = Math.hypot(s.x - point.x, s.y - point.y, s.z - point.z);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    },
    give(i) {
      if (i < 0 || gone.has(i) || events.length >= MAX_EVENTS) return false;
      gone.add(i);
      events.push({ atom: i, t0: clock, dy: (rnd() - 0.5) * 0.5, dz: (rnd() - 0.5) * 0.15 });
      return true;
    },
    get given() {
      return events.length;
    },
    reset() {
      events.length = 0;
      gone.clear();
    },
    lastIon,
    atomAt(i, out) {
      const s = sites[i]!;
      return out.set(s.x, s.y, s.z);
    },
    update(dt, t) {
      clock += dt;
      const k = atoms.shown;
      mesh.visible = k > 0.01;
      // the lattice: every atom trembles a little; those that left are gone from their places
      sites.forEach((s, i) => {
        const w = gone.has(i) ? 0 : 1;
        const j = 0.006 * Math.sin(t * 7 + i * 1.7);
        mesh.setMatrixAt(i, m4.compose(p.set(s.x + j, s.y, s.z), q, sc.setScalar(ATOM_R * k * w)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      // the free electrons dart between the atoms, inside the grain's top layers (more of them as atoms leave)
      const extra = Math.min(events.length * 2, SWARM - 30);
      paths.forEach((a, i) => {
        const on = i < 30 + extra ? k : 0;
        const x = EDGE.x - 0.12 - 0.1 * (1 + Math.sin(t * a.fx + a.ax));
        const y = EDGE.y + 0.75 * Math.sin(t * a.fy * 0.7 + a.ay);
        // in the top layer facing the camera, where they show between the atoms
        const z = EDGE.z + 0.72 + 0.12 * Math.sin(t * a.fz * 0.6 + a.az);
        const inside = ((y - EDGE.y) / 1.35) ** 2 + ((z - EDGE.z) / 0.95) ** 2 < 1 ? 1 : 0;
        swarm.put(i, x, y, z, on * inside);
      });
      swarm.commit();
      // the events: tremble 0–0.5 s, two electrons dive into the grain 0.5–1.2 s, the ion swims off 0.8–2.2 s
      for (let e = 0; e < MAX_EVENTS; e++) {
        const ev = events[e];
        if (!ev) {
          freed.put(e * 2, 0, 0, 0, 0);
          freed.put(e * 2 + 1, 0, 0, 0, 0);
          ions.put(e, 0, 0, 0, 0);
          continue;
        }
        const s = sites[ev.atom]!;
        const age = clock - ev.t0;
        const shake = age < 0.6 ? 0.02 * Math.sin(age * 60) * smooth(0, 0.15, age) : 0;
        const go = smooth(0.8, GIVE_SECONDS, age);
        const ionX = s.x + shake + go * 1.1 + Math.max(0, age - GIVE_SECONDS) * 0.03;
        if (e === events.length - 1) lastIon.set(ionX, s.y + go * ev.dy, s.z + go * ev.dz);
        ions.put(e, ionX, s.y + go * ev.dy, s.z + go * ev.dz, k);
        for (let j = 0; j < 2; j++) {
          const d = smooth(0.45, 1.25, age);
          const ex = s.x - d * (0.25 + 0.1 * j);
          const ey = s.y + (j ? 1 : -1) * (0.05 + d * 0.12);
          const show = age < 0.45 ? 0 : age < 1.6 ? 1 : 1 - smooth(1.6, 2, age);
          freed.put(e * 2 + j, ex, ey, s.z + 0.04, k * show);
        }
      }
      freed.commit();
      ions.commit();
    },
  };
  return atoms;
}
