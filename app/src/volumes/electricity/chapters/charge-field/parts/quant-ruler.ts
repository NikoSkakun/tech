/**
 * Step 1 «шкала квантування»: a ruler whose ticks are whole multiples of the elementary charge. `set(n, unit)`
 * puts the marker at n elementary charges on a window of 11 ticks, `unit` electrons apart; the marker hops from
 * tick to tick (there is nothing in between: with `unit` = 1 every single electron is one tick).
 */
import { Group, Mesh, SphereGeometry } from 'three';
import { damp, toOverlay } from '@/engine/api';
import { createPulseRings } from '@/fx';
import { Builder } from '@/kit';
import { col, K, SEMANTIC } from '@/style';
import { Text3D } from '@/text';
import { fmtCount } from '../fmt';

const HALF = 5; // ticks each side of the window centre
const PITCH = 0.8; // scene units between ticks

export interface QuantRuler {
  group: Group;
  /** The hopping marker (callout anchor). */
  marker: Mesh;
  set(n: number, unit: number): void;
  update(dt: number, t: number): void;
}

export function createQuantRuler(): QuantRuler {
  const group = new Group();
  group.name = 'quant-ruler';
  const b = new Builder('quant-ruler');
  const w = PITCH * HALF * 2 + 0.9;
  b.box(w, 0.14, 0.62, { r: 0.07, c: ['bg.plum', 'slate'], at: [0, -0.14, 0] });
  b.box(w - 0.3, 0.03, 0.08, { r: 0, slot: 'metal', c: 'steel.light', at: [0, 0, 0.2] });
  for (let i = -HALF; i <= HALF; i++) {
    const major = i === 0 || Math.abs(i) === HALF;
    b.box(0.07, major ? 0.3 : 0.18, 0.07, {
      r: 0.02,
      slot: 'metal',
      c: major ? 'white' : 'steel.light',
      at: [i * PITCH, 0, -0.08],
    });
  }
  group.add(b.build().group);

  const glow = K.glow({ color: 'mist', whiten: 0.2, keepHue: true, intensity: 1.7 });
  const marker = new Mesh(new SphereGeometry(0.17, 24, 16), glow);
  const ping = createPulseRings({ color: 'mist', size: 0.9, amount: 2, intensity: 0.9 });
  marker.add(ping);
  group.add(marker);

  const label = (x: number): Text3D => {
    const t = new Text3D('0', {
      font: 'mono',
      size: 18,
      anchorX: 'center',
      anchorY: 'top',
      color: 'white',
      billboard: true,
      screenSpace: true,
    });
    t.position.set(x, -0.3, 0.42);
    group.add(t);
    return t;
  };
  const labels = [label(-HALF * PITCH), label(0), label(HALF * PITCH)];
  toOverlay(labels[0]!);
  toOverlay(labels[1]!);
  toOverlay(labels[2]!);

  let target = 0;
  let x = 0;
  let centre = Number.NaN;
  let unitNow = 0;
  const ruler: QuantRuler = {
    group,
    marker,
    set(n, unit) {
      const k = n / unit;
      // the window turns a "page" of ten ticks when the marker would leave it
      const c = Math.round(k / (2 * HALF)) * 2 * HALF;
      if (c !== centre || unit !== unitNow) {
        centre = c;
        unitNow = unit;
        labels.forEach((l, i) => (l.text = fmtCount((c + (i - 1) * HALF) * unit, true)));
        x = (k - c) * PITCH; // a new page / zoom: no slide across the whole ruler
      }
      target = (k - c) * PITCH;
      const tint = col(n > 0 ? SEMANTIC.proton : n < 0 ? SEMANTIC.electron : 'mist');
      glow.color.copy(tint);
      ping.color.copy(tint);
    },
    update(dt, t) {
      const before = x;
      x = damp(x, target, 14, dt);
      // a hop: the marker lifts while it travels and lands on the tick
      const moving = Math.min(Math.abs(target - x) / PITCH, 1);
      marker.position.set(x, 0.4 + 0.45 * Math.sin(moving * Math.PI) + 0.03 * Math.sin(t * 2.6), -0.08);
      marker.scale.setScalar(1 + 0.25 * Math.min(Math.abs(x - before) * 8, 1));
    },
  };
  ruler.set(0, 1);
  return ruler;
}
