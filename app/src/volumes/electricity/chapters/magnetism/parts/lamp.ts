/**
 * Bench lamps. `createLamp` — an incandescent bulb on a socket: glass globe, a filament that glows `yellow`
 * with `brightness` 0…1 and a halo. `createNeon` — a small neon glow lamp whose gas lights `orange`-pink.
 * Origin: bottom of the socket; terminals `a` / `b` at the socket sides.
 */
import { Mesh, SphereGeometry, type Group, type Object3D } from 'three';
import { createHalo } from '@/fx';
import { Builder } from '@/kit';
import { K } from '@/style';
import { glow } from '../world';

export interface LampModel {
  group: Group;
  a: Object3D;
  b: Object3D;
  top: Object3D;
  brightness: number;
  update(): void;
}

export function createLamp(s = 1, neon = false): LampModel {
  const b = new Builder(neon ? 'neon' : 'lamp');
  b.box(0.5 * s, 0.14 * s, 0.4 * s, { r: 0.04 * s, c: ['ink', 'slate'] });
  b.cyl(0.13 * s, 0.22 * s, { at: [0, 0.14 * s, 0], seg: 20, slot: 'metal', c: 'mist' });
  for (const x of [-0.19, 0.19]) b.cyl(0.04 * s, 0.06 * s, { at: [x * s, 0.14 * s, 0.1 * s], seg: 10, slot: 'metal', c: 'amber' });
  b.anchor('a', -0.19 * s, 0.2 * s, 0.1 * s).anchor('b', 0.19 * s, 0.2 * s, 0.1 * s).anchor('top', 0, 0.75 * s, 0);
  const model = b.build();
  const r = (neon ? 0.15 : 0.24) * s;
  const globe = new Mesh(new SphereGeometry(r, 32, 20), K.glass({ color: neon ? 'pink' : 'white', opacity: 0.16, edgeOpacity: 0.6 }));
  globe.position.y = 0.36 * s + r * 0.85;
  globe.renderOrder = 3;
  const fil = glow(neon ? 'orange' : 'yellow', 0);
  const filament = new Mesh(neon ? new SphereGeometry(r * 0.55, 16, 10) : new SphereGeometry(r * 0.22, 12, 8), fil);
  filament.position.copy(globe.position);
  if (!neon) filament.scale.set(1.6, 0.6, 0.6);
  const halo = createHalo({ color: neon ? 'pink' : 'yellow', size: r * 5, intensity: 0 });
  halo.position.copy(globe.position);
  model.group.add(globe, filament, halo);
  model.group.traverse((o) => ((o as Mesh).castShadow = o !== globe));
  const self: LampModel = {
    group: model.group,
    a: model.anchor('a'),
    b: model.anchor('b'),
    top: model.anchor('top'),
    brightness: 0,
    update() {
      const v = Math.min(Math.max(self.brightness, 0), 1.5);
      fil.intensity = 0.15 + 1.8 * v;
      halo.intensity = 1.3 * v;
      halo.visible = v > 0.01;
    },
  };
  self.update();
  return self;
}
