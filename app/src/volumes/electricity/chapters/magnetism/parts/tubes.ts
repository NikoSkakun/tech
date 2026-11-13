/**
 * The three fall tubes of step `lenz` on one stand: PVC (`slate` glass), aluminium (`mist` metal) and copper
 * with a long window cut toward the viewer (+z: the kit lathe puts φ = π/2 at +z) so the eddy currents inside show. A thin dark slit can be
 * drawn on the copper tube (`slot`). Tubes stand along +y from `TUBE_Y0`; spacing `TUBE_DX` along x.
 */
import { type Color, Mesh, type Vector3, type Group } from 'three';
import { Builder, G } from '@/kit';
import { K, col } from '@/style';
import { COPPER } from './coil';

export const TUBE_H = 3.9;
export const TUBE_Y0 = 0.35;
export const TUBE_R = 0.24;
export const TUBE_DX = 0.95;

export interface TubeRack {
  group: Group;
  slit: Mesh;
}

export function createTubes(): TubeRack {
  const b = new Builder('tube-rack');
  b.box(TUBE_DX * 2 + 1.0, 0.12, 0.9, { at: [TUBE_DX, 0, 0], r: 0.05, c: ['ink', 'slate'] });
  for (let k = 0; k < 3; k++) b.cyl(TUBE_R + 0.06, TUBE_Y0 - 0.12, { at: [k * TUBE_DX, 0.12, 0], seg: 28, c: 'slate' });
  for (const x of [-0.45, TUBE_DX * 2 + 0.45]) b.cyl(0.05, TUBE_H + TUBE_Y0 + 0.2, { at: [x, 0.12, -0.3], seg: 12, slot: 'metal', c: 'steel' });
  b.beam([-0.45, TUBE_H + TUBE_Y0 + 0.25, -0.3], [TUBE_DX * 2 + 0.45, TUBE_H + TUBE_Y0 + 0.25, -0.3], 0.1, { r: 0.02, slot: 'metal', c: 'steel' });
  for (let k = 0; k < 3; k++) {
    b.box(0.1, 0.08, 0.3, { at: [k * TUBE_DX, TUBE_H + TUBE_Y0 + 0.21, -0.15], r: 0.02, slot: 'metal', c: 'steel' });
    for (const y of [1.2, 3.0]) b.ring(TUBE_R + 0.02, 0.025, { at: [k * TUBE_DX, TUBE_Y0 + y, 0], seg: 32, slot: 'metal', c: 'steel' });
  }
  // aluminium: closed shell; copper: shell with a window toward +z 
  const shell = (phiStart: number, phiLength: number) =>
    G.revolve(
      [
        [TUBE_R - 0.03, 0],
        [TUBE_R, 0],
        [TUBE_R, TUBE_H],
        [TUBE_R - 0.03, TUBE_H],
      ],
      { seg: 40, phiStart, phiLength },
    );
  const al = shell(0, Math.PI * 2);
  b.add(al.shell, { slot: 'metal', c: 'mist', at: [TUBE_DX, TUBE_Y0, 0] });
  const cu = shell(Math.PI / 2 + 0.55, Math.PI * 2 - 1.1);
  // the inner wall darker than the outer one, so the window reads as a cut and not as more copper
  const inner = col('orange.dark').lerp(col('ink'), 0.35);
  b.add(cu.shell, {
    slot: 'metal',
    c: (p: Vector3, n: Vector3, out: Color) => out.copy(n.x * p.x + n.z * p.z < 0 ? inner : COPPER),
    at: [TUBE_DX * 2, TUBE_Y0, 0],
  });
  if (cu.caps) b.add(cu.caps, { slot: 'metal', c: 'orange.dark', at: [TUBE_DX * 2, TUBE_Y0, 0] });
  const model = b.build();
  // PVC: frosted glass tube
  const pvc = new Mesh(
    new Builder('pvc').cyl(TUBE_R, TUBE_H, { seg: 40, open: true, bevel: 0 }).geometry('toon'),
    K.glass({ color: 'slate', opacity: 0.28, edgeOpacity: 0.7 }),
  );
  pvc.position.set(0, TUBE_Y0, 0);
  pvc.renderOrder = 2;
  // the slit of the slotted copper tube: a dark strip down the back wall, seen through the window
  const slit = new Mesh(new Builder('slit').box(0.035, TUBE_H, 0.02, { r: 0 }).geometry('toon'), K.toon({ color: 'ink' }));
  slit.position.set(TUBE_DX * 2, TUBE_Y0, -TUBE_R + 0.01);
  model.group.add(pvc, slit);
  model.group.traverse((o) => {
    if (o !== pvc) (o as Mesh).castShadow = true;
  });
  return { group: model.group, slit };
}
