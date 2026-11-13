/**
 * The hand generator of step `to-generator`: a big horseshoe magnet standing upright (bend below, N pole
 * shoe left, S right, so **B** between the shoes runs along +x), a rectangular copper frame on an axle along z,
 * a crank at the front end and, at the back, two slip rings — or a split commutator — with brushes. In rotor
 * space the frame lies in the local y–z plane, so θ = 0 (rotation.z) puts it across **B**: maximum flux.
 * Origin: the axle centre between the pole shoes.
 */
import { Group, type Mesh, TorusGeometry, Vector3, type Object3D } from 'three';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { COPPER } from './coil';

export const GEN = { h: 0.55, l: 1.3, ringZ: -1.05, crankZ: 1.0, crankR: 0.55 };

export interface GeneratorModel {
  group: Group;
  rotor: Group;
  rings: Group;
  commutator: Group;
  crank: Object3D;
  /** Frame loop in rotor space. */
  loop: Vector3[];
  /** `hub`: the crank's hub on the axle (does not move — a stable click target). */
  anchors: { rings: Object3D; crank: Object3D; hub: Object3D };
}

export function createGeneratorModel(): GeneratorModel {
  const g = new Group();
  const mb = new Builder('horseshoe-gen');
  const W = 2.3;
  // upright U: two legs, a bend below, pole shoes facing each other around the frame
  for (const s of [-1, 1]) {
    mb.box(0.42, 2.05, 0.9, { at: [s * (W / 2), -0.525, 0], r: 0.08, mid: true, slot: 'metal', c: 'steel' });
    mb.box(0.4, 1.0, 1.6, { at: [s * (W / 2 - 0.3), 0, 0], r: 0.06, mid: true, slot: 'gloss', c: s < 0 ? SEMANTIC.poleN : SEMANTIC.poleS });
  }
  mb.add(new TorusGeometry(W / 2, 0.21, 12, 32, Math.PI), { at: [0, -1.55, 0], rot: [0, 0, Math.PI], c: 'steel', s: [1, 1, 0.9 / 0.42] });
  mb.box(3.2, 0.12, 2.4, { at: [0, -2.95, 0], r: 0.05, c: ['ink', 'slate'] });
  for (const z of [-1.3, 0.75]) {
    mb.box(0.2, 2.9, 0.16, { at: [0, -2.83, z], r: 0.04, c: 'slate' });
    mb.cyl(0.09, 0.14, { axis: 'z', at: [0, 0, z - 0.07], seg: 18, slot: 'metal', c: 'mist' });
  }
  // brush holders at the back, either side of the rings
  for (const s of [-1, 1]) {
    mb.box(0.14, 0.12, 0.12, { at: [s * 0.24, 0, GEN.ringZ + s * 0.1], r: 0.02, mid: true, c: 'ink' });
    mb.box(0.12, 2.9, 0.12, { at: [s * 0.55, -2.83, GEN.ringZ + s * 0.1], r: 0.03, c: 'slate' });
    mb.rod([s * 0.31, 0, GEN.ringZ + s * 0.1], [s * 0.55, 0, GEN.ringZ + s * 0.1], 0.03, { slot: 'metal', c: 'mist' });
  }
  const stator = mb.build();
  const rotor = new Group();
  const rb = new Builder('gen-rotor');
  rb.cyl(0.05, 2.5, { axis: 'z', at: [0, 0, -1.3], seg: 14, slot: 'metal', c: 'mist' });
  const { h, l } = GEN;
  const loop = [new Vector3(0, h, -l / 2), new Vector3(0, h, l / 2), new Vector3(0, -h, l / 2), new Vector3(0, -h, -l / 2)];
  rb.tube([...loop, loop[0]!], 0.06, { slot: 'metal', c: COPPER, seg: 10, closed: true });
  rb.box(0.08, 2 * h - 0.1, 0.1, { at: [0, 0, 0], r: 0.02, mid: true, c: 'slate' });
  for (const y of [-h, h]) rb.rod([0, y, -l / 2], [0, y * 0.25, GEN.ringZ + 0.2], 0.022, { slot: 'metal', c: COPPER });
  // crank: arm + handle at the front
  rb.beam([0, 0, GEN.crankZ], [0, GEN.crankR, GEN.crankZ], 0.08, { r: 0.02, slot: 'metal', c: 'steel' });
  rb.cyl(0.07, 0.35, { axis: 'z', at: [0, GEN.crankR, GEN.crankZ], seg: 16, c: 'red' });
  rb.anchor('crank', 0, GEN.crankR, GEN.crankZ + 0.35);
  const rotorModel = rb.build();
  rotor.add(rotorModel.group);
  const rings = new Builder('gen-rings');
  for (const z of [GEN.ringZ - 0.1, GEN.ringZ + 0.1]) rings.cyl(0.18, 0.12, { axis: 'z', at: [0, 0, z - 0.06], seg: 32, slot: 'metal', c: COPPER });
  const ringGroup = rings.build().group;
  const cb = new Builder('gen-commutator');
  for (const a0 of [0.12, Math.PI + 0.12]) {
    for (let k = 0; k < 10; k++) {
      const a = a0 + ((Math.PI - 0.24) * (k + 0.5)) / 10;
      cb.box(0.07, 0.06, 0.34, { at: [Math.cos(a) * 0.16, Math.sin(a) * 0.16, GEN.ringZ], rot: [0, 0, a], r: 0, mid: true, slot: 'metal', c: COPPER });
    }
  }
  const commGroup = cb.build().group;
  rotor.add(ringGroup, commGroup);
  const anchors = { rings: new Group(), crank: rotorModel.anchor('crank'), hub: new Group() };
  anchors.hub.position.set(0, 0, GEN.crankZ + 0.06);
  anchors.rings.position.set(0.3, 0.3, GEN.ringZ);
  g.add(stator.group, rotor, anchors.rings, anchors.hub);
  g.traverse((o) => ((o as Mesh).castShadow = true));
  return { group: g, rotor, rings: ringGroup, commutator: commGroup, crank: anchors.crank, loop, anchors };
}
