/**
 * Nucleus — a tight cluster of proton / neutron characters (`@/fx` orbs, so they look like everywhere else in
 * the course). Parametric in Z and N: the nucleons occupy the innermost A slots of a relaxed sphere packing,
 * protons spread evenly among them. Nucleons ease to their slots, pop in / out, and "roll" a little all the
 * time (STYLE_GUIDE §1.3). Steps may displace single nucleons through `protonOffset[i]` / `neutronOffset[i]`.
 */
import { Group, Vector3 } from 'three';
import { damp, type Rng } from '@/engine/api';
import { createOrbs, type Orbs } from '@/fx';

export const NUCLEON_RADIUS = 0.5;
/** Centre distance of touching neighbours, in nucleon radii (slightly < 2: the toy spheres overlap a bit). */
export const SPACING = 1.86;
const _v = new Vector3();

export interface NucleusOptions {
  maxProtons: number;
  maxNeutrons: number;
  protons: number;
  neutrons: number;
}

interface Nucleon {
  slot: number;
  position: Vector3;
  scale: number;
  alive: boolean;
}

export class Nucleus {
  readonly group = new Group();
  readonly protons: Orbs;
  readonly neutrons: Orbs;
  /** Extra local displacement of each proton / neutron (dragging, bursts). */
  readonly protonOffset: Vector3[];
  readonly neutronOffset: Vector3[];
  /** 0…1 multiplier of every neutron's size (the «Прибрати нейтрони» demo). */
  neutronScale = 1;
  /** Amplitude of the idle rolling motion. */
  jiggle = 1;
  /** Radius of the cluster in local units for the current counts. */
  radius = NUCLEON_RADIUS;
  private readonly slots: Vector3[];
  private readonly p: Nucleon[];
  private readonly n: Nucleon[];
  private readonly centre = new Vector3();
  private readonly centreTarget = new Vector3();
  private z = 0;
  private nn = 0;

  constructor(rng: Rng, opts: NucleusOptions) {
    this.group.name = 'nucleus';
    this.slots = packSlots(rng, opts.maxProtons + opts.maxNeutrons);
    this.protons = createOrbs({ kind: 'proton', count: opts.maxProtons, radius: NUCLEON_RADIUS });
    this.neutrons = createOrbs({ kind: 'neutron', count: opts.maxNeutrons, radius: NUCLEON_RADIUS });
    const make = (count: number): Nucleon[] =>
      Array.from({ length: count }, () => ({ slot: 0, position: new Vector3(), scale: 0, alive: false }));
    this.p = make(opts.maxProtons);
    this.n = make(opts.maxNeutrons);
    this.protonOffset = this.p.map(() => new Vector3());
    this.neutronOffset = this.n.map(() => new Vector3());
    this.group.add(this.protons, this.neutrons);
    this.setCounts(opts.protons, opts.neutrons, true);
    this.update(0, 0);
  }

  get protonCount(): number {
    return this.z;
  }
  get neutronCount(): number {
    return this.nn;
  }

  /** Change the composition; nucleons re-seat with easing (or at once when `instant`). */
  setCounts(z: number, n: number, instant = false): void {
    this.z = Math.min(Math.max(Math.round(z), 0), this.p.length);
    this.nn = Math.min(Math.max(Math.round(n), 0), this.n.length);
    const a = this.z + this.nn;
    let ip = 0;
    let ineu = 0;
    this.centreTarget.set(0, 0, 0);
    let far = 0;
    for (let s = 0; s < a; s++) {
      // Bresenham spread: protons are distributed evenly over the occupied slots
      const isProton = Math.floor(((s + 1) * this.z) / a) > Math.floor((s * this.z) / a);
      const item = isProton ? this.p[ip++]! : this.n[ineu++]!;
      if (!item.alive && !instant) item.position.copy(this.slots[s]!).multiplyScalar(2.4); // fly in from outside
      item.slot = s;
      item.alive = true;
      this.centreTarget.add(this.slots[s]!);
      far = Math.max(far, this.slots[s]!.length());
    }
    if (a > 0) this.centreTarget.multiplyScalar(1 / a);
    this.radius = far + NUCLEON_RADIUS;
    for (let i = ip; i < this.p.length; i++) this.p[i]!.alive = false;
    for (let i = ineu; i < this.n.length; i++) this.n[i]!.alive = false;
    if (instant) {
      this.centre.copy(this.centreTarget);
      for (const item of [...this.p, ...this.n]) {
        item.scale = item.alive ? 1 : 0;
        item.position.copy(this.slots[item.slot]!);
      }
    }
  }

  /** Local position of proton / neutron `i` this frame (after `update`), offsets included. */
  local(kind: 'p' | 'n', i: number, out: Vector3): Vector3 {
    const item = (kind === 'p' ? this.p : this.n)[i]!;
    return out
      .copy(item.position)
      .sub(this.centre)
      .add((kind === 'p' ? this.protonOffset : this.neutronOffset)[i]!);
  }

