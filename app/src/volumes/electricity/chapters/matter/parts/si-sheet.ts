/**
 * `SiSheet` — the planar scheme of silicon (document: 10×8 atoms, double «sticks» per bond, two `cyan`
 * electrons per bond). It is a small carrier engine shared by steps 6 and 7: a bond electron can be torn out
 * (pair generation: a free electron + a `coral` hole left in the bond), a neighbouring bond electron can jump
 * into a hole (the hole "moves" the other way), a free electron that meets a hole falls back in (recombination).
 * The sheet lies in the local x-y plane, facing +z, centred on the origin. Field `field` > 0 points to +x:
 * free electrons drift to −x, holes to +x.
 */
import { CylinderGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlash, createOrbs, createSparks, type Orbs } from '@/fx';
import { K, type ColorLike } from '@/style';

export const COLS = 10;
export const ROWS = 8;
export const SPACING = 0.62;
const STICK = 0.055;
const MAX_FREE = 24;
const MAX_HOLES = 24;
const HOPPERS = 10;

export interface Slot {
  a: number;
  b: number;
  pos: Vector3;
  filled: boolean;
  /** Neighbouring slots (bonds that share an atom, and the twin slot). */
  near: number[];
}

export interface FreeElectron {
  pos: Vector3;
  vel: Vector3;
  age: number;
  /** Bound to a donor atom until released (step 7). */
  tether: number;
}

export interface Hop {
  from: Vector3;
  to: number;
  age: number;
  /** Electron falls into the slot after the hop (recombination flash). */
  recombine: boolean;
}

export interface SiSheet {
  group: Group;
  atoms: Orbs;
  atomPos: Vector3[];
  slots: Slot[];
  free: FreeElectron[];
  holes: number[];
  hops: Hop[];
  /** +1 = field to +x; 0 = none. */
  field: number;
  /** Seconds between autonomous hole hops (smaller = livelier). */
  holeStep: number;
  /** Free electrons seek a hole after this age (s) — mean life of a visual pair. */
  lifetime: number;
  /** Left/right limits of the free carriers (local x). */
  bounds: { x0: number; x1: number };
  /** Two halves (step 7): carriers never cross x = 0. */
  split: boolean;
  /** Per-atom scale (0 hides a silicon atom under a dopant). */
  atomScale: Float32Array;
  /** An empty bond without a free electron (acceptor). */
  makeHole(slot: number): void;
  /** Tear a bond electron out: a pair. Returns the slot or −1. */
  generate(slot?: number, flash?: boolean): number;
  /** Move hole `h` (index in `holes`) to a filled neighbour slot: that slot's electron jumps in. */
  hopHole(h: number, to: number): void;
  slotNear(local: Vector3, filter?: (s: number) => boolean): number;
  setAtomColor(i: number, color: ColorLike): void;
  /** 0…1: show the bonds and bond electrons (the flattening animation keeps them hidden). */
  bonds: number;
  /** The hole markers (pickable: drag a hole). */
  holeOrbs: Orbs;
  update(dt: number, t: number): void;
}

export const atomIndex = (c: number, r: number): number => r * COLS + c;

export function gridPos(c: number, r: number, out = new Vector3()): Vector3 {
  return out.set((c - (COLS - 1) / 2) * SPACING, (r - (ROWS - 1) / 2) * SPACING, 0);
}

function buildSlots(): Slot[] {
  const slots: Slot[] = [];
  const bond = (a: number, b: number, pa: Vector3, pb: Vector3): void => {
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    const d = pb.clone().sub(pa).normalize();
    const n = new Vector3(-d.y, d.x, 0).multiplyScalar(STICK);
    slots.push({ a, b, pos: mid.clone().add(n), filled: true, near: [] });
    slots.push({ a, b, pos: mid.clone().sub(n), filled: true, near: [] });
  };
  const pa = new Vector3();
  const pb = new Vector3();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1) bond(atomIndex(c, r), atomIndex(c + 1, r), gridPos(c, r, pa), gridPos(c + 1, r, pb));
      if (r < ROWS - 1) bond(atomIndex(c, r), atomIndex(c, r + 1), gridPos(c, r, pa), gridPos(c, r + 1, pb));
    }
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    for (let j = 0; j < slots.length; j++) {
      if (i === j) continue;
      const o = slots[j]!;
      if (o.a === s.a || o.a === s.b || o.b === s.a || o.b === s.b) s.near.push(j);
    }
  }
  return slots;
}

const HOP_S = 0.32;
const ease = (x: number): number => x * x * (3 - 2 * x);

