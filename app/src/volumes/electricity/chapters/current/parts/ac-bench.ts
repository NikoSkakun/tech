/**
 * Step 10 props: the oscilloscope (fx `Scope` in a toy casing), the mains socket module («230 V ~ 50 Hz») and
 * the Oersted rig — a straight wire stretched north–south over a compass, with faint `magenta` rings of the
 * wire's magnetic field as a teaser for the next chapter.
 */
import { type Group, Mesh, TorusGeometry, type Object3D } from 'three';
import { createScope, type Scope } from '@/fx';
import { Builder } from '@/kit';
import { K, SEMANTIC, type KGlowMaterial } from '@/style';

export interface ScopeBox {
  group: Group;
  scope: Scope;
  /** Top of the casing (callout). */
  top: Object3D;
  /** Probe sockets on the front (the sense leads start here). */
  left: Object3D;
  right: Object3D;
}

export function createScopeBox(): ScopeBox {
  const b = new Builder('scope-box');
  b.box(2.3, 0.1, 1.1, { at: [0, 0, -0.2], r: 0.04, c: ['ink', 'slate'] });
  b.frame({ at: [0, 0.1, 0], rot: [-0.3, 0, 0] }, () => {
    b.box(2.1, 1.75, 0.8, { at: [0, 0, -0.42], r: 0.1, slot: 'gloss', c: ['slate', 'steel'] });
    b.box(1.9, 1.3, 0.04, { at: [0, 0.38, 0], r: 0.05, c: 'ink' }); // bezel
    for (let k = 0; k < 4; k++)
      b.cyl(0.07, 0.06, {
        at: [-0.75 + k * 0.5, 0.2, 0.0],
        axis: 'z',
        seg: 16,
        slot: 'metal',
        c: k === 0 ? 'amber' : 'steel.light',
      });
    b.anchor('screen', 0, 1.03, 0.03)
      .anchor('top', 0, 1.8, -0.4)
      .anchor('left', -0.75, 0.2, 0.08)
      .anchor('right', 0.75, 0.2, 0.08);
  });
  const model = b.build();
  const scope = createScope({
    width: 1.8,
    height: 1.16,
    channels: [SEMANTIC.phaseL1],
    samples: 160,
    lineWidth: 0.035,
  });
  const holder = model.anchor('screen');
  holder.rotation.x = -0.3;
  holder.add(scope);
  return {
    group: model.group,
    scope,
    top: model.anchor('top'),
    left: model.anchor('left'),
    right: model.anchor('right'),
  };
}

/** Mains socket module with terminals `a` (−X) / `b` (+X), like the battery holder but narrower (1.16 apart). */
export function createSocketModule(): { group: Group; a: Object3D; b: Object3D; top: Object3D } {
  const b = new Builder('socket-module');
  b.box(1.5, 0.16, 0.9, { r: 0.05, c: ['ink', 'slate'] });
  for (const s of [-1, 1] as const)
    b.cyl(0.085, 0.14, { at: [s * 0.58, 0.14, 0.28], seg: 16, slot: 'metal', c: 'mist' });
  b.box(1.0, 1.0, 0.5, { at: [0, 0.16, -0.12], r: 0.1, slot: 'gloss', c: ['mist', 'white'] });
  b.cyl(0.36, 0.06, { at: [0, 0.66, 0.1], axis: 'z', seg: 36, c: 'steel' }); // recess
  for (const s of [-1, 1] as const)
    b.cyl(0.05, 0.03, { at: [s * 0.14, 0.66, 0.15], axis: 'z', seg: 12, c: 'ink' });
  b.box(0.05, 0.08, 0.04, { at: [0, 0.94, 0.14], r: 0, slot: 'metal', c: 'mist' }); // earth clips
  b.box(0.05, 0.08, 0.04, { at: [0, 0.3, 0.14], r: 0, slot: 'metal', c: 'mist' });
  b.anchor('a', -0.58, 0.16, 0.28).anchor('b', 0.58, 0.16, 0.28).anchor('top', 0, 1.25, 0);
  const m = b.build();
  return { group: m.group, a: m.anchor('a'), b: m.anchor('b'), top: m.anchor('top') };
}

