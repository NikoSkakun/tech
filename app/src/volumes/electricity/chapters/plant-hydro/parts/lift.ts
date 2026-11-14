/**
 * Step 2 «водяний ліфт» on the south bank beside the dam: a tall ruler (logarithmic: 2 … 1900 m of head on
 * ≈ 130 toy metres) with a glass cube of water — 1 m³ = 1 t — riding at the head H above a small turbine; every
 * few seconds the cube drops onto the turbine, a splash, and a yellow pulse runs off along the cable (the energy
 * m·g·H it gave up). Beside it a pipe mouth at the same height pours a column of water whose thickness grows
 * with the flow Q (cross-section ∝ Q). Origin: the foot of the ruler on the ground.
 */
import { CylinderGeometry, Group, Mesh, type Vector3 } from 'three';
import { K } from '@/style';
import { Builder, type KitModel } from '@/kit';

/** Toy metres of ruler for a head H in metres (log scale, 2 m → 0, 1900 m → TOP). */
export const LIFT_TOP = 130;
export function rulerY(headM: number): number {
  const t = Math.log(Math.max(2, headM) / 2) / Math.log(1900 / 2);
  return 6 + t * (LIFT_TOP - 6);
}

export interface Lift {
  group: Group;
  model: KitModel;
  cube: Group;
  /** World-space point at the cube (callouts) and at the column mouth. */
  cubeAt(out: Vector3): Vector3;
  set(headM: number, flowM3s: number): void;
  update(dt: number, t: number): void;
}

export function buildLift(): Lift {
  const b = new Builder('lift');
  // ruler: a slim mast with decade bands (10, 100, 1000 m) and fine ticks
  b.box(2.2, LIFT_TOP + 4, 2.2, { r: 0.4, c: ['slate', 'steel'] });
  for (const h of [2, 5, 10, 20, 50, 100, 200, 500, 1000, 1900]) {
    const decade = h === 10 || h === 100 || h === 1000;
    b.box(decade ? 7 : 4, decade ? 0.9 : 0.5, 0.6, {
      r: 0.1,
      c: decade ? 'yellow' : 'mist',
      at: [decade ? 2.6 : 1.4, rulerY(h), 1.4],
    });
  }
  // a small turbine house at the foot, and the pipe mast of the flow «tap»
  b.box(12, 5, 10, { r: 0.8, c: ['mist', 'white'], slot: 'matte', at: [-1, 0, 8] });
  b.cyl(3.6, 1.2, { c: 'blue', at: [-1, 5, 8] });
  b.box(1.6, LIFT_TOP + 2, 1.6, { r: 0.3, c: 'steel', at: [14, 0, 0] });
  const model = b.build();
  const group = new Group();
  group.name = 'lift';
  group.add(model.group);
  const cube = new Group();
  const glass = new Mesh(new CylinderGeometry(4.2, 4.2, 8, 4, 1), K.glass({ color: 'sky', opacity: 0.55 }));
  glass.rotation.y = Math.PI / 4;
  cube.add(glass);
  const core = new Mesh(new CylinderGeometry(3.4, 3.4, 6.2, 4, 1), K.toon({ color: 'blue' }));
  core.rotation.y = Math.PI / 4;
  cube.add(core);
  cube.position.set(-1, rulerY(80.6), 2);
  group.add(cube);
  // the tap: horizontal spout at height H and the falling column (radius ∝ √Q → cross-section ∝ Q)
  const spout = new Mesh(new CylinderGeometry(1.4, 1.4, 6, 16), K.metal({ color: 'steel.light' }));
  spout.rotation.z = Math.PI / 2;
  group.add(spout);
  const column = new Mesh(
    new CylinderGeometry(1, 1, 1, 24, 1, true),
    K.water({ shallow: 'sky', deep: 'blue', shape: 'strip', scale: 3 }),
  );
  group.add(column);
  let head = 80.6;
  let fall = 0;
  let cycle = 0;
  const pulse = new Mesh(new CylinderGeometry(0.9, 0.9, 1.8, 12), K.glow({ color: 'yellow', intensity: 2 }));
  group.add(pulse);
  return {
    group,
    model,
    cube,
    cubeAt: (out) => cube.getWorldPosition(out),
    set(headM, flowM3s) {
      head = headM;
      const y = rulerY(headM);
      const r = 0.5 + 5.5 * Math.sqrt(flowM3s / 1000);
      spout.position.set(17, y, 0);
      column.scale.set(r, y, r);
      column.position.set(20 + r * 0.2, y / 2, 0);
    },
    update(dt) {
      // hold 2.2 s at the top, drop with g-like ease, 0.6 s pulse along the cable, repeat
      cycle += dt;
      const top = rulerY(head);
      const hold = 2.2;
      const drop = 0.4 + 0.5 * Math.sqrt(top / LIFT_TOP);
      if (cycle < hold) fall = 0;
      else if (cycle < hold + drop) fall = ((cycle - hold) / drop) ** 2;
      else if (cycle > hold + drop + 0.9) cycle = 0;
      else fall = 1;
      cube.position.y = top - fall * (top - 8);
      cube.visible = fall < 1;
      const p = Math.max(0, cycle - hold - drop) / 0.9;
      pulse.visible = fall >= 1 && p < 1;
      pulse.position.set(-1 - 14 * p, 5.5, 8 + 14 * p);
    },
  };
}
