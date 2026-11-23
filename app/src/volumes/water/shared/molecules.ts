/**
 * The picture of a set of water molecules: three instanced meshes — oxygens, hydrogens, bridge dots — fed every
 * frame from the simulation's buffers (`sim/md.ts`, `sim/process.ts`). True geometry: the hydrogens sit at 0.347 of
 * the bond-length unit from the oxygen, 104.5° apart, wherever the molecule's quaternion turns them.
 *
 * A bridge (hydrogen bond) is three dots between a hydrogen and the oxygen it points at; the dots grow with the
 * bond's strength and shrink when it breaks, so forming and breaking are seen without any scripted effect.
 * A molecule that left the box shrinks away.
 */
import { Color, DynamicDrawUsage, Group, InstancedMesh, SphereGeometry } from 'three';
import { K } from '@/style';
import { HALF_HOH, OH_LENGTH } from '../sim/md';
import { R_HYDROGEN, R_OXYGEN, speedColor, WATER_COLORS } from './look';

/** What is drawn: the buffers of a `WaterMd` or of a `Process` (same names, same layout). */
export interface MoleculeSource {
  readonly pos: ArrayLike<number>;
  readonly quat: ArrayLike<number>;
  readonly alive: ArrayLike<number>;
  readonly bond: ArrayLike<number>;
  readonly bondTo: ArrayLike<number>;
  readonly warmth: ArrayLike<number>;
}

export interface MoleculeView {
  readonly group: Group;
  /** 0 … 1: how far the molecules are coloured by their speed (0 = oxygen blue). */
  speedTint: number;
  /** Mean kinetic energy per molecule that counts as «average speed» for the colours (3 × temperature). */
  meanEnergy: number;
  /** 0 … 1: bridges shown. */
  bridges: number;
  /** 0 … 1: the «+» tips and the «−» side shown as coloured light. */
  charge: number;
  /** Index of the fastest molecule now (smoothed kinetic energy), −1 before the first `sync`. */
  readonly fastest: number;
  /** Number of bridges drawn at more than half strength. */
  readonly bridgeCount: number;
  /** Position of molecule i as drawn (model units, local to `group`). */
  position(i: number, out: { x: number; y: number; z: number }): void;
  /** Draw the source's state; `dt` eases the bridges and the leaving molecules. */
  sync(src: MoleculeSource, dt: number): void;
}

const HX = Math.cos(HALF_HOH) * OH_LENGTH;
const HY = Math.sin(HALF_HOH) * OH_LENGTH;
/** Dots per bridge. */
const DOTS = 3;
const R_DOT = 0.075;
/** Strength below which a bridge is not drawn, and the rate (1/s) its dots follow the strength. */
const BRIDGE_FROM = 0.3;
const BRIDGE_RATE = 14;

