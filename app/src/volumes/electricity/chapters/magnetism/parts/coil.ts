/**
 * Copper coils. `helixPoints` is the centre line of a helix along local +x (for wires and for electron flows
 * along the winding); `createCoil` builds a cel-shaded copper winding on an optional plastic former with
 * end flanges and two leads.
 */
import { Vector3, type Group } from 'three';
import { Builder } from '@/kit';
import { col } from '@/style';

/** Copper of every winding in the chapter (orange toward wire brown, cel-shaded metal). */
export const COPPER = col('orange').lerp(col('wireBrown'), 0.45);

/** Centre line of a helix: radius `r`, length `len` along +x centred on the origin, `turns` turns. */
export function helixPoints(r: number, len: number, turns: number, perTurn = 24): Vector3[] {
  const pts: Vector3[] = [];
  const n = Math.max(2, Math.round(turns * perTurn));
  for (let k = 0; k <= n; k++) {
    const a = (k / perTurn) * Math.PI * 2;
    pts.push(new Vector3(-len / 2 + (len * k) / n, Math.sin(a) * r, Math.cos(a) * r));
  }
  return pts;
}

export interface CoilOptions {
  r: number;
  len: number;
  turns: number;
  wire?: number;
  /** Plastic former (tube + flanges) under the winding. */
  former?: boolean;
  formerColor?: string;
}

export interface CoilModel {
  group: Group;
  /** Helix centre line (local). */
  path: Vector3[];
  /** Lead ends (local): where the winding leaves at −x and +x. */
  ends: [Vector3, Vector3];
}

export function createCoil(o: CoilOptions): CoilModel {
  const wire = o.wire ?? 0.025;
  const b = new Builder('coil');
  const path = helixPoints(o.r, o.len, o.turns);
  b.tube(path, wire, { slot: 'metal', c: COPPER, seg: 6 });
  if (o.former !== false) {
    const fr = o.r - wire * 1.2;
    b.cyl(fr, o.len + 0.08, { axis: 'x', at: [-o.len / 2 - 0.04, 0, 0], seg: 28, c: o.formerColor ?? 'slate' });
    for (const x of [-o.len / 2 - 0.06, o.len / 2 + 0.02])
      b.cyl(o.r + wire * 2.4, 0.04, { axis: 'x', at: [x, 0, 0], seg: 32, c: o.formerColor ?? 'slate', bevel: 0.01 });
  }
  const model = b.build();
  return {
    group: model.group,
    path,
    ends: [path[0]!.clone(), path[path.length - 1]!.clone()],
  };
}
