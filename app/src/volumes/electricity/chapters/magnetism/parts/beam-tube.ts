/**
 * Electron-beam tube of step `lorentz`, part A: a glass bulb (Ø 15 cm → radius 0.75) on a stand, the electron
 * gun at the bottom shooting along +x, and a pair of Helmholtz coils (radius = spacing) whose uniform **B** is
 * along +z (toward the viewer). `beamPath(r, sign)` traces the beam: a straight line for B = 0, an arc that
 * ends on the glass, or a full circle when 2r fits inside the bulb. Origin: bulb centre.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { Builder } from '@/kit';
import { K } from '@/style';
import { COPPER } from './coil';

export const BULB_R = 0.75;
/** Gun muzzle (local): bottom of the bulb, firing along +x. */
export const MUZZLE = new Vector3(-0.05, -0.62, 0);
export const COIL_R = 0.98;

export interface BeamTube {
  group: Group;
  bulb: Mesh;
  coils: Group;
}

export function createBeamTube(): BeamTube {
  const g = new Group();
  g.name = 'beam-tube';
  const b = new Builder('tube-stand');
  // stand under the bulb, gun inside it (cathode can + anode disc)
  b.cyl(0.42, 0.08, { at: [0, -BULB_R - 0.55, 0], seg: 32, c: ['ink', 'slate'] });
  b.cyl(0.08, 0.5, { at: [0, -BULB_R - 0.47, 0], seg: 16, slot: 'metal', c: 'steel' });
  b.cyl(0.16, 0.12, { at: [0, -BULB_R - 0.03, 0], seg: 24, slot: 'metal', c: 'steel' });
  b.cyl(0.05, 0.3, { axis: 'x', at: [MUZZLE.x - 0.34, MUZZLE.y, 0], seg: 14, slot: 'metal', c: 'mist' });
  b.cyl(0.075, 0.03, { axis: 'x', at: [MUZZLE.x - 0.04, MUZZLE.y, 0], seg: 18, slot: 'metal', c: 'amber' });
  b.rod([MUZZLE.x - 0.2, MUZZLE.y, 0], [MUZZLE.x - 0.2, -BULB_R + 0.02, 0], 0.015, { slot: 'metal', c: 'mist' });
  // Helmholtz pair: two copper rings on a frame, spacing = radius, axis along z
  for (const z of [-COIL_R / 2, COIL_R / 2]) {
    b.ring(COIL_R, 0.06, { at: [0, 0, z], seg: 64, tubeSeg: 10, axis: 'z', slot: 'metal', c: COPPER });
    b.ring(COIL_R, 0.075, { at: [0, 0, z], seg: 64, tubeSeg: 8, axis: 'z', c: 'slate', s: [1, 1, 0.35] });
    b.rod([0, -COIL_R, z], [0, -BULB_R - 0.55, z], 0.035, { slot: 'metal', c: 'steel' });
  }
  b.box(0.12, 0.06, COIL_R + 0.2, { at: [0, -BULB_R - 0.58, 0], r: 0.02, c: 'slate' });
  const stand = b.build();
  const bulb = new Mesh(new SphereGeometry(BULB_R, 48, 32), K.glass({ color: 'sky', opacity: 0.1, edgeOpacity: 0.55 }));
  bulb.renderOrder = 3;
  const coils = new Group();
  g.add(stand.group, bulb, coils);
  return { group: g, bulb, coils };
}

/**
 * Beam centre line from the muzzle: radius `rUnits` (Infinity = straight), `turn` +1 curves up (electron,
 * B toward the viewer), −1 down (positive charge). Returns the points and whether it closed.
 */
export function beamPath(rUnits: number, turn: 1 | -1, n = 96): { points: Vector3[]; closed: boolean; end: Vector3 } {
  const pts: Vector3[] = [];
  const inside = (p: Vector3): boolean => p.length() < BULB_R - 0.03;
  if (!Number.isFinite(rUnits) || rUnits > 60) {
    for (let k = 0; k <= n; k++) {
      const p = MUZZLE.clone().add(new Vector3((k / n) * 2 * BULB_R, 0, 0));
      if (!inside(p)) break;
      pts.push(p);
    }
    return { points: pts, closed: false, end: pts[pts.length - 1]!.clone() };
  }
  const c = MUZZLE.clone().add(new Vector3(0, turn * rUnits, 0));
  // angle step: n per turn, but never more than 0,03 units (3 mm) of arc — the wide arcs of protons
  const da = Math.min((Math.PI * 2) / n, 0.03 / rUnits);
  const steps = Math.min(Math.ceil((Math.PI * 2) / da), 4000);
  for (let k = 0; k <= steps; k++) {
    const a = Math.min(k * da, Math.PI * 2);
    const p = new Vector3(c.x + Math.sin(a) * rUnits, c.y - turn * Math.cos(a) * rUnits, 0);
    if (!inside(p)) return { points: pts, closed: false, end: pts[pts.length - 1]!.clone() };
    pts.push(p);
  }
  return { points: pts, closed: true, end: pts[0]!.clone() };
}