export function createMolecules(count: number): MoleculeView {
  const group = new Group();
  group.name = 'water-molecules';
  const oxygenMat = K.toon({ color: 'white', gloss: 0.75, rim: 0.45, highlight: 0.6, softness: 0.14 });
  const hydrogenMat = K.toon({ color: 'white', gloss: 0.5, rim: 0.3, softness: 0.14, emissive: WATER_COLORS.plus, emissiveIntensity: 0 });
  const dotMat = K.glow({ color: WATER_COLORS.bridge, intensity: 1.15, whiten: 0.3, falloff: 1.4 });
  const haloMat = K.glow({ color: WATER_COLORS.minus, intensity: 1.25, whiten: 0, keepHue: true, falloff: 0.6 });
  const oxygens = new InstancedMesh(new SphereGeometry(R_OXYGEN, 28, 20), oxygenMat, count);
  const hydrogens = new InstancedMesh(new SphereGeometry(R_HYDROGEN, 20, 14), hydrogenMat, 2 * count);
  const dots = new InstancedMesh(new SphereGeometry(R_DOT, 10, 8), dotMat, 2 * count * DOTS);
  // the «−» side: a soft cyan cap behind each oxygen, on the side away from the hydrogens
  const halos = new InstancedMesh(new SphereGeometry(R_OXYGEN * 0.92, 16, 12), haloMat, count);
  for (const m of [oxygens, hydrogens, dots, halos]) {
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    group.add(m);
  }
  halos.visible = false;
  halos.renderOrder = 2;
  const tint = new Color();
  for (let i = 0; i < count; i++) oxygens.setColorAt(i, WATER_COLORS.oxygen);
  const presence = new Float32Array(count).fill(1);
  const strength = new Float32Array(2 * count);
  const shownPos = new Float32Array(3 * count);
  let fastest = -1;
  let bridgeCount = 0;
  let tinted = false;

  /** Write a scale-and-translation matrix into `mesh` at `index` (`sz`: the scale along z, default = `s`). */
  const put = (mesh: InstancedMesh, index: number, x: number, y: number, z: number, s: number, sz = s): void => {
    const a = mesh.instanceMatrix.array;
    const o = 16 * index;
    a[o] = s; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0;
    a[o + 4] = 0; a[o + 5] = s; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = sz; a[o + 11] = 0;
    a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
  };
  const lastTo = new Int32Array(2 * count).fill(-1);
  const hPos = new Float32Array(6 * count);

  const view: MoleculeView = {
    group,
    speedTint: 0,
    meanEnergy: 0.36,
    bridges: 1,
    charge: 0,
    get fastest() {
      return fastest;
    },
    get bridgeCount() {
      return bridgeCount;
    },
    position(i, out) {
      out.x = shownPos[3 * i]!;
      out.y = shownPos[3 * i + 1]!;
      out.z = shownPos[3 * i + 2]!;
    },
    sync(src, dt) {
      const { pos: P, quat: Q, alive, bond, bondTo, warmth } = src;
      const ease = Math.min(1, dt * 6);
      let best = -1;
      let bestWarmth = -1;
      for (let i = 0; i < count; i++) {
        presence[i]! += ((alive[i] ? 1 : 0) - presence[i]!) * ease;
        const s = presence[i]! < 0.01 ? 0 : presence[i]!;
        const x = P[3 * i]!, y = P[3 * i + 1]!, z = P[3 * i + 2]!;
        shownPos[3 * i] = x; shownPos[3 * i + 1] = y; shownPos[3 * i + 2] = z;
        const qw = Q[4 * i]!, qx = Q[4 * i + 1]!, qy = Q[4 * i + 2]!, qz = Q[4 * i + 3]!;
        // images of the body axes x (bisector of the hydrogens) and y
        const ax = 1 - 2 * (qy * qy + qz * qz), ay = 2 * (qx * qy + qw * qz), az = 2 * (qx * qz - qw * qy);
        const bx = 2 * (qx * qy - qw * qz), by = 1 - 2 * (qx * qx + qz * qz), bz = 2 * (qy * qz + qw * qx);
        put(oxygens, i, x, y, z, s);
        const h = 6 * i;
        hPos[h] = x + HX * ax + HY * bx; hPos[h + 1] = y + HX * ay + HY * by; hPos[h + 2] = z + HX * az + HY * bz;
        hPos[h + 3] = x + HX * ax - HY * bx; hPos[h + 4] = y + HX * ay - HY * by; hPos[h + 5] = z + HX * az - HY * bz;
        put(hydrogens, 2 * i, hPos[h]!, hPos[h + 1]!, hPos[h + 2]!, s);
        put(hydrogens, 2 * i + 1, hPos[h + 3]!, hPos[h + 4]!, hPos[h + 5]!, s);
        // a flat disc behind the oxygen, pushed to the side away from the hydrogens: only its crescent shows
        if (view.charge > 0) put(halos, i, x - 0.24 * ax, y - 0.24 * ay, z - 0.24 * az - 0.2, s * (0.62 + 0.3 * view.charge), 0.12);
        if (alive[i] && warmth[i]! > bestWarmth) {
          bestWarmth = warmth[i]!;
          best = i;
        }
        if (view.speedTint > 0) {
          speedColor(warmth[i]! / view.meanEnergy, tint);
          tint.lerpColors(WATER_COLORS.oxygen, tint, view.speedTint);
          oxygens.setColorAt(i, tint);
        }
      }
      fastest = best;
      if (view.speedTint > 0 || tinted) {
        if (view.speedTint <= 0) for (let i = 0; i < count; i++) oxygens.setColorAt(i, WATER_COLORS.oxygen);
        tinted = view.speedTint > 0;
        if (oxygens.instanceColor) oxygens.instanceColor.needsUpdate = true;
      }
      // bridges
      const rate = Math.min(1, dt * BRIDGE_RATE);
      let n = 0;
      for (let k = 0; k < 2 * count; k++) {
        const i = k >> 1;
        let to = bondTo[k]!;
        const on = alive[i] && to >= 0 && alive[to] && bond[k]! >= BRIDGE_FROM;
        if (on) lastTo[k] = to;
        else to = lastTo[k]!;
        strength[k]! += ((on ? bond[k]! : 0) - strength[k]!) * rate;
        const s = strength[k]! * view.bridges;
        if (s < 0.04 || to < 0) {
          for (let d = 0; d < DOTS; d++) put(dots, DOTS * k + d, 0, 0, 0, 0);
          continue;
        }
        if (strength[k]! > 0.5) n++;
        const hx = hPos[3 * k]!, hy = hPos[3 * k + 1]!, hz = hPos[3 * k + 2]!;
        let dx = P[3 * to]! - hx, dy = P[3 * to + 1]! - hy, dz = P[3 * to + 2]! - hz;
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
        // from the hydrogen's surface to the oxygen's surface
        const from = R_HYDROGEN * 0.9, span = Math.max(0, len - R_OXYGEN * 0.95 - from);
        for (let d = 0; d < DOTS; d++) {
          const t = from + (span * (d + 0.5)) / DOTS;
          put(dots, DOTS * k + d, hx + dx * t, hy + dy * t, hz + dz * t, 0.3 + 0.7 * s);
        }
      }
      bridgeCount = n;
      halos.visible = view.charge > 0.01;
      hydrogenMat.emissiveIntensity = 0.85 * view.charge;
      oxygens.instanceMatrix.needsUpdate = true;
      hydrogens.instanceMatrix.needsUpdate = true;
      dots.instanceMatrix.needsUpdate = true;
      if (halos.visible) halos.instanceMatrix.needsUpdate = true;
    },
  };
  return view;
}
