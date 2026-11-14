/**
 * «Гойдалка Ампера» (step `lorentz`, part B): a horseshoe magnet lying on its side — arms along x, bend at −x,
 * N arm on top (`coral` pole face), S arm below (`blue`) — and a copper bar (along z, L = 5 cm) hanging on two
 * thin leads from a frame so that it sits in the gap. `swing` (rad, + = out of the opening, +x) turns the
 * pendulum about its pivot line; `magnet` can be turned over (rotation about x).
 */
import { Group, type Mesh, TorusGeometry, type Object3D } from 'three';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { COPPER } from './coil';

export const GAP_Y = 0.8;
export const PIVOT_Y = 2.0;
const ARM = 0.9;
const GAP = 0.62;
const T = 0.2;
const W = 0.42;

export interface SwingRig {
  group: Group;
  magnet: Group;
  pendulum: Group;
  bar: Object3D;
}

export function createSwing(): SwingRig {
  const g = new Group();
  g.name = 'ampere-swing';
  // the magnet, centred on the gap so that turning it over keeps the gap in place; the bar hangs in the middle
  // of the gap (x = pivot x), so it has the same room to swing both ways
  const mb = new Builder('horseshoe');
  const yTop = GAP / 2 + T / 2;
  for (const [y, pole] of [
    [yTop, SEMANTIC.poleN],
    [-yTop, SEMANTIC.poleS],
  ] as const) {
    mb.box(ARM, T, W, { at: [0, y, 0], r: 0.05, mid: true, slot: 'metal', c: 'steel' });
    mb.box(0.32, T + 0.01, W + 0.01, { at: [ARM / 2 - 0.15, y, 0], r: 0.05, mid: true, slot: 'gloss', c: pole });
  }
  mb.add(new TorusGeometry(yTop, T / 2, 12, 24, Math.PI), { at: [-ARM / 2, 0, 0], rot: [0, 0, Math.PI / 2], slot: 'metal', c: 'steel', s: [1, 1, W / T] });
  const magnetModel = mb.build();
  const magnet = new Group();
  magnet.add(magnetModel.group);
  magnet.position.set(0.15, GAP_Y, 0);
  // frame: two posts and a crossbar along z above the gap
  const fb = new Builder('swing-frame');
  for (const z of [-0.55, 0.55]) {
    fb.box(0.3, 0.06, 0.3, { at: [0.15, 0, z], r: 0.02, c: ['ink', 'slate'] });
    fb.cyl(0.035, PIVOT_Y + 0.05, { at: [0.15, 0.06, z], seg: 12, slot: 'metal', c: 'steel' });
  }
  fb.rod([0.15, PIVOT_Y, -0.6], [0.15, PIVOT_Y, 0.6], 0.03, { slot: 'metal', c: 'steel' });
  fb.box(0.8, 0.06, 0.7, { at: [0.05, 0, 0], r: 0.03, c: ['ink', 'slate'] });
  fb.box(0.25, GAP_Y - yTop + 0.02, 0.3, { at: [-0.15, 0.06, 0], r: 0.03, c: 'slate' });
  const frame = fb.build();
  // pendulum: two leads and the bar, pivoting on the crossbar
  const pb = new Builder('pendulum');
  const l = PIVOT_Y - GAP_Y;
  for (const z of [-0.3, 0.3]) pb.rod([0, 0, z], [0, -l, z], 0.012, { slot: 'metal', c: 'mist' });
  pb.cyl(0.04, 0.62, { axis: 'z', at: [0, -l, -0.31], seg: 16, slot: 'metal', c: COPPER });
  pb.anchor('bar', 0, -l, 0);
  const pend = pb.build();
  const pendulum = new Group();
  pendulum.add(pend.group);
  pendulum.position.set(0.15, PIVOT_Y, 0);
  g.add(magnet, frame.group, pendulum);
  g.traverse((o) => ((o as Mesh).castShadow = true));
  return { group: g, magnet, pendulum, bar: pend.anchor('bar') };
}
