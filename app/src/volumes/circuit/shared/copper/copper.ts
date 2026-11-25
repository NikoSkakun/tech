/**
 * «Усередині міді» — the lower floors of the volume `circuit` as one object a chapter mounts (README.md).
 * Everything is a parameter; nothing here knows about steps. Write the parameters (from `stage.param`
 * callbacks, controls, drags), call `update(dt, t)` once per frame.
 */
import { Group, Matrix4, Quaternion, type Ray, type Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createAtom, type Atom } from './atom';
import { createBackdrop, type Backdrop } from './backdrop';
import { createCore, type Core } from './core';
import { siteIndex } from './electron-rules';
import { createElectronSim, FOCUS_COUNT, type ElectronSim } from './electron-sim';
import { createElectronView, type ElectronView } from './electrons';
import { createGate, type Gate } from './gate';
import { createLattice, type Lattice } from './lattice';
import { COPPER_TOP, CORE_STAGES, smooth } from './layout';
import { createLensRim, type LensRim } from './lens-rim';
import { createPlastic, type Plastic } from './plastic';

/** How much the picture grows between the floors «ряди атомів» (depth 1) and «один атом» (depth 2). */
export const ATOM_ZOOM = 2.35;

/** Scale of the lattice on the way down from the wire core (depth 0 … 1): log-linear between these stops. */
const DIVE: readonly (readonly [number, number])[] = [
  [0, 0.03],
  [0.7, 0.62],
  [1, 1],
];
/** Share of the dome's light that passes the three veils at full strength (each lets 40 % through). */
const VEILS_THROUGH = 0.064;
/** Depths over which the veils leave on the way into one atom. */
const VEILS_LEAVE = [1.06, 1.5] as const;
function diveScale(depth: number): number {
  const d = Math.max(depth, 0);
  for (let i = 1; i < DIVE.length; i++) {
    const [d1, s1] = DIVE[i]!;
    const [d0, s0] = DIVE[i - 1]!;
    if (d <= d1) return s0 * Math.pow(s1 / s0, (d - d0) / (d1 - d0));
  }
  return 1;
}

export interface Copper {
  /** Mount this group; uniform scale only. Its origin is the hero atom, X the wire axis, +Z toward the reader. */
  group: Group;
  /** Everything that scales with `depth` (the dive zooms the world, the camera keeps its place). */
  space: Group;
  lattice: Lattice;
  sim: ElectronSim;
  electrons: ElectronView;
  atom: Atom;
  plastic: Plastic;
  gate: Gate;
  backdrop: Backdrop;
  core: Core;
  /** The rim of the magnifier in the corners of the frame (screen space); see lens-rim.ts. */
  rim: LensRim;
  /** Where the reader is: 0 = «жила дроту» (hand-over from the stand), 1 = «ряди атомів», 2 = «один атом». */
  depth: number;
  /** The state of the circuit, as it reaches down here: 0 = open (cool, dim) … 1 = lamp on (warm from above). */
  lamp: number;
  /** How many atoms there are, in `Site.rank` order: 1 a lone atom, 2 a pair, 5 a row, 15 a piece; the
   *  default (`Infinity`) is the whole crystal. Electrons come with their atoms (`wire/shared`). */
  atoms: number;
  /** Seconds a big change of `atoms` takes (a piece growing into the whole crystal, inside out). Default 1.1;
   *  0 = at once. Small changes keep their pace of about 40 atoms a second. */
  growSeconds: number;
  /**
   * The atom the dive below «ряди» opens: a site of the focal plane (`lattice.siteAt`, `lattice.selected`),
   * default 0 — the atom at the origin. Set it on the rows floor (depth ≤ 1): nothing moves there, and on the
   * way to depth 2 the world slides so that this atom arrives where every shot looks. The free electrons stay
   * where they are.
   */
  hero: number;
  /** World position of the hero atom now (for a camera target or a label). */
  heroPosition(out: Vector3): Vector3;
  /** The point of the focal plane the camera looks at (local XY): the crowd of electrons keeps around it. */
  look: { x: number; y: number };
  /** Mark one focus electron (white ring, long trail; the crowd dims), −1 = none (`wire/restless`). */
  marked: number;
  /** Mark the focus electron nearest to a point of the focal plane (default: where the camera looks). */
  markNearest(x?: number, y?: number): number;
  /** A world-space point (a pointer hit) in the units of `lattice`, `atom`, `sim` — in place. */
  toLocal(point: Vector3): Vector3;
  /** A world-space pick ray in the same units (for `atom.nearest`). */
  localRay(ray: Ray, out: Ray): Ray;
  /** Forget motion history after a jump of state (deep link): call from `enterStep` when `info.instant`. */
  snap(): void;
  update(dt: number, t: number): void;
}

