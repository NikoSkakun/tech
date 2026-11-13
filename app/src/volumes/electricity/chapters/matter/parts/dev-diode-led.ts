/**
 * Step 9 devices, part 1: the rectifier diode and the LED — cut-open mini blocks on their pedestals.
 * Diode: a small p|n bar; an input dial whose needle swings with u_in, an output lamp that lights only on the
 * half-waves the diode passes. LED: a p|n chip under a dome lens; every recombination sends out a photon of
 * λ = 1240/E_g, and the dome takes that colour (UV / IR shown in the atom chapter's convention).
 */
import { Group, Mesh, Vector3 } from 'three';
import { createHalo, createPhotons, wavelengthToColor } from '@/fx';
import { Builder, G } from '@/kit';
import { K } from '@/style';

export function pnChip(b: Builder, w: number, h: number, d: number, at: [number, number, number]): void {
  b.box(w / 2, h, d, { r: 0.03, slot: 'glass', c: 'pink', at: [at[0] - w / 4, at[1], at[2]] });
  b.box(w / 2, h, d, { r: 0.03, slot: 'glass', c: 'teal', at: [at[0] + w / 4, at[1], at[2]] });
}

export interface RectifierDevice {
  group: Group;
  /** Input and output voltage, V (peak 5). */
  input: number;
  output: number;
  dial: Vector3;
  lampAt: Vector3;
  update(dt: number): void;
}

export function createRectifier(): RectifierDevice {
  const group = new Group();
  const b = new Builder('rectifier');
  pnChip(b, 1.1, 0.5, 0.5, [0, 0.45, 0]);
  b.box(0.08, 0.48, 0.48, { r: 0.02, c: 'mist', at: [0.42, 0.48, 0] }); // cathode stripe
  // input dial (left) and output lamp socket (right)
  b.box(0.36, 0.36, 0.16, { r: 0.05, c: ['bg.deep', 'slate'], at: [-0.88, 0.2, -0.25] });
  b.cyl(0.13, 0.03, { seg: 32, c: 'white', axis: 'z', at: [-0.88, 0.38, -0.17] });
  b.cyl(0.09, 0.2, { seg: 24, slot: 'metal', c: 'steel', at: [0.88, 0.2, -0.25] });
  b.sphere(0.13, { slot: 'glass', at: [0.88, 0.5, -0.25] });
  for (const [a, z] of [
    [-0.5, 0],
    [0.5, 0],
  ] as const)
    b.rod([a * 1.1, 0.45, z], [a * 1.76, 0.3, -0.25], 0.02, { c: 'ink' });
  group.add(b.build().group);
  const needle = new Mesh(G.box(0.02, 0.15, 0.01).translate(0, 0.07, 0), K.toon({ color: 'red' }));
  needle.position.set(-0.88, 0.32, -0.14);
  const fil = K.glow({ color: 'yellow', intensity: 0.2, keepHue: false });
  const bulb = new Mesh(G.sphere(0.06, 12), fil);
  bulb.position.set(0.88, 0.49, -0.25);
  const halo = createHalo({ color: 'yellow', size: 0.9, intensity: 0 });
  halo.position.copy(bulb.position);
  group.add(needle, bulb, halo);
  const dev: RectifierDevice = {
    group,
    input: 0,
    output: 0,
    dial: new Vector3(-0.88, 0.55, -0.15),
    lampAt: new Vector3(0.88, 0.7, -0.25),
    update() {
      needle.rotation.z = -(dev.input / 5) * (Math.PI / 3);
      const k = Math.max(dev.output / 4.5, 0);
      fil.intensity = 0.2 + 2.4 * k;
      halo.intensity = 1.4 * k;
    },
  };
  return dev;
}

export interface LedDevice {
  group: Group;
  /** Photon wavelength, nm. */
  wavelength: number;
  dome: Vector3;
  update(dt: number, t: number): void;
}

const PHOTONS = 7;

export function createLed(): LedDevice {
  const group = new Group();
  const b = new Builder('led');
  for (const x of [-0.12, 0.12]) b.cyl(0.025, 0.45, { seg: 8, slot: 'metal', c: 'mist', at: [x, 0.1, 0] });
  b.cyl(0.36, 0.08, { seg: 40, c: ['slate', 'steel'], at: [0, 0.5, 0] });
  pnChip(b, 0.36, 0.12, 0.2, [0, 0.62, 0]);
  group.add(b.build().group);
  const domeMat = K.glass({ color: 'red', opacity: 0.35, edgeOpacity: 0.9 });
  const dome = new Mesh(G.dome(0.34, 0.5, 40), domeMat);
  dome.position.y = 0.58;
  const glow = createHalo({ color: 'red', size: 1.2, intensity: 0.8 });
  glow.position.set(0, 0.7, 0);
  const photons = createPhotons({ count: PHOTONS, wavelength: 650, length: 0.35, amplitude: 0.05 });
  group.add(dome, glow, photons);
  let shown = -1;
  const dev: LedDevice = {
    group,
    wavelength: 653,
    dome: new Vector3(0, 1.0, 0.2),
    update(_dt, t) {
      if (Math.abs(shown - dev.wavelength) > 0.5) {
        shown = dev.wavelength;
        photons.setWavelength(shown);
        const c = wavelengthToColor(shown).color;
        domeMat.color.copy(c);
        glow.color.copy(c);
      }
      for (let i = 0; i < PHOTONS; i++) {
        const ph = (t * 0.7 + i / PHOTONS) % 1;
        const a = (i / PHOTONS) * Math.PI * 2 + i;
        const dir = new Vector3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize();
        const r = 0.1 + ph * 1.1;
        photons.setPhoton(
          i,
          [dir.x * r, 0.66 + dir.y * r, dir.z * r],
          [dir.x, dir.y, dir.z],
          t * 8,
          ph < 0.92 ? 1 : 0,
        );
      }
      photons.commit();
    },
  };
  return dev;
}
