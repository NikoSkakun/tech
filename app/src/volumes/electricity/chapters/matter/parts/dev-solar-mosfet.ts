/**
 * Step 9 devices, part 2. Solar cell: a thin n layer on a p slab; `yellow` photons rain in at a rate ∝ G,
 * every absorbed photon makes a pair, the junction field sends the electron up and the hole down, and the
 * external loop turns a little fan at ω ∝ G. MOSFET: p substrate, two n⁺ pockets (source, drain), a thin oxide
 * and the gate; the gate voltage pulls `cyan` electrons under the oxide into a channel and the drain lamp lights.
 */
import { Group, Mesh, Vector3 } from 'three';
import { createHalo, createOrbs, createPhotons } from '@/fx';
import { Builder, G } from '@/kit';
import { K } from '@/style';

const RAIN = 8;
const PAIRS = 10;

export interface SolarDevice {
  group: Group;
  /** 0…1 = G / 1000 W/m². */
  activity: number;
  fanAt: Vector3;
  update(dt: number, t: number): void;
}

export function createSolar(): SolarDevice {
  const group = new Group();
  const b = new Builder('solar');
  b.box(1.1, 0.34, 0.8, { r: 0.03, slot: 'glass', c: 'pink', at: [0, 0.3, 0] });
  b.box(1.1, 0.08, 0.8, { r: 0.02, slot: 'glass', c: 'teal', at: [0, 0.64, 0] });
  for (let k = 0; k < 4; k++)
    b.box(0.03, 0.02, 0.8, { r: 0, slot: 'metal', c: 'mist', at: [-0.4 + k * 0.27, 0.73, 0] });
  // the loop to the fan: up from the top grid, over, down from the back contact
  b.rod([0.55, 0.72, 0], [0.85, 1.0, 0], 0.02, { c: 'ink' });
  b.rod([0.55, 0.3, 0], [0.85, 0.3, 0], 0.02, { c: 'ink' });
  b.box(0.12, 0.75, 0.12, { r: 0.03, c: 'slate', at: [0.88, 0.25, 0] });
  group.add(b.build().group);
  const fan = new Group();
  fan.position.set(0.88, 1.08, 0.08);
  const blade = G.rbox(0.07, 0.34, 0.02, 0.01, 1).translate(0, 0.17, 0);
  for (let k = 0; k < 3; k++) {
    const m = new Mesh(blade, K.toon({ color: 'sky' }));
    m.rotation.z = (k * Math.PI * 2) / 3;
    fan.add(m);
  }
  fan.add(new Mesh(G.cyl(0.05, 0.05, { seg: 16 }).rotateX(Math.PI / 2), K.metal({ color: 'steel' })));
  const photons = createPhotons({ count: RAIN, color: 'yellow', length: 0.3, amplitude: 0.04 });
  const es = createOrbs({ kind: 'electron', count: PAIRS, radius: 0.045 });
  const hs = createOrbs({ kind: 'hole', count: PAIRS, radius: 0.055 });
  group.add(fan, photons, es, hs);
  let angle = 0;
  const dev: SolarDevice = {
    group,
    activity: 0.6,
    fanAt: new Vector3(0.88, 1.3, 0.1),
    update(dt, t) {
      const g = dev.activity;
      angle += dt * 9 * g;
      fan.rotation.z = -angle;
      for (let i = 0; i < RAIN; i++) {
        const ph = (t * 0.8 + i / RAIN) % 1;
        const x = -0.45 + ((i * 0.37) % 0.9);
        const on = i < Math.round(RAIN * g) ? 1 : 0;
        photons.setPhoton(i, [x, 1.6 - ph * 0.95, 0.1 * Math.sin(i)], [0, -1, 0], t * 8, ph < 0.97 ? on : 0);
      }
      photons.commit();
      for (let i = 0; i < PAIRS; i++) {
        // after absorption at the junction the pair splits: electron up into n, hole down into p
        const ph = (t * 0.6 + i / PAIRS) % 1;
        const x = -0.45 + ((i * 0.41) % 0.9);
        const on = i < Math.round(PAIRS * g) ? 1 : 0;
        es.setPosition(i, x, 0.6 + ph * 0.12, 0.42, on * (1 - ph * 0.5));
        hs.setPosition(i, x, 0.55 - ph * 0.35, 0.42, on * (1 - ph * 0.5));
      }
      es.commit();
      hs.commit();
    },
  };
  return dev;
}

export interface MosfetDevice {
  group: Group;
  /** 0…1 channel share. */
  channel: number;
  /** 0…1 lamp brightness. */
  lamp: number;
  oxide: Vector3;
  update(dt: number, t: number): void;
}

const CHANNEL = 14;

export function createMosfet(): MosfetDevice {
  const group = new Group();
  const b = new Builder('mosfet');
  b.box(1.2, 0.5, 0.7, { r: 0.03, slot: 'glass', c: 'pink', at: [0, 0.2, 0] });
  for (const s of [-1, 1]) {
    b.box(0.32, 0.18, 0.6, { r: 0.03, slot: 'glass', c: 'teal', at: [s * 0.4, 0.52, 0] });
    b.box(0.2, 0.08, 0.3, { r: 0.02, slot: 'metal', c: 'steel', at: [s * 0.4, 0.71, 0] });
    b.box(0.04, 0.25, 0.04, { r: 0, c: 'ink', at: [s * 0.4, 0.79, 0] });
  }
  b.box(0.5, 0.04, 0.5, { r: 0.01, slot: 'glass', c: 'white', at: [0, 0.71, 0] });
  b.box(0.46, 0.12, 0.46, { r: 0.02, slot: 'metal', c: 'mist', at: [0, 0.75, 0] });
  b.box(0.04, 0.25, 0.04, { r: 0, c: 'ink', at: [0, 0.87, 0] });
  // drain lamp on a little post to the right
  b.cyl(0.1, 0.5, { seg: 16, c: 'slate', at: [0.85, 0, 0.1] });
  b.sphere(0.16, { slot: 'glass', at: [0.85, 0.68, 0.1] });
  group.add(b.build().group);
  const ch = createOrbs({ kind: 'electron', count: CHANNEL, radius: 0.04 });
  const fil = K.glow({ color: 'yellow', intensity: 0.2, keepHue: false });
  const bulb = new Mesh(G.sphere(0.06, 12), fil);
  bulb.position.set(0.85, 0.66, 0.1);
  const halo = createHalo({ color: 'yellow', size: 0.9, intensity: 0 });
  halo.position.copy(bulb.position);
  group.add(ch, bulb, halo);
  const dev: MosfetDevice = {
    group,
    channel: 0,
    lamp: 0,
    oxide: new Vector3(0, 0.75, 0.3),
    update(_dt, t) {
      const n = Math.round(CHANNEL * dev.channel);
      for (let i = 0; i < CHANNEL; i++) {
        const x = -0.24 + (0.48 * i) / (CHANNEL - 1) + 0.02 * Math.sin(t * 3 + i);
        ch.setPosition(i, x, 0.64, 0.33 - 0.05 * (i % 3), i < n ? 1 : 0);
      }
      ch.commit();
      fil.intensity = 0.2 + 2.4 * dev.lamp;
      halo.intensity = 1.4 * dev.lamp;
    },
  };
  return dev;
}
