/**
 * «Полиця постійного струму» of step 3: what lives on DC today — a battery, a solar panel, a laptop, an electric
 * car, a metro carriage and a cut HVDC cable (two cores, + `coral` / − `blue`). A low plinth with small toys
 * built with the kit `Builder` (one model, a few draw calls). Origin = centre of the plinth on the floor; the
 * shelf faces +Z. Anchors: `battery`, `pv`, `laptop`, `car`, `metro`, `hvdc`.
 */
import { Vector3 } from 'three';
import { Builder, G, type KitModel } from '@/kit';

export function createDcShelf(): KitModel {
  const b = new Builder('dc-shelf');
  b.box(3.0, 0.16, 0.8, { r: 0.06, c: ['ink', 'slate'] });
  b.box(2.9, 0.03, 0.7, { r: 0.01, c: 'bg.violet', at: [0, 0.16, 0] });
  const y = 0.19;
  // battery: a big cylindrical cell
  b.cyl(0.13, 0.42, { c: ['blue', 'blue.light'], slot: 'gloss', at: [-1.25, y, 0] });
  b.cyl(0.13, 0.08, { c: 'coral', slot: 'gloss', at: [-1.25, y + 0.42, 0] });
  b.cyl(0.04, 0.05, { c: 'steel.light', slot: 'metal', at: [-1.25, y + 0.5, 0] });
  b.anchor('battery', -1.25, y + 0.6, 0);
  // solar panel on a little stand
  b.frame({ at: [-0.75, y, 0], rot: [-0.6, 0, 0] }, () => {
    b.box(0.5, 0.03, 0.36, { r: 0.01, c: 'steel', slot: 'metal', at: [0, 0.2, 0] });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.box(0.14, 0.01, 0.15, { r: 0, c: 'blue.dark', slot: 'gloss', at: [-0.16 + i * 0.16, 0.235, -0.08 + j * 0.16] });
  });
  b.rod([-0.75, y, 0.05], [-0.75, y + 0.2, 0], 0.02, { c: 'steel', slot: 'metal' });
  b.anchor('pv', -0.75, y + 0.45, 0);
  // laptop
  b.box(0.42, 0.03, 0.3, { r: 0.01, c: 'mist', slot: 'gloss', at: [-0.2, y, 0.05] });
  b.frame({ at: [-0.2, y + 0.03, -0.1], rot: [-0.25, 0, 0] }, () => {
    b.box(0.42, 0.28, 0.02, { r: 0.01, c: 'mist', slot: 'gloss' });
    b.box(0.36, 0.22, 0.01, { r: 0.005, slot: 'window', c: 'bg.indigo', glow: 'sky', at: [0, 0.03, 0.012] });
  });
  b.anchor('laptop', -0.2, y + 0.4, 0);
  // electric car (toy): body, cabin, wheels, charge port glow
  b.box(0.62, 0.14, 0.3, { r: 0.06, c: ['teal.dark', 'teal'], slot: 'gloss', at: [0.38, y + 0.05, 0] });
  b.box(0.36, 0.12, 0.26, { r: 0.06, c: 'sky.light', slot: 'gloss', at: [0.36, y + 0.18, 0] });
  for (const dx of [-0.2, 0.2]) for (const dz of [-0.15, 0.15]) b.cyl(0.07, 0.05, { axis: 'z', c: 'ink', at: [0.38 + dx, y + 0.07, dz - 0.025] });
  b.anchor('car', 0.38, y + 0.4, 0);
  // metro carriage on a rail
  b.box(0.7, 0.03, 0.12, { r: 0.01, c: 'steel', slot: 'metal', at: [1.05, y, 0] });
  b.box(0.62, 0.26, 0.26, { r: 0.07, c: ['blue', 'sky'], slot: 'gloss', at: [1.05, y + 0.05, 0] });
  for (let i = 0; i < 4; i++) b.box(0.1, 0.1, 0.01, { r: 0.01, slot: 'window', c: 'bg.indigo', at: [0.84 + i * 0.14, y + 0.15, 0.131] });
  b.anchor('metro', 1.05, y + 0.45, 0);
  // cut HVDC cable: a thick black loop with two exposed cores
  b.add(G.tube(G.roundPath(([[1.32, y + 0.08, 0.3], [1.42, y + 0.08, -0.25], [1.25, y + 0.08, -0.32]] as const).map(([x, yy, z]) => new Vector3(x, yy, z)), 0.1, 4), 0.07, { seg: 12 }), { c: 'ink', slot: 'gloss' });
  b.cyl(0.035, 0.06, { axis: 'z', c: 'coral', slot: 'gloss', at: [1.29, y + 0.1, 0.3] });
  b.cyl(0.035, 0.06, { axis: 'z', c: 'blue', slot: 'gloss', at: [1.35, y + 0.06, 0.3] });
  b.anchor('hvdc', 1.32, y + 0.25, 0.3);
  return b.build();
}
