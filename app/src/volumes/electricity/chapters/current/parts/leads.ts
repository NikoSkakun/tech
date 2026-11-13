/**
 * Leads — the chunky wires that lie on the workbench between component terminals. Each lead is a `createWire`
 * tube: `yellow` energy pulses run along it in the conventional direction (from the first point to the last);
 * `drive(i, p)` maps the simulated current to pulse speed and the power to brightness (STYLE_GUIDE §2.2).
 */
import { CatmullRomCurve3, Vector3, type Color, type Object3D } from 'three';
import { createWire, type Wire } from '@/fx';
import { G } from '@/kit';
import { col, type ColorLike } from '@/style';

/** Height of a lead's axis above the table. */
export const LEAD_Y = 0.075;
export const REPEAT = 1.1;

export interface Lead {
  mesh: Wire;
  curve: CatmullRomCurve3;
  length: number;
  /**
   * `flow`: signed pulse speed factor (1 ≈ a comfortable 1.6 units/s; negative = pulses run backwards),
   * `power`: 0…1+ brightness of the pulses.
   */
  drive(flow: number, power: number): void;
  /** Body colour (potential ramp, heat). */
  tint(color: Color): void;
}

export interface LeadOptions {
  radius?: number;
  color?: ColorLike;
  /** Corner radius of the route. Default 0.28. */
  bend?: number;
  /** Pulses per unit length. Default 1.1. */
  repeat?: number;
  /** Shift of the pulse train in pulse spacings: a lead that continues another starts at its length × repeat. */
  phase?: number;
}

/** World-independent position of an anchor relative to `space` (both must already be in the scene graph). */
export function anchorIn(space: Object3D, anchor: Object3D, out = new Vector3()): Vector3 {
  space.updateWorldMatrix(true, false);
  anchor.updateWorldMatrix(true, false);
  return space.worldToLocal(anchor.getWorldPosition(out));
}

/**
 * Route on the table from terminal `a` to terminal `b` through `via` points `[x, z]`: the lead drops from
 * each terminal to table level and runs flat between them.
 */
export function route(a: Vector3, b: Vector3, via: readonly (readonly [number, number])[] = []): Vector3[] {
  const pts = [a.clone()];
  if (a.y > LEAD_Y + 0.02) pts.push(new Vector3(a.x, LEAD_Y, a.z));
  for (const [x, z] of via) pts.push(new Vector3(x, LEAD_Y, z));
  if (b.y > LEAD_Y + 0.02) pts.push(new Vector3(b.x, LEAD_Y, b.z));
  pts.push(b.clone());
  // drop consecutive duplicates (a terminal already at table level)
  return pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]!) > 1e-4);
}

export function createLead(points: readonly Vector3[], o: LeadOptions = {}): Lead {
  const rounded = points.length > 2 ? G.roundPath(points, o.bend ?? 0.28, 5) : [...points];
  const curve = new CatmullRomCurve3(rounded, false, 'centripetal');
  const repeat = o.repeat ?? REPEAT;
  const mesh = createWire(curve, {
    radius: o.radius ?? 0.055,
    color: o.color ?? col('steel').lerp(col('slate'), 0.55),
    repeat,
    speed: 0,
    power: 0,
    length: 0.4,
    phase: o.phase ?? 0,
    radialSegments: 10,
    detail: 7,
  });
  return {
    mesh,
    curve,
    length: mesh.wireLength,
    drive(flow, power) {
      mesh.material.speed = 1.6 * flow * repeat;
      mesh.material.power = power;
    },
    tint: (color) => void mesh.material.color.copy(color),
  };
}
