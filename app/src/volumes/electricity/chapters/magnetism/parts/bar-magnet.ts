/**
 * A school bar magnet (10 × 2,2 × 1,4 cm at length 1): N half `coral`, S half `blue` (SEMANTIC poles), a steel
 * band in the middle, chamfered ends with a lighter pole face. Lies along local +x (N end at +x) with its base
 * on y = 0. `peek` (0…1) dissolves the painted body into a glass ghost so the field lines inside show.
 * Every magnet owns its materials (its own `MatSet`), so fading one never touches another.
 */
import { Group, Mesh, type Object3D } from 'three';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';

export const MAGNET_W = 0.22;
export const MAGNET_H = 0.14;

export interface BarMagnetModel {
  group: Group;
  /** Body meshes (hit targets for dragging). */
  body: Object3D;
  /** Anchors at the pole faces. */
  n: Object3D;
  s: Object3D;
  length: number;
  peek: number;
  update(): void;
}

export function createBarMagnet(length = 1): BarMagnetModel {
  const b = new Builder('bar-magnet');
  const half = length / 2;
  const band = Math.min(0.08, length * 0.08);
  const poleLen = half - band / 2;
  // two painted halves, a steel band and lighter pole faces
  b.box(poleLen, MAGNET_H, MAGNET_W, { at: [band / 2 + poleLen / 2, 0, 0], r: 0.03, slot: 'gloss', c: SEMANTIC.poleN });
  b.box(poleLen, MAGNET_H, MAGNET_W, { at: [-band / 2 - poleLen / 2, 0, 0], r: 0.03, slot: 'gloss', c: SEMANTIC.poleS });
  b.box(band + 0.02, MAGNET_H - 0.02, MAGNET_W - 0.02, { at: [0, 0.01, 0], r: 0.01, slot: 'metal', c: 'steel' });
  b.box(0.02, MAGNET_H - 0.04, MAGNET_W - 0.05, { at: [half + 0.004, 0.02, 0], r: 0.008, c: 'coral.light' });
  b.box(0.02, MAGNET_H - 0.04, MAGNET_W - 0.05, { at: [-half - 0.004, 0.02, 0], r: 0.008, c: 'blue.light' });
  b.anchor('n', half, MAGNET_H / 2, 0).anchor('s', -half, MAGNET_H / 2, 0);
  const model = b.build();
  const body = model.group;
  body.traverse((o) => {
    if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
  });
  // glass ghost of the same box, shown while peeking
  const ghostMat = K.glass({ color: 'mist', opacity: 0.1, edgeOpacity: 0.6 });
  const gb = new Builder('bar-magnet-ghost');
  gb.box(length, MAGNET_H, MAGNET_W, { r: 0.03 });
  const ghost = new Mesh(gb.geometry('toon'), ghostMat);
  ghost.renderOrder = 2;
  const g = new Group();
  g.name = 'bar-magnet';
  g.add(body, ghost);
  const mats = model.mats.list();
  const self: BarMagnetModel = {
    group: g,
    body,
    n: model.anchor('n'),
    s: model.anchor('s'),
    length,
    peek: 0,
    update() {
      const p = self.peek;
      for (const m of mats) (m as unknown as { fade: number }).fade = 1 - p;
      body.visible = p < 0.99;
      ghost.visible = p > 0.01;
      ghostMat.fade = p;
    },
  };
  self.update();
  return self;
}
