/**
 * The big open DC motor of step `dc-motor` (≈ 40 cm in the frame). Axle along z (commutator toward the viewer at
 * +z), stator magnets left (N, `coral`) and right (S, `blue`) so **B** runs along +x. The rotor holds a
 * rectangular copper frame in its local x–z plane (long sides at x = ±W/2), the commutator — two half-rings
 * whose gaps sit at local ±y, so the brushes at ±x change over exactly when the frame is vertical — and,
 * alternatively, two slip rings. Behind the stator: the flywheel / brake drum with a stripe and a brake pad.
 * Origin: on the axle at the middle of the stator; rotate `rotor.rotation.z` (+ = counter-clockwise from +z).
 */
import { Group, type Mesh, Vector3, type Object3D } from 'three';
import { Builder, G } from '@/kit';
import { SEMANTIC, type ColorLike } from '@/style';
import { COPPER } from './coil';

export const FRAME_W = 1.1;
export const FRAME_L = 1.5;
export const COMM_Z = 1.05;
export const DRUM_Z = -1.3;

export interface MotorModel {
  group: Group;
  rotor: Group;
  commutator: Group;
  slipRings: Group;
  brushes: Group;
  pad: Group;
  /** Frame loop in rotor space (conventional current runs along it for a positive frame current). */
  loop: Vector3[];
  anchors: { commutator: Object3D; brush: Object3D; drum: Object3D };
}

/** An arc shell around z: rotor-local angles a0…a1, radii r0…r1, z from z0 to z1. */
function arc(b: Builder, a0: number, a1: number, r0: number, r1: number, z0: number, z1: number, c: ColorLike, slot: 'toon' | 'metal' | 'gloss' = 'gloss'): void {
  // after laying the lathe's y axis along z the lathe angle runs clockwise: α = −φ (checked on screen)
  const g = G.revolve(
    [
      [r0, 0],
      [r1, 0],
      [r1, z1 - z0],
      [r0, z1 - z0],
    ],
    { seg: 28, phiStart: -a1, phiLength: a1 - a0 },
  );
  b.frame({ at: [0, 0, z0], rot: [Math.PI / 2, 0, 0] }, () => {
    b.add(g.shell, { slot, c });
    if (g.caps) b.add(g.caps, { slot, c });
  });
}