  /** Rest position (slot) of proton / neutron `i`, local. */
  rest(kind: 'p' | 'n', i: number, out: Vector3): Vector3 {
    return out.copy(this.slots[(kind === 'p' ? this.p : this.n)[i]!.slot]!).sub(this.centre);
  }

  /** Index of the outermost proton / neutron as seen along `direction` (local space). */
  outermost(kind: 'p' | 'n', direction: Vector3): number {
    const items = kind === 'p' ? this.p : this.n;
    const count = kind === 'p' ? this.z : this.nn;
    let best = 0;
    let score = -Infinity;
    for (let i = 0; i < count; i++) {
      const d = this.slots[items[i]!.slot]!.dot(direction);
      if (d > score) {
        score = d;
        best = i;
      }
    }
    return best;
  }

  /**
   * Nearest other nucleon to a local point (the dragged proton `skip` is ignored): its rest position in `out`
   * and the centre distance in local units.
   */
  nearest(point: Vector3, skip: number, out: Vector3): number {
    let best = Infinity;
    const probe = (items: Nucleon[], count: number, isProton: boolean): void => {
      for (let i = 0; i < count; i++) {
        if (isProton && i === skip) continue;
        const d = _v.copy(this.slots[items[i]!.slot]!).sub(this.centre).distanceTo(point);
        if (d < best) {
          best = d;
          out.copy(_v);
        }
      }
    };
    probe(this.p, this.z, true);
    probe(this.n, this.nn, false);
    return best;
  }

  /** Touching neighbour pairs among the outer nucleons (rest positions), for the strong-force threads. */
  touchingPairs(limit: number): [Vector3, Vector3][] {
    const a = this.z + this.nn;
    const pairs: [Vector3, Vector3][] = [];
    for (let i = a - 1; i >= 0 && pairs.length < limit; i -= 2)
      for (let j = i - 1; j >= 0; j--)
        if (this.slots[i]!.distanceTo(this.slots[j]!) < NUCLEON_RADIUS * SPACING * 1.08) {
          pairs.push([this.slots[i]!.clone().sub(this.centre), this.slots[j]!.clone().sub(this.centre)]);
          break;
        }
    return pairs;
  }

  update(dt: number, t: number): void {
    this.centre.x = damp(this.centre.x, this.centreTarget.x, 5, dt);
    this.centre.y = damp(this.centre.y, this.centreTarget.y, 5, dt);
    this.centre.z = damp(this.centre.z, this.centreTarget.z, 5, dt);
    this.write(this.p, this.protons, this.protonOffset, 1, dt, t, 0);
    this.write(this.n, this.neutrons, this.neutronOffset, this.neutronScale, dt, t, 17);
  }

  private write(
    items: Nucleon[],
    orbs: Orbs,
    offsets: Vector3[],
    k: number,
    dt: number,
    t: number,
    seed: number,
  ): void {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const slot = this.slots[item.slot]!;
      const wobble = 1 + Math.sin(t * 1.7 + (item.slot + seed) * 2.1) * 0.035 * this.jiggle;
      item.position.x = damp(item.position.x, slot.x * wobble, 9, dt);
      item.position.y = damp(item.position.y, slot.y * wobble, 9, dt);
      item.position.z = damp(item.position.z, slot.z * wobble, 9, dt);
      item.scale = damp(item.scale, item.alive ? 1 : 0, item.alive ? 10 : 16, dt);
      const o = offsets[i]!;
      const breathe = 1 + Math.sin(t * 2.3 + (item.slot + seed) * 1.3) * 0.025 * this.jiggle;
      orbs.setPosition(
        i,
        item.position.x - this.centre.x + o.x,
        item.position.y - this.centre.y + o.y,
        item.position.z - this.centre.z + o.z,
        item.scale < 0.01 ? 0 : item.scale * breathe * k,
      );
    }
    orbs.commit();
  }
}

/** Relaxed sphere packing, sorted from the centre outward — any prefix of the list is a compact cluster. */
function packSlots(rng: Rng, count: number): Vector3[] {
  const pts: Vector3[] = [];
  const spread = NUCLEON_RADIUS * Math.cbrt(count) * 1.2;
  for (let i = 0; i < count; i++)
    pts.push(new Vector3(...rng.onSphere()).multiplyScalar(rng.range(0.2, spread)));
  const push = new Vector3();
  for (let iter = 0; iter < 220; iter++) {
    for (let i = 0; i < count; i++) {
      pts[i]!.multiplyScalar(0.985);
      for (let j = i + 1; j < count; j++) {
        push.subVectors(pts[i]!, pts[j]!);
        const d = push.length() || 1e-3;
        const overlap = NUCLEON_RADIUS * SPACING - d;
        if (overlap > 0) {
          push.multiplyScalar((overlap * 0.5) / d);
          pts[i]!.add(push);
          pts[j]!.sub(push);
        }
      }
    }
  }
  return pts.sort((a, b) => a.lengthSq() - b.lengthSq());
}
