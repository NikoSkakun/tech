/**
 * Conductor spans: catenary sag, bundled phases with spacers, shield wires. Static geometry only — energy
 * pulses along the wires belong to `fx`; every phase path is exported in `model.paths` (`span0.p1`, …), and a
 * custom material (e.g. `K.energy`, whose `repeat` then means pulses per metre) can be passed in.
 */
import { type Matrix4, Mesh, Vector3, type Material } from 'three';
import { SEMANTIC, col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { catenary } from '../core/geo';

export interface SpanOptions {
  /** Mid-span sag as a fraction of the span length. Default 0.035 (≈ 12 m on a 350 m span). */
  sag?: number;
  /** Sub-conductors per phase. Default 1. */
  bundle?: number;
  /** Distance between neighbouring sub-conductors. Default 0.4 m (real: 0.4–0.6 m). */
  spacing?: number;
  /** Wire radius (exaggerated so it reads at diorama distance). Default 0.08 m. */
  radius?: number;
  color?: ColorLike;
  /** Bundle spacers along the span. Default: one per ~1/6 of the span when bundled. */
  spacers?: number;
  /** Curve resolution. Default 24. */
  segments?: number;
}

/** Add one phase between two attachment points. Returns the centre line of the phase. */
export function addSpan(b: Builder, from: Vector3, to: Vector3, o: SpanOptions = {}): Vector3[] {
  const n = Math.max(1, o.bundle ?? 1);
  const radius = o.radius ?? 0.08;
  const length = from.distanceTo(to);
  const centre = catenary(from, to, length * (o.sag ?? 0.035), o.segments ?? 24);
  const c = col(o.color ?? col('mist').lerp(col('steel'), 0.35));
  if (n === 1) {
    b.tube(centre, radius, { seg: 5, slot: 'metal', c, caps: false });
    return centre;
  }
  // sub-conductors sit on a circle in the plane across the line (two = side by side, three = point down…)
  const ringR = (o.spacing ?? 0.4) / (2 * Math.sin(Math.PI / n));
  const side = new Vector3(to.z - from.z, 0, -(to.x - from.x)).normalize();
  const offsets: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (n === 2 ? 0 : -Math.PI / 2);
    offsets.push(side.clone().multiplyScalar(Math.cos(a) * ringR).setY(Math.sin(a) * ringR));
  }
  for (const off of offsets) {
    b.tube(centre.map((p) => p.clone().add(off)), radius, { seg: 5, slot: 'metal', c, caps: false });
  }
  const spacers = o.spacers ?? 5;
  for (let k = 1; k <= spacers; k++) {
    const p = centre[Math.round((k / (spacers + 1)) * (centre.length - 1))]!;
    for (let i = 0; i < n; i++) {
      const u = p.clone().add(offsets[i]!);
      const v = p.clone().add(offsets[(i + 1) % n]!);
      b.rod([u.x, u.y, u.z], [v.x, v.y, v.z], radius * 0.9, { slot: 'metal', c: 'slate', seg: 4 });
      if (n === 2) break;
    }
  }
  return centre;
}

/** Anything a line can be strung on: lattice towers, distribution poles, substation gantries (`yard.ports`). */
export type LineSupport = KitModel & {
  /** Phase anchor base names; each has `.in` and `.out` anchors. */
  readonly phases: readonly string[];
  readonly shields: readonly string[];
  readonly spec: { bundle: number };
};

/** A support of a line and where it stands (its group transform, or an explicit matrix when instanced). */
export interface LineSite {
  tower: LineSupport;
  matrix?: Matrix4;
}

export interface LineOptions extends SpanOptions {
  /** Colour the phases L1 / L2 / L3 (yellow / green / red) instead of aluminium. */
  phaseColors?: boolean;
  /** Material for the phase conductors (e.g. `K.energy`); shield wires and spacers keep the kit materials. */
  material?: Material;
}

const PHASE_TOKENS = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

/**
 * String conductors and shield wires between consecutive supports. The result lives in the coordinate space of
 * the towers' parent: add its group to the same parent. Bundle size defaults to the first tower's voltage class.
 */
export function powerLine(sites: readonly (LineSupport | LineSite)[], o: LineOptions = {}): KitModel {
  const list = sites.map((s) => ('tower' in s ? s : { tower: s }));
  const b = new Builder('line');
  const wires = o.material ? new Builder('wires') : b;
  const at = (site: LineSite, name: string): Vector3 => {
    site.tower.group.updateMatrix();
    return site.tower.anchorLocal(name).applyMatrix4(site.matrix ?? site.tower.group.matrix);
  };
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i]!;
    const c = list[i + 1]!;
    const phases = Math.min(a.tower.phases.length, c.tower.phases.length);
    for (let k = 0; k < phases; k++) {
      const path = addSpan(wires, at(a, `${a.tower.phases[k]}.out`), at(c, `${c.tower.phases[k]}.in`), {
        bundle: a.tower.spec.bundle,
        ...o,
        color: o.phaseColors ? PHASE_TOKENS[k % 3] : o.color,
      });
      b.path(`span${i}.p${k + 1}`, path);
    }
    const shields = Math.min(a.tower.shields.length, c.tower.shields.length);
    for (let k = 0; k < shields; k++) {
      const path = addSpan(b, at(a, `${a.tower.shields[k]}.out`), at(c, `${c.tower.shields[k]}.in`), {
        sag: (o.sag ?? 0.035) * 0.8,
        radius: (o.radius ?? 0.08) * 0.7,
        color: 'slate',
        segments: o.segments,
      });
      b.path(`span${i}.s${k + 1}`, path);
    }
  }
  if (o.material && wires !== b) {
    const mesh = new Mesh(wires.geometry('metal'), o.material);
    mesh.name = 'line:conductors';
    mesh.castShadow = true;
    b.attach(mesh);
  }
  return b.build();
}
