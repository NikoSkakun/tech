/**
 * Laboratory power supply («лабораторне джерело»): a `teal` box with two knobs, two displays (U and I), a CC
 * lamp and two binding posts on its base plate. The posts sit exactly where the AA holder has its terminals
 * (x = ±1.12, y = 0.16, z = 0), so a set can swap battery ↔ supply without re-routing its leads.
 * Displays are overlay tags (always legible); `set()` feeds them from the simulation.
 */
import { Mesh, SphereGeometry, type Group, type Object3D } from 'three';
import { fmtNumber } from '@/content';
import { Builder } from '@/kit';
import { K, SEMANTIC, UI_STATUS, type KGlowMaterial } from '@/style';
import type { Text3D } from '@/text';
import { tag } from '../world';

export interface Supply {
  group: Group;
  plus: Object3D;
  minus: Object3D;
  /** Front panel centre (labels, hotspots). */
  panel: Object3D;
  /** Left side of the box (callout that must not cover the displays). */
  side: Object3D;
  /** The CC indicator lamp (hotspot anchor). */
  ccLamp: Object3D;
  set(voltageV: number, currentA: number, constantCurrent?: boolean): void;
  update(t: number): void;
}

export function createSupply(): Supply {
  const b = new Builder('lab-supply');
  b.box(2.75, 0.1, 1.35, { at: [0, 0, -0.42], r: 0.04, c: ['ink', 'slate'] });
  b.box(1.9, 1.05, 1.0, { at: [0, 0.1, -0.5], r: 0.09, slot: 'gloss', c: ['teal.dark', 'teal'] });
  b.box(1.72, 0.82, 0.04, { at: [0, 0.22, 0.0], r: 0.03, c: 'ink' }); // front plate
  for (const x of [-0.42, 0.42]) {
    b.box(0.68, 0.3, 0.03, { at: [x, 0.66, 0.025], r: 0.03, c: 'bg.deep' }); // display windows
    b.cyl(0.14, 0.1, { at: [x, 0.42, 0.02], axis: 'z', seg: 24, slot: 'metal', c: 'steel.light' }); // knobs
    b.box(0.03, 0.1, 0.02, { at: [x, 0.44, 0.12], r: 0, c: 'white' });
  }
  for (let k = 0; k < 6; k++)
    b.box(0.05, 0.6, 0.5, { at: [-0.6 + k * 0.24, 0.4, -1.02], r: 0.015, slot: 'metal', c: 'steel' }); // heat sink
  for (const s of [-1, 1] as const) {
    b.cyl(0.1, 0.18, {
      at: [s * 1.12, 0.08, 0],
      seg: 18,
      slot: 'gloss',
      c: s > 0 ? SEMANTIC.dcPlus : SEMANTIC.dcMinus,
    });
    b.cyl(0.05, 0.06, { at: [s * 1.12, 0.26, 0], seg: 12, slot: 'metal', c: 'mist' });
  }
  b.anchor('side', -0.95, 0.6, -0.2)
    .anchor('plus', 1.12, 0.16, 0)
    .anchor('minus', -1.12, 0.16, 0)
    .anchor('panel', 0, 0.62, 0.05)
    .anchor('cc', 0, 0.42, 0.05);
  const model = b.build();
  const ccMat: KGlowMaterial = K.glow({
    color: UI_STATUS.warning,
    intensity: 0.25,
    falloff: 0,
    whiten: 0,
    keepHue: true,
  });
  const cc = new Mesh(new SphereGeometry(0.055, 14, 10), ccMat);
  cc.position.set(0, 0.42, 0.04);
  const uTag: Text3D = tag('0,0 V', 18, 'lime', 'mono');
  uTag.position.set(-0.56, 1.36, -0.3);
  const iTag: Text3D = tag('0,00 A', 18, 'yellow', 'mono');
  iTag.position.set(0.56, 1.36, -0.3);
  model.group.add(cc, uTag, iTag);
  let ccOn = false;
  let shown = '';
  return {
    group: model.group,
    plus: model.anchor('plus'),
    minus: model.anchor('minus'),
    panel: model.anchor('panel'),
    side: model.anchor('side'),
    ccLamp: model.anchor('cc'),
    set(voltageV, currentA, constantCurrent = false) {
      const key = `${voltageV.toFixed(2)}|${currentA.toFixed(2)}`;
      if (key !== shown) {
        shown = key;
        uTag.text = `${fmtNumber(voltageV, { digits: 1 })} V`;
        iTag.text = `${fmtNumber(currentA, { digits: 2 })} A`;
      }
      ccOn = constantCurrent;
    },
    update(t) {
      ccMat.intensity = ccOn ? 1.5 + 0.25 * Math.sin(t * 6) : 0.25;
    },
  };
}
