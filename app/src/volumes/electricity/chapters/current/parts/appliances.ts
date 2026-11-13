/**
 * The appliance shelf of step 6: seven toy household appliances (LED lamp, phone charger, laptop, TV,
 * microwave, kettle, heater). Each is a static body plus a "light" layer (`glow` slot: screen, lamp, heating
 * element) whose brightness follows `level` 0…1 — the appliance coming alive when it is switched on.
 * Origin = centre of the footprint; `inlet` = where its supply lead arrives (back side, table level).
 */
import { Vector3, type Group, type Object3D } from 'three';
import { damp } from '@/engine/api';
import { Builder, G } from '@/kit';
import type { KGlowMaterial } from '@/style';
import type { ApplianceId } from '@electricity/sim/current';

export interface Appliance {
  id: ApplianceId;
  group: Group;
  inlet: Vector3;
  /** Label / hotspot anchor above the appliance. */
  top: Object3D;
  on: boolean;
  /** Eased 0…1. */
  readonly level: number;
  update(dt: number, t: number): void;
}

type Draw = (body: Builder, light: Builder) => number; // returns the height of the `top` anchor

const DRAW: Record<ApplianceId, Draw> = {
  led: (b, l) => {
    b.cyl(0.2, 0.06, { seg: 24, c: 'slate' });
    b.cyl(0.035, 0.5, { at: [0, 0.06, 0], seg: 10, slot: 'metal', c: 'mist' });
    b.cyl(0.13, 0.16, { at: [0, 0.52, 0], seg: 20, c: 'white' });
    l.sphere(0.2, { slot: 'glow', at: [0, 0.82, 0], seg: 20, c: 'yellow' });
    return 1.1;
  },
  charger: (b, l) => {
    b.box(0.26, 0.3, 0.2, { at: [-0.22, 0, -0.1], r: 0.04, slot: 'gloss', c: 'white' });
    b.box(0.36, 0.05, 0.66, { at: [0.2, 0, 0.05], r: 0.02, c: 'ink' }); // phone
    b.tube([new Vector3(-0.22, 0.1, 0), new Vector3(-0.1, 0.03, 0.3), new Vector3(0.2, 0.03, 0.42)], 0.018, {
      c: 'white',
    });
    l.box(0.3, 0.012, 0.56, { slot: 'glow', at: [0.2, 0.05, 0.05], r: 0.01, c: 'green' }); // charging screen
    return 0.55;
  },
  laptop: (b, l) => {
    b.box(0.8, 0.045, 0.55, { r: 0.02, slot: 'metal', c: 'mist' });
    b.box(0.8, 0.52, 0.035, { at: [0, 0.03, -0.3], rot: [-0.22, 0, 0], r: 0.02, slot: 'metal', c: 'mist' });
    l.box(0.72, 0.44, 0.012, { slot: 'glow', at: [0, 0.07, -0.28], rot: [-0.22, 0, 0], r: 0.01, c: 'sky' });
    return 0.8;
  },
  tv: (b, l) => {
    b.box(0.5, 0.05, 0.26, { r: 0.02, c: 'ink' });
    b.box(0.08, 0.14, 0.06, { at: [0, 0.04, 0], r: 0.01, c: 'ink' });
    b.box(1.0, 0.6, 0.06, { at: [0, 0.16, 0], r: 0.03, c: 'ink' });
    l.box(0.92, 0.52, 0.012, { slot: 'glow', at: [0, 0.2, 0.032], r: 0.01, c: 'violet' });
    return 1.0;
  },
  microwave: (b, l) => {
    b.box(1.0, 0.6, 0.62, { r: 0.05, slot: 'gloss', c: ['steel', 'white'] });
    b.box(0.2, 0.5, 0.02, { at: [0.36, 0.05, 0.31], r: 0.02, c: 'ink' }); // control strip
    b.cyl(0.05, 0.03, { at: [0.36, 0.14, 0.32], axis: 'z', seg: 14, slot: 'metal', c: 'mist' });
    b.box(0.62, 0.42, 0.02, { at: [-0.12, 0.09, 0.31], r: 0.03, c: 'ink' });
    l.box(0.54, 0.34, 0.012, { slot: 'glow', at: [-0.12, 0.13, 0.322], r: 0.02, c: 'amber' }); // lit cavity window
    return 0.85;
  },
  kettle: (b, l) => {
    b.cyl(0.36, 0.08, { seg: 32, c: 'ink' }); // power base
    const body: [number, number][] = [
      [0.3, 0.08],
      [0.34, 0.2],
      [0.33, 0.6],
      [0.26, 0.86],
      [0.2, 0.9],
      [0.001, 0.93],
    ];
    b.add(G.lathe(G.fillet(body, 0.05), { seg: 36 }), { slot: 'gloss', c: ['teal.dark', 'teal'] });
    b.cyl(0.07, 0.07, { at: [0, 0.92, 0], seg: 14, c: 'ink' }); // lid knob
    b.tube([new Vector3(0.3, 0.72, 0), new Vector3(0.44, 0.84, 0), new Vector3(0.5, 0.86, 0)], 0.06, {
      c: 'teal',
    }); // spout
    b.tube(
      [
        new Vector3(-0.3, 0.8, 0),
        new Vector3(-0.58, 0.7, 0),
        new Vector3(-0.56, 0.36, 0),
        new Vector3(-0.33, 0.26, 0),
      ],
      0.045,
      { c: 'ink' },
    );
    b.box(0.07, 0.42, 0.03, { at: [0, 0.3, 0.325], r: 0.01, slot: 'glass' }); // level window
    l.ring(0.24, 0.035, { slot: 'glow', at: [0, 0.13, 0], seg: 28, c: 'orange' }); // heating element seen through the base seam
    l.sphere(0.035, { slot: 'glow', at: [0.12, 0.1, 0.34], seg: 10, c: 'coral' }); // pilot light
    return 1.25;
  },
  heater: (b, l) => {
    b.box(1.0, 0.1, 0.4, { r: 0.03, c: 'ink' });
    b.box(1.0, 0.72, 0.1, { at: [0, 0.08, -0.14], r: 0.04, slot: 'gloss', c: ['slate', 'steel'] });
    for (const x of [-0.46, 0.46]) b.box(0.06, 0.72, 0.34, { at: [x, 0.08, 0], r: 0.02, c: 'steel' });
    for (let k = 0; k < 5; k++)
      b.rod([-0.44, 0.2 + k * 0.13, 0.12], [0.44, 0.2 + k * 0.13, 0.12], 0.012, { slot: 'metal', c: 'mist' }); // guard
    for (let k = 0; k < 3; k++)
      l.cyl(0.035, 0.84, { slot: 'glow', at: [-0.42, 0.27 + k * 0.19, 0], axis: 'x', seg: 12, c: 'orange' }); // glowing rods
    return 1.1;
  },
};

export function createAppliance(id: ApplianceId): Appliance {
  const body = new Builder(`appliance-${id}`);
  const light = new Builder(`appliance-${id}-light`);
  const h = DRAW[id](body, light);
  // every shape of the light layer goes to the `glow` slot: one material whose intensity is the on-level
  body.anchor('top', 0, h, 0);
  const model = body.build();
  const lit = light.build();
  model.group.add(lit.group);
  const mat = lit.mats.get('glow') as KGlowMaterial;
  let level = 0;
  const self: Appliance = {
    id,
    group: model.group,
    inlet: new Vector3(0, 0.075, -0.5),
    top: model.anchor('top'),
    on: false,
    get level() {
      return level;
    },
    update(dt, t) {
      level = damp(level, self.on ? 1 : 0, 6, dt);
      // screens flicker a little, heaters breathe: nothing that is on is perfectly still
      mat.intensity = 0.12 + level * (1.45 + 0.08 * Math.sin(t * (id === 'tv' ? 9 : 3) + id.length));
    },
  };
  return self;
}