export function createMotorModel(): MotorModel {
  const g = new Group();
  g.name = 'dc-motor';
  const sb = new Builder('stator');
  arc(sb, Math.PI - 0.8, Math.PI + 0.8, 0.86, 1.14, -FRAME_L / 2 - 0.05, FRAME_L / 2 + 0.05, SEMANTIC.poleN);
  arc(sb, -0.8, 0.8, 0.86, 1.14, -FRAME_L / 2 - 0.05, FRAME_L / 2 + 0.05, SEMANTIC.poleS);
  arc(sb, Math.PI + 0.8, 2 * Math.PI - 0.8, 1.0, 1.16, -FRAME_L / 2 - 0.05, FRAME_L / 2 + 0.05, 'steel', 'metal');
  // feet, bearing posts front and back, brake bracket
  sb.box(2.6, 0.12, 2.0, { at: [0, -1.42, 0], r: 0.05, c: ['ink', 'slate'] });
  for (const z of [-1.0, 0.78]) {
    sb.box(0.22, 1.32, 0.16, { at: [0, -1.32, z], r: 0.04, c: 'slate' });
    sb.cyl(0.1, 0.16, { axis: 'z', at: [0, 0, z - 0.08], seg: 20, slot: 'metal', c: 'mist' });
  }
  sb.box(0.16, 1.85, 0.16, { at: [0.75, -1.32, DRUM_Z], r: 0.04, c: 'slate' });
  sb.beam([0.75, 0.55, DRUM_Z], [0.05, 0.75, DRUM_Z], 0.09, { r: 0.02, slot: 'metal', c: 'steel' });
  const stator = sb.build();
  // rotor: axle, frame bundle, drum
  const rotor = new Group();
  const rb = new Builder('rotor');
  rb.cyl(0.05, 3.0, { axis: 'z', at: [0, 0, DRUM_Z - 0.2], seg: 14, slot: 'metal', c: 'mist' });
  const hw = FRAME_W / 2;
  const hl = FRAME_L / 2;
  const loop = [new Vector3(hw, 0, -hl), new Vector3(hw, 0, hl), new Vector3(-hw, 0, hl), new Vector3(-hw, 0, -hl)];
  rb.tube([...loop, loop[0]!], 0.065, { slot: 'metal', c: COPPER, seg: 10, closed: true });
  for (const x of [-hw, hw]) rb.rod([x, 0, hl], [x * 0.18, 0, COMM_Z - 0.05], 0.025, { slot: 'metal', c: COPPER });
  rb.box(0.12, 0.08, FRAME_L - 0.2, { at: [0, 0, 0], r: 0.02, mid: true, c: 'slate' });
  rb.cyl(0.46, 0.24, { axis: 'z', at: [0, 0, DRUM_Z - 0.12], seg: 40, slot: 'metal', c: 'steel', bevel: 0.03 });
  rb.box(0.1, 0.03, 0.26, { at: [0, 0.46, DRUM_Z], r: 0, mid: true, c: 'white' });
  rotor.add(rb.build().group);
  const cb = new Builder('commutator');
  arc(cb, -Math.PI / 2 + 0.14, Math.PI / 2 - 0.14, 0.11, 0.17, COMM_Z - 0.12, COMM_Z + 0.12, COPPER, 'metal');
  arc(cb, Math.PI / 2 + 0.14, (3 * Math.PI) / 2 - 0.14, 0.11, 0.17, COMM_Z - 0.12, COMM_Z + 0.12, COPPER, 'metal');
  const commutator = cb.build().group;
  const ringB = new Builder('slip-rings');
  for (const z of [COMM_Z - 0.12, COMM_Z + 0.14]) ringB.cyl(0.17, 0.1, { axis: 'z', at: [0, 0, z - 0.05], seg: 32, slot: 'metal', c: COPPER });
  const slipRings = ringB.build().group;
  rotor.add(commutator, slipRings);
  // brushes: graphite blocks on spring arms at ±x
  const bb = new Builder('brushes');
  for (const s of [-1, 1]) {
    bb.box(0.16, 0.12, 0.14, { at: [s * 0.25, 0, COMM_Z], r: 0.02, mid: true, c: 'ink' });
    bb.rod([s * 0.33, 0, COMM_Z], [s * 0.53, 0, COMM_Z], 0.035, { slot: 'metal', c: 'mist' });
    bb.box(0.14, 0.3, 0.18, { at: [s * 0.6, -0.15, COMM_Z], r: 0.03, mid: true, c: 'slate' });
    bb.box(0.12, 1.0, 0.12, { at: [s * 0.6, -1.32, COMM_Z], r: 0.03, c: 'slate' });
  }
  const brushes = bb.build().group;
  const pb = new Builder('brake-pad');
  pb.box(0.34, 0.1, 0.3, { at: [0, 0.52, 0], r: 0.03, mid: true, c: 'ink' });
  pb.rod([0, 0.57, 0], [0, 0.85, 0], 0.025, { slot: 'metal', c: 'mist' });
  pb.cyl(0.08, 0.05, { at: [0, 0.85, 0], seg: 12, c: 'amber' });
  const pad = pb.build().group;
  pad.position.z = DRUM_Z;
  const anchors = { commutator: new Group(), brush: new Group(), drum: new Group() };
  anchors.commutator.position.set(0, 0.3, COMM_Z + 0.1);
  anchors.brush.position.set(0.3, 0.12, COMM_Z);
  anchors.drum.position.set(-0.4, 0.4, DRUM_Z);
  g.add(stator.group, rotor, brushes, pad, anchors.commutator, anchors.brush, anchors.drum);
  g.traverse((o) => ((o as Mesh).castShadow = true));
  return { group: g, rotor, commutator, slipRings, brushes, pad, loop, anchors };
}
