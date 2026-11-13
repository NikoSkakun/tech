/**
 * Cartridge fuse in a holder: a glass tube between two brass caps with a hair-thin wire inside («слабка
 * ланка»). `load` (0…1+) heats the wire `orange`; `blown` leaves two curled stubs and a sooty glass.
 * Terminals `a` (−X) and `b` (+X) at table level.
 */
import { CylinderGeometry, Mesh, type Group, type Object3D } from 'three';
import { Builder } from '@/kit';
import { K, col } from '@/style';

export interface Fuse {
  group: Group;
  a: Object3D;
  b: Object3D;
  /** Middle of the fuse wire (hotspot, spark origin). */
  wire: Object3D;
  /** Current relative to the rating (1 = rated current). */
  load: number;
  blown: boolean;
  /** False = holder without a cartridge (the «без запобіжника» case: a plain bridge takes its place). */
  installed: boolean;
  update(t: number): void;
}

export function createFuse(): Fuse {
  const b = new Builder('fuse');
  b.box(1.5, 0.16, 0.8, { r: 0.05, c: ['ink', 'slate'] });
  for (const s of [-1, 1] as const) {
    b.cyl(0.085, 0.14, { at: [s * 0.58, 0.14, 0.24], seg: 16, slot: 'metal', c: 'mist' });
    b.box(0.2, 0.34, 0.36, { at: [s * 0.42, 0.14, -0.08], r: 0.03, slot: 'metal', c: 'amber' }); // clips
  }
  const cart = b.part('cartridge', { at: [0, 0.4, -0.08] });
  for (const s of [-1, 1] as const)
    cart.cyl(0.14, 0.2, {
      at: [s * 0.52 - 0.1, 0, 0],
      axis: 'x',
      seg: 24,
      slot: 'metal',
      c: 'mist',
      bevel: 0.02,
    });
  cart.cyl(0.125, 0.66, { at: [-0.33, 0, 0], axis: 'x', seg: 28, slot: 'glass', open: true });
  const bridge = b.part('bridge', { at: [0, 0.4, -0.08] });
  bridge.cyl(0.06, 1.0, { at: [-0.5, 0, 0], axis: 'x', seg: 16, slot: 'metal', c: 'orange' }); // plain copper link
  b.anchor('a', -0.58, 0.16, 0.24).anchor('b', 0.58, 0.16, 0.24).anchor('wire', 0, 0.4, -0.08);
  const model = b.build();
  const cartridge = model.part('cartridge');
  const link = model.part('bridge');

  // the fuse wire: two halves, so that a blown fuse can show the gap
  const mat = K.glow({ color: 'steel', intensity: 0.6, falloff: 0, whiten: 0.3 });
  const half = new CylinderGeometry(0.014, 0.014, 0.32, 8);
  half.rotateZ(Math.PI / 2);
  const left = new Mesh(half, mat);
  const right = new Mesh(half, mat);
  cartridge.add(left, right);
  const cool = col('steel');
  const hot = col('orange');
  const tint = col('steel');
  const burnt = col('ink');
  let shown = Number.NaN;
  const self: Fuse = {
    group: model.group,
    a: model.anchor('a'),
    b: model.anchor('b'),
    wire: model.anchor('wire'),
    load: 0,
    blown: false,
    installed: true,
    update(t) {
      cartridge.visible = self.installed;
      link.visible = !self.installed;
      const gap = self.blown ? 0.1 : 0;
      left.position.set(-0.16 - gap, self.blown ? -0.03 : 0, 0);
      right.position.set(0.16 + gap, self.blown ? -0.03 : 0, 0);
      left.rotation.z = self.blown ? 0.35 : 0;
      right.rotation.z = self.blown ? -0.35 : 0;
      const k = self.blown ? 0 : Math.min(Math.max(self.load - 0.4, 0) / 1.2, 1);
      const key = self.blown ? -1 : Math.round(k * 40);
      if (key !== shown) {
        shown = key;
        mat.setColor(tint.copy(self.blown ? burnt : cool).lerp(hot, k));
      }
      mat.intensity = 0.6 + 2.2 * k * (1 + 0.1 * Math.sin(t * 20));
    },
  };
  return self;
}
