/**
 * The DC side of step 9, enlarged beside the house so its parts can be read: a DC box (isolator with a red /
 * yellow handle, two gPV fuse holders, a surge arrester) and the kit hybrid inverter «ЛІ-6» with its two MPPT
 * inputs, on a mounting board; two cables come down from the roof strings. Units: house metres.
 */
import { Group, type Object3D, Vector3 } from 'three';
import { createWire, type Wire } from '@/fx';
import { Builder, hybridInverter } from '@/kit';
import { shadows } from '../world';

const SCALE = 3.2;

export interface DcGear {
  group: Group;
  anchors: Record<'isolator' | 'spd' | 'inverter' | 'pv1' | 'pv2', Object3D>;
  /** Cables of string A and B (pulses ∝ string power). */
  wires: [Wire, Wire];
}

/** `from` = where the two string cables leave the roof (house metres), `at` = foot of the mounting board. */
export function createDcGear(from: readonly [Vector3, Vector3], at: Vector3, yaw: number): DcGear {
  const group = new Group();
  group.name = 'dc-gear';
  const board = new Group();
  board.position.copy(at);
  board.rotation.y = yaw;
  const b = new Builder('dc-board');
  b.box(3.6, 0.2, 1.1, { r: 0.06, c: 'bg.indigo' });
  b.box(3.3, 3.6, 0.16, { r: 0.08, slot: 'gloss', c: ['slate', 'steel'], at: [0, 0.2, -0.2] });
  // DC box: grey enclosure, isolator knob, fuses, arrester
  const box = b.part('dcbox', { at: [-0.85, 2.25, -0.1] });
  box.box(1.1, 1.5, 0.3, { r: 0.06, mid: true, slot: 'gloss', c: 'mist' });
  box.cyl(0.2, 0.08, { axis: 'z', seg: 24, slot: 'gloss', c: 'yellow', at: [0, 0.38, 0.15] });
  box.box(0.1, 0.34, 0.08, { r: 0.03, mid: true, slot: 'gloss', c: 'red', at: [0, 0.38, 0.25], rot: [0, 0, 0.6] });
  for (const x of [-0.3, -0.1]) box.box(0.14, 0.42, 0.14, { r: 0.03, mid: true, slot: 'gloss', c: 'ink', at: [x, -0.32, 0.18] });
  box.box(0.3, 0.42, 0.14, { r: 0.03, mid: true, slot: 'gloss', c: 'white', at: [0.25, -0.32, 0.18] });
  box.box(0.08, 0.08, 0.03, { r: 0, mid: true, slot: 'glow', c: 'green', at: [0.25, -0.2, 0.26] });
  box.anchor('isolator', 0, 0.38, 0.3).anchor('spd', 0.25, -0.32, 0.26).anchor('inA', -0.2, 0.8, 0).anchor('inB', 0.2, 0.8, 0);
  const model = b.build();
  board.add(shadows(model.group));
  const inverter = hybridInverter();
  inverter.group.scale.setScalar(SCALE);
  inverter.group.position.set(0.85, 2.1, -0.1);
  board.add(shadows(inverter.group));
  group.add(board);
  group.updateMatrixWorld(true);

  const local = (o: Object3D): Vector3 => group.worldToLocal(o.getWorldPosition(new Vector3()));
  const wires = ([0, 1] as const).map((s) => {
    const end = local(model.anchor(s ? 'dcbox.inB' : 'dcbox.inA'));
    const a = from[s];
    const pts = [a, new Vector3(a.x + 0.6, a.y - 0.4, a.z), new Vector3(end.x, a.y - 0.8, end.z), end];
    return createWire(pts, { radius: 0.07, color: 'ink', repeat: 0.5, speed: 3, power: 0, detail: 2 });
  }) as [Wire, Wire];
  group.add(...wires);

  return {
    group,
    wires,
    anchors: {
      isolator: model.anchor('dcbox.isolator'),
      spd: model.anchor('dcbox.spd'),
      inverter: inverter.anchor('display'),
      pv1: inverter.anchor('pv1'),
      pv2: inverter.anchor('pv2'),
    },
  };
}