export function createSiSheet(ctx: ChapterContext): SiSheet {
  const group = new Group();
  group.name = 'si-sheet';
  const atomPos = Array.from({ length: COLS * ROWS }, (_, i) => gridPos(i % COLS, Math.floor(i / COLS)));
  const atoms = createOrbs({
    kind: 'ion',
    color: 'slate',
    glyph: 'none',
    count: atomPos.length,
    radius: 0.17,
    instanceColors: true,
  });
  const slots = buildSlots();
  // bond sticks: one thin cylinder under every slot
  const stickGeo = new CylinderGeometry(0.022, 0.022, SPACING - 0.3, 8);
  const sticks = new InstancedMesh(stickGeo, K.toon({ color: 'mist', rim: 0.6 }), slots.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const dir = new Vector3();
  const one = new Vector3(1, 1, 1);
  const bondE = createOrbs({ kind: 'electron', count: slots.length, radius: 0.05 });
  // bond electrons stay quiet; the free carriers are the story
  bondE.intensity = 0.55;
  bondE.glow = 0.35;
  const freeE = createOrbs({ kind: 'electron', count: MAX_FREE, radius: 0.1 });
  const holeO = createOrbs({ kind: 'hole', count: MAX_HOLES, radius: 0.13 });
  const hopE = createOrbs({ kind: 'electron', count: HOPPERS, radius: 0.06 });
  const sparks = createSparks(ctx, { color: 'cyan', size: 0.04 });
  const glow = createFlash({ size: 0.9, color: 'orange' });
  group.add(sticks, atoms, bondE, freeE, holeO, hopE, sparks, glow);
  const p = new Vector3();
  // the sticks never move: one matrix per slot, offset from the bond axis like its electron
  slots.forEach((s, i) => {
    const pa = atomPos[s.a]!;
    const pb = atomPos[s.b]!;
    q.setFromUnitVectors(up, dir.copy(pb).sub(pa).normalize());
    m.compose(s.pos, q, one);
    sticks.setMatrixAt(i, m);
  });
  sticks.instanceMatrix.needsUpdate = true;

  const sheet: SiSheet = {
    group,
    atoms,
    atomPos,
    slots,
    free: [],
    holes: [],
    hops: [],
    field: 0,
    holeStep: 1.1,
    lifetime: 6,
    bonds: 1,
    holeOrbs: holeO,
    split: false,
    atomScale: new Float32Array(COLS * ROWS).fill(1),
    makeHole(slot) {
      if (!slots[slot]?.filled || sheet.holes.length >= MAX_HOLES) return;
      slots[slot]!.filled = false;
      sheet.holes.push(slot);
    },
    bounds: { x0: -(COLS / 2) * SPACING, x1: (COLS / 2) * SPACING },
    generate(slot, flash = true) {
      if (sheet.free.length >= MAX_FREE || sheet.holes.length >= MAX_HOLES) return -1;
      let s = slot ?? -1;
      if (s < 0) {
        for (let k = 0; k < 12 && s < 0; k++) {
          const c = Math.floor(ctx.random.next() * slots.length);
          const x = slots[c]!.pos.x;
          if (slots[c]!.filled && x > sheet.bounds.x0 && x < sheet.bounds.x1) s = c;
        }
      }
      if (s < 0 || !slots[s]!.filled) return -1;
      slots[s]!.filled = false;
      sheet.holes.push(s);
      const pos = slots[s]!.pos.clone().setZ(0.12);
      const ang = ctx.random.next() * Math.PI * 2;
      sheet.free.push({
        pos,
        vel: new Vector3(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(0.6),
        age: 0,
        tether: -1,
      });
      if (flash) sparks.burst(pos.toArray(), 10);
      return s;
    },
    hopHole(h, to) {
      const from = sheet.holes[h];
      if (from === undefined || !slots[to]?.filled || sheet.hops.length >= HOPPERS) return;
      slots[to]!.filled = false;
      sheet.holes[h] = to;
      sheet.hops.push({ from: slots[to]!.pos.clone(), to: from, age: 0, recombine: false });
    },
    slotNear(local, filter) {
      let best = -1;
      let d = Infinity;
      for (let i = 0; i < slots.length; i++) {
        if (filter && !filter(i)) continue;
        const e = slots[i]!.pos.distanceToSquared(p.set(local.x, local.y, 0));
        if (e < d) {
          d = e;
          best = i;
        }
      }
      return best;
    },
    setAtomColor(i, color) {
      atoms.setInstanceColor(i, color);
    },
    update(dt, t) {
      step(sheet, dt, ctx);
      for (let i = 0; i < atomPos.length; i++)
        atoms.setPosition(i, atomPos[i]!.x, atomPos[i]!.y, atomPos[i]!.z, sheet.atomScale[i]!);
      atoms.commit();
      const b = sheet.bonds;
      sticks.visible = b > 0.01;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]!;
        const jig = 0.01 * Math.sin(t * 6 + i);
        bondE.setPosition(i, s.pos.x + jig, s.pos.y - jig, 0.06, s.filled ? b : 0);
      }
      bondE.commit();
      for (let k = 0; k < MAX_FREE; k++) {
        const e = sheet.free[k];
        if (e) freeE.setPosition(k, e.pos.x, e.pos.y, e.pos.z, 1);
        else freeE.setPosition(k, 0, 0, 0, 0);
      }
      freeE.commit();
      for (let k = 0; k < MAX_HOLES; k++) {
        const h = sheet.holes[k];
        if (h !== undefined) holeO.setPosition(k, slots[h]!.pos.x, slots[h]!.pos.y, 0.08, 1);
        else holeO.setPosition(k, 0, 0, 0, 0);
      }
      holeO.commit();
      for (let k = 0; k < HOPPERS; k++) {
        const hp = sheet.hops[k];
        if (!hp) {
          hopE.setPosition(k, 0, 0, 0, 0);
          continue;
        }
        p.lerpVectors(hp.from, slots[hp.to]!.pos, ease(Math.min(hp.age / HOP_S, 1)));
        hopE.setPosition(k, p.x, p.y, 0.1, 1);
      }
      hopE.commit();
      // finished hops fill their slot; a recombination flashes
      for (let k = sheet.hops.length - 1; k >= 0; k--) {
        const hp = sheet.hops[k]!;
        hp.age += dt;
        if (hp.age < HOP_S) continue;
        slots[hp.to]!.filled = true;
        if (hp.recombine) {
          glow.position.copy(slots[hp.to]!.pos);
          glow.fire();
        }
        sheet.hops.splice(k, 1);
      }
    },
  };
  for (let i = 0; i < atomPos.length; i++) atoms.setInstanceColor(i, 'slate');
  return sheet;
}

