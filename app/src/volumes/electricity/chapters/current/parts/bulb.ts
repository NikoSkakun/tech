/**
 * Incandescent lamp on a bakelite base: glass envelope, tungsten coil between two support wires, screw cap.
 * `brightness` (0…1, perceptual — the simulations return it) drives the coil from dull `orange` through
 * `yellow` to white-hot and a halo around the glass. `burnt` leaves a dark broken coil.
 * Terminals `a` (−X) and `b` (+X) sit on the base at table level.
 */
import { Color, Mesh, SphereGeometry, TorusGeometry, type Group, type Object3D } from 'three';
import { createHalo } from '@/fx';
import { Builder, G } from '@/kit';
import { K, col } from '@/style';

export interface Bulb {
  group: Group;
  a: Object3D;
  b: Object3D;
  /** Centre of the glass (labels, halo, hotspots). */
  glass: Object3D;
  brightness: number;
  burnt: boolean;
  update(t: number): void;
}

const COLD = col('slate');
const WARM = col('orange');
const HOT = col('yellow');
const WHITE = col('white');

export function createBulb(scale = 1): Bulb {
  const b = new Builder('bulb');
  // base block with two screw terminals
  b.box(1.5, 0.16, 0.8, { r: 0.05, c: ['ink', 'slate'] });
  for (const s of [-1, 1] as const) {
    b.cyl(0.085, 0.14, { at: [s * 0.58, 0.14, 0], seg: 16, slot: 'metal', c: 'mist' });
    b.cyl(0.05, 0.05, { at: [s * 0.58, 0.28, 0], seg: 12, slot: 'metal', c: 'steel' });
  }
  // socket + threaded cap
  b.cyl(0.3, 0.2, { at: [0, 0.14, 0], seg: 32, c: 'slate' });
  b.cyl(0.23, 0.3, { at: [0, 0.32, 0], seg: 32, slot: 'metal', c: 'mist', bevel: 0.02 });
  for (let k = 0; k < 3; k++)
    b.ring(0.235, 0.022, { at: [0, 0.38 + k * 0.08, 0], seg: 32, slot: 'metal', c: 'steel' });
  // glass stem and the two support wires
  b.cyl(0.07, 0.3, { at: [0, 0.6, 0], rTop: 0.04, seg: 16, slot: 'glass' });
  b.rod([-0.05, 0.62, 0], [-0.2, 1.12, 0], 0.014, { slot: 'metal', c: 'steel' });
  b.rod([0.05, 0.62, 0], [0.2, 1.12, 0], 0.014, { slot: 'metal', c: 'steel' });
  // envelope: pear-shaped lathe (bottom → top)
  const pear: [number, number][] = [
    [0.2, 0.6],
    [0.24, 0.78],
    [0.42, 1.0],
    [0.5, 1.22],
    [0.46, 1.46],
    [0.3, 1.64],
    [0.001, 1.72],
  ];
  b.add(G.lathe(G.fillet(pear, 0.08), { seg: 40 }), { slot: 'glass' });
  b.anchor('a', -0.58, 0.16, 0).anchor('b', 0.58, 0.16, 0).anchor('glass', 0, 1.2, 0);
  const model = b.build();
  model.group.scale.setScalar(scale);

  // tungsten coil: a small torus arc between the supports (own glow material — it is the animated part)
  const coilMat = K.glow({ color: 'orange', intensity: 0.2, falloff: 0, whiten: 0.2 });
  const coil = new Mesh(new TorusGeometry(0.2, 0.026, 10, 28, Math.PI), coilMat);
  coil.position.set(0, 1.12, 0);
  const core = new Mesh(new SphereGeometry(0.05, 12, 8), coilMat);
  core.position.set(0, 1.32, 0);
  const halo = createHalo({ color: 'yellow', size: 2.6, intensity: 0 });
  halo.position.set(0, 1.2, 0);
  model.group.add(coil, core, halo);

  const tint = new Color();
  let shownK = -1;
  let shownBurnt = false;
  const self: Bulb = {
    group: model.group,
    a: model.anchor('a'),
    b: model.anchor('b'),
    glass: model.anchor('glass'),
    brightness: 0,
    burnt: false,
    update(t) {
      const k = self.burnt ? 0 : Math.min(Math.max(self.brightness, 0), 1);
      // dull orange → yellow → white-hot; a faint shimmer keeps a lit lamp alive
      if (k < 0.5) tint.copy(WARM).lerp(HOT, k * 2);
      else tint.copy(HOT).lerp(WHITE, (k - 0.5) * 1.2);
      if (k < 0.02) tint.copy(self.burnt ? col('ink') : COLD);
      // setColor also re-derives the core; skip it while the tint is steady
      if (Math.abs(k - shownK) > 0.004 || self.burnt !== shownBurnt) {
        coilMat.setColor(tint);
        shownK = k;
        shownBurnt = self.burnt;
      }
      const shimmer = 1 + 0.03 * Math.sin(t * 9.3) * k;
      coilMat.intensity = (k < 0.02 ? 0.25 : 0.7 + 2.6 * k) * shimmer;
      halo.intensity = 1.5 * k * k * shimmer;
      halo.visible = k > 0.02;
    },
  };
  return self;
}
