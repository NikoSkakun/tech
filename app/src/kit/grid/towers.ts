/**
 * Lattice transmission towers, parametric by voltage class. Sizes follow the table the `transmission` chapter
 * teaches (stylised typical post-Soviet lines): the tower grows with voltage — longer strings, wider phase
 * spacing, bundled conductors, two shield wires. The line runs along local Z; phases spread along X.
 *
 * Anchors: `pK` (phase K attachment), `pK.in` / `pK.out` (conductor ends toward −Z / +Z — the same point on a
 * suspension tower, the two string ends on a tension tower), `sK` (shield wire), `top`.
 */
import { type Vector3, type Color } from 'three';
import { SEMANTIC, col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { catenary } from '../core/geo';
import { addInsulatorString, type InsulatorKind } from './insulators';
import type { LatticeStyle } from './lattice';
import { TOWER_SHAPES } from './tower-shapes';

export type TowerVoltage = 110 | 150 | 220 | 330 | 400 | 500 | 750;

export interface TowerSpec {
  /** `barrel` double-circuit «бочка» · `single` single-circuit triangle · `wineglass` Y-shaped «чарка» · `portal` guyed portal. */
  style: 'barrel' | 'single' | 'wineglass' | 'portal';
  /** Total height, m. */
  height: number;
  /** Distance between phases, m. */
  gap: number;
  /** Discs per suspension string. */
  discs: number;
  /** Sub-conductors per phase. */
  bundle: number;
  shields: 1 | 2;
}

export const TOWER_SPECS: Record<TowerVoltage, TowerSpec> = {
  110: { style: 'barrel', height: 30, gap: 4, discs: 8, bundle: 1, shields: 1 },
  150: { style: 'barrel', height: 32, gap: 5, discs: 10, bundle: 1, shields: 1 },
  220: { style: 'single', height: 35, gap: 7, discs: 14, bundle: 1, shields: 1 },
  330: { style: 'wineglass', height: 32, gap: 8.5, discs: 20, bundle: 2, shields: 2 },
  400: { style: 'wineglass', height: 34, gap: 10, discs: 23, bundle: 2, shields: 2 },
  500: { style: 'portal', height: 30, gap: 12, discs: 27, bundle: 3, shields: 2 },
  750: { style: 'portal', height: 38, gap: 18, discs: 40, bundle: 5, shields: 2 },
};

export interface TowerOptions {
  voltage?: TowerVoltage;
  /** `suspension` (strings hang vertically) or `tension` (anchor tower: horizontal strings + jumpers). */
  type?: 'suspension' | 'tension';
  /** Deflection of the line at a tension (angle) tower, radians. */
  angle?: number;
  /** Circuits of a barrel tower (default 2). */
  circuits?: 1 | 2;
  insulators?: InsulatorKind;
  /** L1 / L2 / L3 colour marks on the clamps (yellow / green / red). Default true. */
  phaseMarks?: boolean;
  /** Lighter geometry for towers in the distance. */
  low?: boolean;
  color?: ColorLike;
}

export interface Tower extends KitModel {
  readonly spec: TowerSpec;
  readonly voltage: TowerVoltage;
  /** Phase anchor names in order (`p1`, `p2`, …). */
  readonly phases: readonly string[];
  readonly shields: readonly string[];
}

/** What a tower shape receives: the builder plus "hang a phase here" / "shield wire here". */
export interface TowerContext {
  b: Builder;
  spec: TowerSpec;
  tension: boolean;
  style: LatticeStyle;
  /** Attach the next phase at an arm point (string, clamp, anchors; jumper on tension towers). `v` = V-string half-spread. */
  phase(x: number, y: number, z?: number, v?: number): void;
  shield(x: number, y: number): void;
  footing(x: number, z: number, size?: number): void;
}

const PHASE_TOKENS = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export function addLatticeTower(b: Builder, o: TowerOptions = {}): { spec: TowerSpec; phases: string[]; shields: string[] } {
  const voltage = o.voltage ?? 330;
  const spec = TOWER_SPECS[voltage];
  const tension = o.type === 'tension';
  const steel: Color = col(o.color ?? col('steel').lerp(col('mist'), 0.25));
  const k = spec.height / 32;
  const style: LatticeStyle = { leg: 0.3 * k, brace: 0.15 * k, c: steel };
  const phases: string[] = [];
  const shields: string[] = [];
  const half = (o.angle ?? 0) / 2;
  const string = (mark: ColorLike | undefined): number =>
    addInsulatorString(b, { discs: spec.discs + (tension ? 1 : 0), kind: o.insulators, ring: voltage >= 330, low: o.low, phase: mark });
  const ctx: TowerContext = {
    b,
    spec,
    tension,
    style,
    phase(x, y, z = 0, v = 0) {
      const name = `p${phases.length + 1}`;
      const mark = (o.phaseMarks ?? true) ? PHASE_TOKENS[phases.length % 3] : undefined;
      phases.push(name);
      if (!tension) {
        let length = 0;
        if (v > 0) {
          // V-string: two strings from points ±v apart meeting at the clamp
          const drop = spec.discs * 0.15 + 0.6;
          const lean = Math.atan2(v, drop);
          for (const side of [-1, 1]) b.frame({ at: [x + side * v, y, z], rot: [0, 0, -side * lean] }, () => (length = string(mark)));
          length *= Math.cos(lean);
        } else b.frame({ at: [x, y, z] }, () => (length = string(mark)));
        for (const suffix of ['', '.in', '.out']) b.anchor(name + suffix, x, y - length, z);
        return;
      }
      const ends: Vector3[] = [];
      for (const dir of [-1, 1]) {
        // near-horizontal string toward ±Z (drooping 10°), turned by half the line angle
        b.frame({ at: [x, y, z], rot: [0, dir * half, 0] }, () => {
          b.frame({ rot: [-dir * (Math.PI / 2 - 0.17), 0, 0] }, () => {
            const length = string(mark);
            b.anchor(name + (dir < 0 ? '.in' : '.out'), 0, -length, 0);
            ends.push(b.toModel(0, -length, 0));
          });
        });
      }
      b.anchor(name, x, y, z);
      // jumper loop under the arm, connecting the two dead-ends
      const loop = catenary(ends[0]!, ends[1]!, 1.2 + spec.discs * 0.06, 12);
      b.tube(loop, 0.05 * Math.sqrt(spec.bundle) + 0.02, { seg: 6, slot: 'metal', c: 'mist' });
    },
    shield(x, y) {
      const name = `s${shields.length + 1}`;
      shields.push(name);
      b.box(0.3, 0.3, 0.5, { r: 0.06, slot: 'metal', c: 'slate', at: [x, y - 0.3, 0] });
      for (const suffix of ['', '.in', '.out']) b.anchor(name + suffix, x, y - 0.15, 0);
    },
    footing(x, z, size = 1.3 * k) {
      b.box(size, 0.9, size, { r: 0.12, slot: 'matte', c: ['steel', 'mist'], at: [x, -0.5, z] });
    },
  };
  TOWER_SHAPES[spec.style](ctx, o);
  b.anchor('top', 0, spec.height, 0);
  b.anchor('base', 0, 0, 0);
  return { spec, phases, shields };
}

/** A lattice tower as a model. Use `addLatticeTower` to merge many towers into one builder, or `instanced()`. */
export function latticeTower(o: TowerOptions = {}): Tower {
  const b = new Builder(`tower-${o.voltage ?? 330}`);
  const info = addLatticeTower(b, o);
  return Object.assign(b.build(), { ...info, voltage: o.voltage ?? 330 });
}