const HALF_H = (ROWS / 2) * SPACING;
const SPEED = 0.6;

/** One frame of the carrier engine: free electrons wander and drift, holes hop, pairs meet and recombine. */
function step(sheet: SiSheet, dt: number, ctx: ChapterContext): void {
  // a frame without time (a re-render) must not draw random numbers: the walk stays a function of time only
  if (dt <= 0) return;
  const { slots, free, holes } = sheet;
  const rnd = (): number => ctx.random.next();
  for (let i = free.length - 1; i >= 0; i--) {
    const e = free[i]!;
    if (e.tether >= 0) {
      // the donor's fifth electron circles its atom loosely until it is released
      const a = sheet.atomPos[e.tether]!;
      e.age += dt;
      e.pos.set(a.x + 0.3 * Math.cos(e.age * 2.4), a.y + 0.3 * Math.sin(e.age * 2.4), 0.14);
      continue;
    }
    e.age += dt;
    const turn = (rnd() - 0.5) * 3 * dt * 4;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    e.vel.set(e.vel.x * c - e.vel.y * s, e.vel.x * s + e.vel.y * c, 0);
    if (e.age > sheet.lifetime && holes.length > 0) {
      // old pairs find each other: steer toward the nearest hole
      let best = holes[0]!;
      for (const h of holes)
        if (slots[h]!.pos.distanceToSquared(e.pos) < slots[best]!.pos.distanceToSquared(e.pos)) best = h;
      e.vel.lerp(
        slots[best]!.pos.clone().sub(e.pos).setZ(0).normalize().multiplyScalar(SPEED),
        Math.min(dt * 3, 1),
      );
    }
    e.vel.x -= sheet.field * 0.9 * dt;
    e.vel.setLength(SPEED);
    e.pos.addScaledVector(e.vel, dt);
    if (sheet.split && Math.sign(e.pos.x) !== Math.sign(e.pos.x - e.vel.x * dt)) {
      e.pos.x -= e.vel.x * dt;
      e.vel.x *= -1;
    }
    if (e.pos.x < sheet.bounds.x0 + 0.1 || e.pos.x > sheet.bounds.x1 - 0.1) {
      e.pos.x = Math.min(Math.max(e.pos.x, sheet.bounds.x0 + 0.1), sheet.bounds.x1 - 0.1);
      e.vel.x *= -1;
    }
    if (Math.abs(e.pos.y) > HALF_H - 0.1) {
      e.pos.y = Math.sign(e.pos.y) * (HALF_H - 0.1);
      e.vel.y *= -1;
    }
    if (e.age < 1) continue;
    for (let k = 0; k < holes.length; k++) {
      const slot = slots[holes[k]!]!;
      if (slot.pos.distanceToSquared(e.pos) < 0.09 && sheet.hops.length < HOPPERS) {
        sheet.hops.push({ from: e.pos.clone(), to: holes[k]!, age: 0, recombine: true });
        holes.splice(k, 1);
        free.splice(i, 1);
        break;
      }
    }
  }
  // holes hop: a filled neighbour slot gives its electron; with a field the hole prefers +x
  for (let h = 0; h < holes.length; h++) {
    if (rnd() > dt / sheet.holeStep) continue;
    const at = slots[holes[h]!]!;
    let best = -1;
    let score = -Infinity;
    for (const n of at.near) {
      const o = slots[n]!;
      if (!o.filled || o.pos.x < sheet.bounds.x0 || o.pos.x > sheet.bounds.x1) continue;
      if (sheet.split && Math.sign(o.pos.x) !== Math.sign(at.pos.x)) continue;
      const sc = rnd() + sheet.field * 1.5 * Math.sign(o.pos.x - at.pos.x);
      if (sc > score) {
        score = sc;
        best = n;
      }
    }
    if (best >= 0) sheet.hopHole(h, best);
  }
}
