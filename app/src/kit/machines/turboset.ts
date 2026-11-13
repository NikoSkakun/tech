/**
 * Turbine-generator set on its foundation table: steam turbine + turbogenerator + exciter on one shaft line —
 * the machine that almost every thermal, nuclear and many solar plants share (`plants` hub: `TurboSet`).
 * Shaft along X, operating floor at y = 0, shaft axis at `axisHeight`. Units: metres.
 *
 * Parts: `rotor`, `casingTop` (turbine), `gen.rotor`. Anchors: turbine anchors as in `steamTurbine`, generator
 * anchors prefixed `gen.` (`gen.u`, `gen.v`, `gen.w`, `gen.exciter`…).
 */
import { col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { addSteamTurbine, type SteamTurbineOptions } from './steam-turbine';
import { addTurbogenerator } from './turbogenerator';

export interface TurboSetOptions extends SteamTurbineOptions {
  /** Cutaway window of the generator, radians. Default 2.0. */
  cut?: number;
  /** Concrete foundation table under the machines. Default true. */
  deck?: boolean;
}

export interface TurboSet extends KitModel {
  /** Shaft speed in rad/s for `update` (both rotors turn together). */
  speed: number;
  readonly length: number;
  /** Lift the turbine's upper casing halves: 0 … 1. */
  setOpen(open: number): void;
}

export function turboSet(o: TurboSetOptions = {}): TurboSet {
  const ay = o.axisHeight ?? 3.2;
  const b = new Builder('turbo-set');
  const t = addSteamTurbine(b, { ...o, axisHeight: ay });
  let g = { length: 0, rotor: '' };
  b.frame({ at: [t.length, 0, 0] }, () => (g = addTurbogenerator(b, { cut: o.cut, axisHeight: ay })), 'gen.');
  const length = t.length + g.length;
  if (o.deck ?? true) {
    const slab = col('mist').lerp(col('steel.light'), 0.35);
    b.box(length + 3, 1.0, 9, { r: 0.2, slot: 'matte', c: [slab.clone().multiplyScalar(0.8), slab], at: [length / 2, -1.0, 0] });
    for (let i = 0; i <= Math.round(length / 7); i++) {
      for (const s of [-1, 1]) b.box(1.2, 6, 1.2, { r: 0.15, slot: 'matte', c: slab.clone().multiplyScalar(0.8), at: [(i / Math.round(length / 7)) * length, -7, s * 3.4] });
    }
    for (let i = 0; i < 14; i++) b.box(0.9, 0.04, 0.5, { r: 0, slot: 'matte', c: i % 2 ? 'yellow' : 'ink', at: [1 + i * 0.9, 0.01, 4.1] });
  }
  const model = b.build();
  const set: TurboSet = Object.assign(model, {
    speed: 2.5,
    length,
    setOpen: (open: number): void => void (model.part(t.top).position.y = ay + open * 5),
  });
  set.update = (dt) => {
    model.part(t.rotor).rotation.x += set.speed * dt;
    model.part(g.rotor).rotation.x += set.speed * dt;
  };
  return set;
}