export function createCopper(ctx: ChapterContext): Copper {
  const group = new Group();
  group.name = 'copper-world';
  const space = new Group();
  space.name = 'copper-space';
  const lattice = createLattice();
  const sim = createElectronSim(ctx.random.fork('copper-electrons'), {
    sites: lattice.sites,
    at: siteIndex(lattice.sites),
    presence: (site) => lattice.presence(site),
  });
  const electrons = createElectronView(sim);
  const atom = createAtom(ctx.random.fork('copper-atom'));
  const plastic = createPlastic(ctx.random.fork('plastic'));
  const gate = createGate(sim);
  const backdrop = createBackdrop();
  const rim = createLensRim();
  const core = createCore();
  space.add(backdrop.sheets, lattice.group, plastic.group, electrons.group, atom.group, gate.group);
  group.add(backdrop.group, core.group, space, rim.mesh);

  const q = new Quaternion();
  const inverse = new Matrix4();
  const face = { quaternion: q };
  let present = lattice.sites.length;
  let wanted = present;
  let growRate = 40;
  let jump = true;
  let crowd = 1;
  const copper: Copper = {
    group,
    space,
    lattice,
    sim,
    electrons,
    atom,
    plastic,
    gate,
    backdrop,
    core,
    rim,
    depth: 1,
    lamp: 0,
    atoms: Infinity,
    growSeconds: 1.1,
    hero: 0,
    look: { x: 0, y: 0 },
    marked: -1,
    heroPosition: (out) => space.localToWorld(out.copy(lattice.sites[lattice.heroSite]!.p)),
    markNearest(x = copper.look.x, y = copper.look.y) {
      return (copper.marked = sim.nearest(x, y));
    },
    toLocal: (point) => space.worldToLocal(point),
    localRay(ray, out) {
      inverse.copy(space.matrixWorld).invert();
      out.origin.copy(ray.origin).applyMatrix4(inverse);
      out.direction.copy(ray.direction).transformDirection(inverse);
      return out;
    },
    snap() {
      jump = true;
      electrons.cut();
    },
    update(dt, t) {
      const d = copper.depth;
      const zoom = d < 1 ? diveScale(d) : Math.pow(ATOM_ZOOM, Math.min(d, 2) - 1);
      space.scale.setScalar(zoom);
      // the wire core: the same zoom as the lattice behind it, turning into rows of atoms and dissolving
      core.scale = zoom / DIVE[0]![1];
      core.latticeScale = zoom;
      core.eye.copy(ctx.camera.camera.position).applyMatrix4(inverse.copy(group.matrixWorld).invert());
      // four calm stages (core-shader.ts): dots in the metal → balls in the dark → the picture opens → gone
      core.dots = smooth(...CORE_STAGES.dots, d);
      core.balls = smooth(...CORE_STAGES.balls, d);
      core.open = smooth(...CORE_STAGES.open, d);
      core.fade = 1;
      core.lamp = copper.lamp;
      // the wire leaves the stand's light for the light of this floor as the dive begins
      core.warmth = 0.55 * smooth(0.02, 0.34, d); // part of the way: the full look made the frame flare before the balls
      core.update(group.matrixWorld);
      backdrop.dome = smooth(...CORE_STAGES.dome, d);
      backdrop.lamp = copper.lamp;
      backdrop.up.set(0, 1, 0).transformDirection(group.matrixWorld);
      backdrop.right.set(1, 0, 0).transformDirection(group.matrixWorld);
      // the atom the dive opens: any atom of the focal plane. On the rows floor nothing moves when it is chosen;
      // on the way down the world slides so that it arrives in the middle (the shots keep looking at the origin)
      const heroSite = lattice.sites[copper.hero]?.plane === 0 ? copper.hero : 0;
      const heroAt = lattice.sites[heroSite]!.p;
      lattice.heroSite = heroSite;
      const slide = zoom * smooth(1, 1.45, d);
      space.position.set(-heroAt.x * slide, -heroAt.y * slide, 0);
      // atoms arrive one after another, inside out: about 40 a second, and a big change (a piece growing into
      // the whole crystal) within `growSeconds`; deep links arrive at once
      const want = Math.min(copper.atoms, lattice.sites.length);
      if (want !== wanted) {
        wanted = want;
        growRate = Math.max(40, Math.abs(want - present) / Math.max(copper.growSeconds, 1e-3));
      }
      const step = jump ? Infinity : growRate * dt;
      present += Math.min(Math.max(want - present, -step), step);
      lattice.reveal = present;
      lattice.heroShrink = smooth(1.05, 1.68, d);
      lattice.others = 1 - Math.min(Math.max((d - 1.06) / 0.62, 0), 1); // even, not eased: each atom eases by its own size
      // the real atoms and electrons come in in front of the flat picture, the depth behind when it opens
      lattice.fade = smooth(0.54, 0.7, d);
      // The veils between the planes hide the lit dome. Three of them are stacked, so their opacity is driven by
      // what they let through together: that share rises evenly while the neighbours leave, and the light of
      // the frame changes as smoothly as the atoms do (a plain fade kept the frame dark, then lit it at once).
      const through = VEILS_THROUGH + (1 - VEILS_THROUGH) * smooth(VEILS_LEAVE[0], VEILS_LEAVE[1], d);
      backdrop.veils = d > 0.7 ? (1 - Math.cbrt(through)) / (1 - Math.cbrt(VEILS_THROUGH)) : 0;
      plastic.fade = lattice.others * smooth(0.9, 1, d);
      electrons.fade = smooth(0.6, 0.8, d) * (1 - smooth(1.1, 1.4, d));
      electrons.marked = sim.followed = copper.marked;
      crowd = jump
        ? copper.marked >= 0
          ? 0.6
          : 1
        : crowd + ((copper.marked >= 0 ? 0.6 : 1) - crowd) * Math.min(dt * 4, 1);
      electrons.crowd = crowd;
      // the ball shrinks into its nucleus and uncovers its layers from the outside in — never a bare ball on dark
      atom.open = smooth(1.05, 1.25, d);
      atom.outerShown = smooth(1.25, 1.55, d);
      atom.nucleusShown = d >= 1.65 ? 1 : 0;
      atom.group.position.copy(heroAt);
      // the electrons come with their atoms: while the piece grows, the crowd is as big as the piece
      sim.piece = Math.min(Math.ceil(present), FOCUS_COUNT);
      // the crowd keeps around the point the camera looks at, but never above the copper's top surface
      sim.centre.x = copper.look.x;
      sim.centre.y = Math.min(copper.look.y, COPPER_TOP - 8.2);
      jump = false;
      lattice.update(dt, t);
      atom.update(dt, t);
      plastic.update(t);
      if (electrons.fade > 0.004) sim.step(dt, t);
      gate.update(dt);
      // the camera's orientation in the world's local frame (the mount may be rotated)
      group.getWorldQuaternion(q).invert().multiply(ctx.camera.camera.quaternion);
      electrons.group.visible = electrons.fade > 0.004;
      if (electrons.group.visible) electrons.update(dt, face);
    },
  };
  return copper;
}
