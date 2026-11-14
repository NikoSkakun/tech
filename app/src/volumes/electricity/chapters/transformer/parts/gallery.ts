/**
 * Exhibits of the gallery (step 8), each a kit model in metres with its true size: (1) generator step-up transformer
 * with the isolated-phase bus ducts from the generator, (2) 330/110 kV autotransformer, (3) 10/0,4 kV distribution
 * transformers — on a pole and in a kiosk substation, (4) a current transformer (toroid on a busbar, secondary
 * ammeter with a needle part) beside a 110 kV voltage transformer, (5) a 1:1 isolation transformer with its shaver
 * socket, (6) the high-frequency transformer of a phone charger (open case, board) — its core is the variable
 * «core for 50 W» of the frequency demo (`smpsCore`).
 */
import { Group, Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder, addSchukoSocket, addVoltageTransformer, kioskSubstation, poleSubstation, powerTransformer, type KitModel } from '@/kit';
import { K, col } from '@/style';
import { COPPER, COPPER_PRIMARY, COPPER_SECONDARY } from '../world';
import { greyPorcelain } from './porcelain';

export type ExhibitId = 'gsu' | 'auto' | 'dist' | 'ct' | 'iso' | 'smps';
export const EXHIBITS: readonly ExhibitId[] = ['gsu', 'auto', 'dist', 'ct', 'iso', 'smps'];

export interface Exhibit {
  id: ExhibitId;
  group: Group;
  /** Largest dimension, metres (carousel fit and the true-scale row). */
  size: number;
  /** Height of the label point above the base, metres. */
  top: number;
  /** Yaw on its pedestal, so the telling side faces the viewer. */
  yaw?: number;
}

function gsu(): Exhibit {
  const g = new Group();
  const t = powerTransformer({ hv: 330, lv: 20 });
  const b = new Builder('bus-ducts');
  // three isolated-phase bus ducts from the generator terminals to the LV bushings, on steel supports
  for (let k = -1; k <= 1; k++) {
    const z = -2.6;
    b.rod([k * 1.1, 4.2, z], [k * 1.1, 4.2, z - 5.5], 0.32, { slot: 'gloss', c: 'steel.light', seg: 18 });
    b.box(0.2, 4.2, 0.2, { r: 0.04, slot: 'metal', c: 'slate', at: [k * 1.1, 0, z - 4.5] });
  }
  b.box(4.6, 3.6, 2.2, { r: 0.4, slot: 'gloss', c: col('violet').lerp(col('slate'), 0.5), at: [0, 0, -9.0] });
  b.cyl(1.5, 4.6, { axis: 'x', seg: 32, slot: 'gloss', c: col('violet').lerp(col('slate'), 0.35), at: [-2.3, 2.6, -9.0] });
  g.add(t.group, b.build().group);
  return { id: 'gsu', group: g, size: 12, top: 9, yaw: 0.75 };
}

function auto(): Exhibit {
  const g = new Group();
  const t = powerTransformer({ hv: 330, lv: 110, scale: 0.95 });
  g.add(t.group);
  return { id: 'auto', group: g, size: 10, top: 8.5, yaw: -0.35 };
}

function dist(): Exhibit {
  const g = new Group();
  const pole = poleSubstation({ kVA: 160 });
  pole.group.position.set(-2.4, 0, 0);
  const ktp = kioskSubstation({ kVA: 400 });
  ktp.group.position.set(2.4, 0, 0);
  g.add(pole.group, ktp.group);
  return { id: 'dist', group: g, size: 10, top: 9, yaw: 0.25 };
}

export interface CtExhibit extends Exhibit {
  ammeter: KitModel;
  terminals: Vector3;
}

