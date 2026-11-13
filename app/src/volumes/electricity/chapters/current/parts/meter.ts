/**
 * Round panel meter (ammeter / voltmeter): a tilted dial with a needle on a bakelite base, plus an overlay tag
 * with the exact reading. `value` is the needle deflection 0…1 (the caller normalises by the scale end);
 * the needle is damped like a real moving-coil movement. Terminals `a` (−X) and `b` (+X).
 */
import type { Group, Object3D } from 'three';
import { damp } from '@/engine/api';
import { Builder } from '@/kit';
import type { ColorLike } from '@/style';
import type { Text3D } from '@/text';
import { tag } from '../world';

export interface Meter {
  group: Group;
  a: Object3D;
  b: Object3D;
  /** Centre of the dial (labels, hotspots). */
  dial: Object3D;
  /** Needle target 0…1. */
  value: number;
  /** Exact reading shown under the dial («0,29 A»). */
  text: string;
  /** Tag colour (e.g. `green` when two meters agree). */
  color: ColorLike;
  update(dt: number): void;
}

const SWEEP = 1.9; // rad, total needle travel

export function createMeter(kind: 'A' | 'V', scale = 1): Meter {
  const accent: ColorLike = kind === 'A' ? 'amber' : 'teal';
  const b = new Builder(`meter-${kind}`);
  b.box(1.5, 0.16, 0.8, { r: 0.05, c: ['ink', 'slate'] });
  for (const s of [-1, 1] as const) {
    b.cyl(0.085, 0.14, { at: [s * 0.58, 0.14, 0.24], seg: 16, slot: 'metal', c: 'mist' });
    b.cyl(0.05, 0.05, { at: [s * 0.58, 0.28, 0.24], seg: 12, slot: 'metal', c: 'steel' });
  }
  // the instrument head leans back 35° so the dial faces the usual 3/4 camera
  b.frame({ at: [0, 0.16, -0.1], rot: [-0.6, 0, 0] }, () => {
    b.cyl(0.56, 0.3, {
      axis: 'z',
      at: [0, 0.56, -0.15],
      seg: 48,
      slot: 'gloss',
      c: ['ink', 'slate'],
      bevel: 0.05,
    });
    b.cyl(0.48, 0.03, { axis: 'z', at: [0, 0.56, 0.15], seg: 48, c: 'white', bevel: 0.005 });
    b.ring(0.5, 0.04, { axis: 'z', at: [0, 0.56, 0.17], seg: 48, slot: 'metal', c: accent });
    // scale ticks along the arc
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI / 2 + SWEEP / 2 - (SWEEP * k) / 10;
      const long = k % 5 === 0;
      const r = long ? 0.37 : 0.39;
      b.box(0.022, long ? 0.1 : 0.06, 0.01, {
        at: [Math.cos(a) * r, 0.38 + Math.sin(a) * r, 0.185],
        rot: [0, 0, a - Math.PI / 2],
        r: 0,
        mid: true,
        c: 'ink',
      });
    }
    b.cyl(0.07, 0.05, { axis: 'z', at: [0, 0.38, 0.18], seg: 20, slot: 'metal', c: 'steel' });
    b.box(0.3, 0.1, 0.012, { at: [0, 0.2, 0.185], r: 0.03, c: accent }); // the «A» / «V» badge plate
    const needle = b.part('needle', { at: [0, 0.38, 0.2] });
    needle.box(0.028, 0.42, 0.012, { at: [0, -0.04, 0], r: 0, c: 'coral' });
    b.anchor('dial', 0, 0.56, 0.2);
  });
  b.anchor('a', -0.58, 0.16, 0.24).anchor('b', 0.58, 0.16, 0.24);
  const model = b.build();
  model.group.scale.setScalar(scale);
  const needle = model.part('needle');
  const label: Text3D = tag(`0 ${kind}`, 20, 'white', 'mono');
  label.position.set(0, 0.12, 0.72);
  model.group.add(label);
  let shown = 0;
  let text = '';
  let color: ColorLike = 'white';
  const self: Meter = {
    group: model.group,
    a: model.anchor('a'),
    b: model.anchor('b'),
    dial: model.anchor('dial'),
    value: 0,
    get text() {
      return text;
    },
    set text(v: string) {
      if (v !== text) label.text = text = v;
    },
    get color() {
      return color;
    },
    set color(c: ColorLike) {
      if (c !== color) label.color = color = c;
    },
    update(dt) {
      shown = damp(shown, Math.min(Math.max(self.value, 0), 1.04), 7, dt);
      needle.rotation.z = SWEEP / 2 - SWEEP * shown;
    },
  };
  return self;
}
