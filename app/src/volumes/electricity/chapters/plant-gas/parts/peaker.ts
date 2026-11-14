/**
 * Peaker: an aeroderivative gas turbine package — acoustic enclosure with vents, the inlet filter house on
 * top at the cold end, a short exhaust stack at the hot end, the generator enclosure and a step-up
 * transformer. Simple cycle: no boiler. Origin: ground under the centre; the shaft runs along X.
 */
import { Vector3 } from 'three';
import { Builder, addPowerTransformer, type KitModel } from '@/kit';
import { col } from '@/style';

export interface Peaker {
  model: KitModel;
  /** Top of the exhaust stack (local), where the heat haze rises. */
  exhaust: Vector3;
}

export function buildPeaker(): Peaker {
  const b = new Builder('peaker');
  const shell = col('mist').lerp(col('pink.light'), 0.18);
  b.box(30, 0.5, 12, { r: 0.15, slot: 'matte', c: ['steel', 'mist'], at: [0, 0, 0] });
  // turbine enclosure with vent stripes and a door
  b.box(14, 6, 5.6, { r: 0.35, c: [shell.clone().multiplyScalar(0.85), shell], at: [-1, 0.5, 0] });
  for (let k = 0; k < 5; k++) b.box(1.2, 2.2, 0.2, { r: 0.05, slot: 'metal', c: 'steel', at: [-6 + k * 2.4, 2.2, 2.85] });
  b.box(1.1, 2.4, 0.15, { r: 0.05, c: 'pink', at: [4.4, 0.5, 2.86] });
  // inlet filter house above the cold end
  b.box(5, 4.4, 6.6, { r: 0.3, c: ['white', 'mist'], at: [-6, 6.5, 0] });
  for (let k = 0; k < 4; k++) b.box(0.4, 0.4, 6.8, { r: 0.05, slot: 'metal', c: 'steel', at: [-8.4, 7 + k * 1, 0] });
  // exhaust stack at the hot end
  b.box(3.4, 3, 4, { r: 0.3, c: ['coral.dark', 'coral'], at: [7.4, 0.5, 0] });
  b.cyl(1.4, 13, { rTop: 1.25, seg: 24, slot: 'gloss', c: ['steel', 'mist'], at: [7.4, 3.4, 0] });
  b.cyl(1.32, 0.8, { seg: 24, slot: 'gloss', c: 'pink', at: [7.4, 15.2, 0] });
  // generator enclosure and the transformer
  b.box(7, 4.4, 4.6, { r: 0.3, c: ['teal.dark', 'teal'], at: [-12, 0.5, 0] });
  b.frame({ at: [-11, 0.5, -8.5], s: 0.55 }, () => addPowerTransformer(b, { hv: 110, lv: 10, fans: true }), 't.');
  const model = b.build();
  return { model, exhaust: new Vector3(7.4, 16.6, 0) };
}