export interface OerstedRig {
  group: Group;
  /** Foot terminals of the south and north posts. */
  south: Object3D;
  north: Object3D;
  compass: Object3D;
  wire: Object3D;
  /** Needle angle from north, rad (positive = N end toward west, −X). */
  angle: number;
  /** 0…1 strength of the field rings. */
  field: number;
  update(t: number): void;
}

/** Wire along Z (north = −Z) from z = −1.3 to z = +1.3 at height 0.8; compass under its middle. */
export function createOerstedRig(): OerstedRig {
  const b = new Builder('oersted');
  for (const z of [-1.3, 1.3]) {
    b.box(0.5, 0.1, 0.5, { at: [0, 0, z], r: 0.04, c: ['ink', 'slate'] });
    b.cyl(0.06, 0.78, { at: [0, 0.1, z], seg: 12, slot: 'gloss', c: 'white' });
    b.cyl(0.085, 0.14, { at: [0.2, 0.1, z], seg: 16, slot: 'metal', c: 'mist' });
  }
  b.rod([0, 0.86, -1.3], [0, 0.86, 1.3], 0.045, { slot: 'metal', c: 'orange' });
  // compass: brass case, white card with the four marks, north mark in coral
  b.cyl(0.7, 0.16, { seg: 48, slot: 'metal', c: 'amber', bevel: 0.03 });
  b.cyl(0.62, 0.02, { at: [0, 0.16, 0], seg: 48, c: 'white' });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    b.box(0.03, 0.012, k % 3 ? 0.07 : 0.14, {
      at: [Math.sin(a) * 0.52, 0.18, -Math.cos(a) * 0.52],
      rot: [0, -a, 0],
      r: 0,
      c: k === 0 ? 'coral' : 'ink',
    });
  }
  b.cyl(0.04, 0.1, { at: [0, 0.16, 0], seg: 12, slot: 'metal', c: 'mist' });
  const needle = b.part('needle', { at: [0, 0.27, 0] });
  // a little magnet: N half coral (points −Z at rest), S half blue
  needle.box(0.1, 0.03, 0.46, { at: [0, 0, -0.23], r: 0.012, mid: true, c: SEMANTIC.poleN });
  needle.box(0.1, 0.03, 0.46, { at: [0, 0, 0.23], r: 0.012, mid: true, c: SEMANTIC.poleS });
  b.anchor('south', 0.2, 0.16, 1.3)
    .anchor('north', 0.2, 0.16, -1.3)
    .anchor('compass', 0.45, 0.3, 0.45)
    .anchor('wire', 0, 0.9, -0.7);
  const model = b.build();
  const hand = model.part('needle');
  const ringMat: KGlowMaterial = K.glow({
    color: SEMANTIC.fieldB,
    intensity: 0,
    falloff: 0,
    whiten: 0,
    keepHue: true,
  });
  const rings = [-0.75, 0, 0.75].map((z) => {
    const ring = new Mesh(new TorusGeometry(0.42, 0.018, 8, 48), ringMat);
    ring.position.set(0, 0.86, z);
    model.group.add(ring);
    return ring;
  });
  const self: OerstedRig = {
    group: model.group,
    south: model.anchor('south'),
    north: model.anchor('north'),
    compass: model.anchor('compass'),
    wire: model.anchor('wire'),
    angle: 0,
    field: 0,
    update(t) {
      hand.rotation.y = self.angle;
      ringMat.intensity = 1.1 * self.field;
      rings.forEach((ring, k) => {
        ring.visible = self.field > 0.01;
        ring.scale.setScalar(1 + 0.06 * Math.sin(t * 2.4 + k * 2.1));
      });
    },
  };
  return self;
}