function ct(): CtExhibit {
  const g = new Group();
  const b = new Builder('ct');
  // the current transformer is the hero of this exhibit: a fat toroid on the busbar, in front; the 110 kV voltage
  // transformer stands back and to the side at half size («не в масштабі»), so it does not crowd it
  const y = 1.4;
  const R = 0.46;
  b.box(2.8, 0.24, 0.24, { r: 0.05, mid: true, slot: 'metal', c: COPPER, at: [0, y, 0] });
  b.ring(R, 0.17, { axis: 'x', seg: 48, tubeSeg: 16, slot: 'gloss', c: 'mist', at: [0, y, 0] });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    b.ring(0.19, 0.016, { axis: 'z', seg: 12, tubeSeg: 4, slot: 'metal', c: COPPER_SECONDARY, at: [0, y + Math.cos(a) * R, Math.sin(a) * R], rot: [a, 0, 0] });
  }
  b.box(0.46, 0.34, 0.24, { r: 0.05, slot: 'gloss', c: 'ink', at: [0, 0.66, 0.34] });
  for (const x of [-0.1, 0.1]) b.cyl(0.04, 0.08, { seg: 8, slot: 'metal', c: 'mist', at: [x, 1.0, 0.34] });
  for (const x of [-1.2, 1.2]) b.box(0.16, y - 0.12, 0.16, { r: 0.03, slot: 'metal', c: 'slate', at: [x, 0, 0] });
  b.frame({ at: [1.6, 0, -1.6], s: 0.5 }, () => addVoltageTransformer(b, { kV: 110 }));
  const model = b.build();
  const am = new Builder('ct-ammeter');
  am.cyl(0.32, 0.12, { axis: 'z', seg: 32, slot: 'gloss', c: 'slate' });
  am.cyl(0.27, 0.02, { axis: 'z', seg: 32, slot: 'gloss', c: 'white', at: [0, 0, 0.12] });
  const needle = am.part('needle', { at: [0, -0.13, 0.15] });
  needle.beam([0, 0, 0], [0, 0.3, 0], 0.025, { h: 0.012, slot: 'flat', c: 'bg.void' });
  const ammeter = am.build();
  ammeter.group.position.set(-0.85, 0.62, 0.55);
  g.add(model.group, ammeter.group);
  return { id: 'ct', group: g, size: 3.3, top: 2.0, ammeter, terminals: new Vector3(0, 1.04, 0.34), yaw: 0.95 };
}

function iso(): Exhibit {
  const g = new Group();
  const b = new Builder('isolation');
  b.box(0.3, 0.22, 0.12, { r: 0.02, slot: 'gloss', c: 'white' });
  b.frame({ at: [0, 0.11, 0.06] }, () => addSchukoSocket(b, 'mist'));
  b.box(0.08, 0.025, 0.004, { r: 0.002, mid: true, slot: 'flat', c: 'sky', at: [0, 0.19, 0.062] });
  g.add(b.build().group);
  return { id: 'iso', group: g, size: 0.3, top: 0.24 };
}

export interface SmpsExhibit extends Exhibit {
  /** The core «for 50 W»: edge ∝ ∛V; material steel (laminated E-I) below 1 kHz, ferrite above. */
  setCore(volumeCm3: number, ferrite: boolean): void;
}

function smps(): SmpsExhibit {
  const g = new Group();
  const b = new Builder('charger');
  b.box(0.07, 0.006, 0.05, { r: 0.002, slot: 'gloss', c: col('teal').lerp(col('bg.indigo'), 0.55) });
  b.box(0.074, 0.045, 0.054, { r: 0.006, slot: 'glass', at: [0, 0.006, 0] });
  b.cyl(0.005, 0.012, { seg: 12, slot: 'gloss', c: 'violet', at: [-0.022, 0.006, 0.012] });
  b.cyl(0.006, 0.014, { seg: 12, slot: 'gloss', c: 'blue', at: [-0.02, 0.006, -0.012] });
  g.add(b.build().group);
  const steel = K.metal({ color: 'steel', specular: 0.6 });
  const ferrite = K.toon({ color: col('ink').lerp(col('slate'), 0.4), gloss: 0.2 });
  const core = new Mesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.12), steel);
  const bobbin = new Mesh(new RoundedBoxGeometry(0.62, 0.7, 1.08, 2, 0.1), K.metal({ color: COPPER_PRIMARY.clone().lerp(COPPER_SECONDARY, 0.3), specular: 0.7 }));
  const unit = new Group();
  unit.add(core, bobbin);
  unit.position.set(0.012, 0.006, 0);
  g.add(unit);
  return {
    id: 'smps',
    group: g,
    size: 0.08,
    top: 0.06,
    yaw: -0.5,
    setCore(v, isFerrite) {
      const edge = Math.cbrt(v) / 100; // cm³ → m edge
      unit.scale.setScalar(edge);
      unit.position.y = 0.006 + edge / 2;
      core.material = isFerrite ? ferrite : steel;
    },
  };
}

export function createGallery(): { list: Exhibit[]; ct: CtExhibit; smps: SmpsExhibit } {
  const c = ct();
  const s = smps();
  const list = [gsu(), auto(), dist(), c, iso(), s];
  for (const e of list) {
    e.group.rotation.y = e.yaw ?? 0;
    greyPorcelain(e.group);
  }
  return { list, ct: c, smps: s };
}
