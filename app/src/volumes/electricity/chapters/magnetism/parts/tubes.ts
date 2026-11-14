/**
 * The three fall tubes of step `lenz` on one stand: PVC (clear `slate` glass), aluminium (`mist` metal) and
 * copper. Both metal tubes have a long window cut toward the viewer (+z: the kit lathe puts φ = π/2 at +z),
 * glazed with a faint glass strip, so the falling magnets and their eddy rings show. A thin dark slit can be
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
/** Width of the cut window in the metal tubes, rad. */
const WIN = 1.2;

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
  // shell of a metal tube (a lathed wall; phiStart/phiLength leave the window open)
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
  // both metal tubes are cut open toward the viewer (+z, window WIN rad wide) and glazed with a glass strip,
  // so the falling magnet and its eddy rings are seen, not inferred; the inner wall is darker than the outer
  // one, so the window reads as a cut and not as more metal
  const metal = (k: number, outer: Color, inner: Color, cap: string): void => {
    const s = shell(Math.PI / 2 + WIN / 2, Math.PI * 2 - WIN);
    b.add(s.shell, { slot: 'metal', c: (p: Vector3, n: Vector3, out: Color) => out.copy(n.x * p.x + n.z * p.z < 0 ? inner : outer), at: [k * TUBE_DX, TUBE_Y0, 0] });
    if (s.caps) b.add(s.caps, { slot: 'metal', c: cap, at: [k * TUBE_DX, TUBE_Y0, 0] });
  };
  metal(1, col('mist'), col('mist').lerp(col('ink'), 0.5), 'steel');
  metal(2, COPPER, col('orange.dark').lerp(col('ink'), 0.35), 'orange.dark');
  const model = b.build();
  const glassMat = K.glass({ color: 'white', opacity: 0.1, edgeOpacity: 0.45 });
  const panes = [1, 2].map((k) => {
    const pane = new Mesh(G.revolve([[TUBE_R + 0.004, 0], [TUBE_R + 0.004, TUBE_H]], { seg: 12, phiStart: Math.PI / 2 - WIN / 2, phiLength: WIN }).shell, glassMat);
    pane.position.set(k * TUBE_DX, TUBE_Y0, 0);
    pane.renderOrder = 2;
    return pane;
  });
  // PVC: clear glass-like tube (the magnet must be seen dropping straight through)
  const pvc = new Mesh(
    new Builder('pvc').cyl(TUBE_R, TUBE_H, { seg: 40, open: true, bevel: 0 }).geometry('toon'),
    K.glass({ color: 'slate', opacity: 0.16, edgeOpacity: 0.6 }),
  );
  pvc.position.set(0, TUBE_Y0, 0);
  pvc.renderOrder = 2;
  // the slit of the slotted copper tube: a dark strip down the back wall, seen through the window
  const slit = new Mesh(new Builder('slit').box(0.035, TUBE_H, 0.02, { r: 0 }).geometry('toon'), K.toon({ color: 'ink' }));
  slit.position.set(TUBE_DX * 2, TUBE_Y0, -TUBE_R + 0.01);
  // glass (PVC, panes) casts no shadow: mark the solid parts before adding it
  model.group.add(slit);
  model.group.traverse((o) => ((o as Mesh).castShadow = true));
  model.group.add(pvc, ...panes);
  return { group: model.group, slit };
}
