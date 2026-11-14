/**
 * Air-cooled condenser (повітряний конденсатор): cells of A-shaped finned-tube bundles on a steel table, a big
 * fan in the floor of each cell blowing air up through the fins, the steam duct along the ridge. Fans are one
 * instanced mesh (one draw call), turned every frame. Origin: ground under the centre.
 */
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Mesh } from 'three';
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';

export interface Acc {
  group: Group;
  model: KitModel;
  /** Fan speed, rad/s (0 = stopped). */
  speed: number;
  /** Anchor at the ridge steam duct (world). */
  duct(out?: Vector3): Vector3;
  update(dt: number): void;
}

export function buildAcc(o: { cols: number; rows: number; cell: number; height: number }): Acc {
  const { cols, rows, cell: C, height: H } = o;
  const b = new Builder('acc');
  const W = cols * C;
  const D = rows * C;
  const steel = col('steel').lerp(col('violet'), 0.1);
  // table legs and deck
  for (let i = 0; i <= cols; i++)
    for (let j = 0; j <= rows; j++) b.box(0.9, H, 0.9, { r: 0.1, slot: 'metal', c: [steel.clone().multiplyScalar(0.8), steel], at: [-W / 2 + i * C, 0, -D / 2 + j * C] });
  b.box(W + 1, 0.6, D + 1, { r: 0.1, slot: 'metal', c: 'slate', at: [0, H, 0] });
  const fanCentres: Vector3[] = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = -W / 2 + (i + 0.5) * C;
      const z = -D / 2 + (j + 0.5) * C;
      b.ring(C * 0.42, 0.25, { seg: 36, tubeSeg: 6, slot: 'gloss', c: 'steel.light', at: [x, H + 0.6, z] });
      fanCentres.push(new Vector3(x, H + 0.5, z));
      // the A: two finned bundles leaning toward the ridge (fins as stripes on a slab)
      for (const s of [-1, 1]) {
        const lean = s * 0.5;
        b.box(C - 0.8, C * 0.62, 0.7, { r: 0.08, slot: 'matte', c: ['teal.dark', 'teal'], at: [x, H + 0.8, z + s * C * 0.2], rot: [lean, 0, 0] });
        for (let k = 0; k < 8; k++) b.box(C - 0.6, 0.12, 0.8, { r: 0, slot: 'metal', c: 'mist', at: [x, H + 1.2 + k * 0.62 * C * 0.11, z + s * C * (0.2 - 0.045 * k)], rot: [lean, 0, 0] });
      }
    }
  // steam ducts along the ridges, wind walls around the top
  for (let j = 0; j < rows; j++) b.cyl(0.9, W, { axis: 'x', seg: 20, slot: 'gloss', c: ['white', 'mist'], at: [-W / 2, H + C * 0.58, -D / 2 + (j + 0.5) * C] });
  for (const s of [-1, 1]) b.box(W + 1, C * 0.62, 0.3, { r: 0.05, c: ['mist', 'white'], at: [0, H + 0.6, s * (D / 2 + 0.4)] });
  b.anchor('duct', -W / 2, H + C * 0.58, 0);
  const model = b.build();
  // one fan rotor: hub + 6 blades, instanced over the cells
  const fb = new Builder('acc-fan');
  fb.cyl(0.6, 0.5, { seg: 16, slot: 'metal', c: 'slate', at: [0, -0.25, 0] });
  for (let k = 0; k < 6; k++) fb.box(C * 0.38, 0.08, 0.9, { r: 0.04, slot: 'metal', c: 'steel.light', at: [C * 0.2 * Math.cos((k * Math.PI) / 3), 0, C * 0.2 * Math.sin((k * Math.PI) / 3)], rot: [0.25, (-k * Math.PI) / 3, 0] });
  const fanModel = fb.build();
  const fanMesh = fanModel.group.children[0] as Mesh;
  const fans = new InstancedMesh(fanMesh.geometry, fanMesh.material, fanCentres.length);
  fans.name = 'acc-fans';
  const group = new Group();
  group.add(model.group, fans);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const one = new Vector3(1, 1, 1);
  let angle = 0;
  const acc: Acc = {
    group,
    model,
    speed: 2.4,
    duct: (out = new Vector3()) => model.anchorWorld('duct', out),
    update(dt) {
      angle += acc.speed * dt;
      fanCentres.forEach((p, i) => fans.setMatrixAt(i, m.compose(p, q.setFromAxisAngle(up, angle + i * 0.7), one)));
      fans.instanceMatrix.needsUpdate = true;
    },
  };
  acc.update(0);
  return acc;
}
