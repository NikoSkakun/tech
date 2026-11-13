/**
 * The electricity meter of step 6 — an induction meter in toy form: the aluminium disc turns at a rate ∝ power
 * (that is the «стрілка потужності» — how fast the digits run), the register shows the accumulated energy in
 * kWh (an overlay tag fed by the simulation). Also the 230 V busbar the appliances hang on.
 */
import type { Group, Object3D } from 'three';
import { fmtNumber } from '@/content';
import { Builder } from '@/kit';
import type { Text3D } from '@/text';
import { tag } from '../world';

export interface EnergyMeter {
  group: Group;
  top: Object3D;
  /** Where the feeder to the busbar leaves the meter. */
  out: Object3D;
  /** Power as a fraction of the dial's full scale (drives the disc speed and the needle). */
  power: number;
  energyKWh: number;
  update(dt: number): void;
}

export function createEnergyMeter(): EnergyMeter {
  const b = new Builder('energy-meter');
  b.box(1.9, 0.12, 0.9, { r: 0.04, c: ['ink', 'slate'] });
  b.box(1.6, 1.5, 0.62, { at: [0, 0.12, -0.05], r: 0.1, slot: 'gloss', c: ['steel', 'white'] });
  b.box(1.36, 0.36, 0.03, { at: [0, 1.12, 0.26], r: 0.04, c: 'bg.deep' }); // register window
  b.box(1.36, 0.2, 0.05, { at: [0, 0.52, 0.26], r: 0.03, c: 'ink' }); // disc slot
  b.cyl(0.3, 0.05, { at: [0, 0.2, 0.27], axis: 'z', seg: 32, c: 'white' }); // power dial
  b.box(0.5, 0.22, 0.3, { at: [0, 0.12, 0.3], r: 0.04, c: 'slate' }); // terminal cover
  const disc = b.part('disc', { at: [0, 0.62, 0.05] });
  disc.cyl(0.62, 0.035, { at: [0, -0.0175, 0], seg: 48, slot: 'metal', c: 'mist' });
  disc.box(0.1, 0.04, 0.02, { at: [0.57, -0.02, 0], r: 0, c: 'coral' }); // the red mark that lets you see it turn
  const needle = b.part('needle', { at: [0, 0.2, 0.33] });
  needle.box(0.03, 0.26, 0.012, { at: [0, -0.02, 0], r: 0, c: 'coral' });
  b.anchor('top', 0, 1.72, 0).anchor('out', 0, 0.3, 0.45).anchor('register', 0, 1.3, 0.3);
  const model = b.build();
  const wheel = model.part('disc');
  const hand = model.part('needle');
  const digits: Text3D = tag('', 21, 'yellow', 'mono');
  model.anchor('register').add(digits);
  let shown = '';
  const self: EnergyMeter = {
    group: model.group,
    top: model.anchor('top'),
    out: model.anchor('out'),
    power: 0,
    energyKWh: 0,
    update(dt) {
      wheel.rotation.y -= self.power * 9 * dt;
      hand.rotation.z = 1.9 / 2 - 1.9 * Math.min(Math.max(self.power, 0), 1);
      const text = `${fmtNumber(self.energyKWh, { digits: 3 })} kWh`;
      if (text !== shown) digits.text = shown = text;
    },
  };
  return self;
}

/** Bronze busbar on insulator posts, along X, `length` long; origin = centre on the table. */
export function createBusbar(length: number, y = 0.3): Group {
  const b = new Builder('busbar');
  b.box(length, 0.1, 0.16, { at: [0, y - 0.05, 0], r: 0.03, slot: 'metal', c: 'amber' });
  for (let x = -length / 2 + 0.3; x <= length / 2 - 0.25; x += (length - 0.6) / 4) {
    b.cyl(0.07, y - 0.05, { at: [x, 0, 0], seg: 14, slot: 'gloss', c: 'white' });
    b.cyl(0.035, 0.05, { at: [x, y + 0.05, 0], seg: 10, slot: 'metal', c: 'mist' });
  }
  return b.build().group;
}
