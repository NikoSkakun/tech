/**
 * Horizontal-axis wind turbine: tapered tubular tower with flanged sections and a door, yawing nacelle whose
 * cover lifts off to show the drive train (main bearing → low-speed shaft → gearbox «мультиплікатор» → brake →
 * generator → transformer), hub with three twisted aerofoil blades on pitch bearings; onshore gravity
 * foundation or offshore monopile with a yellow transition piece. The turbine faces +Z (upwind side).
 * Units: metres; proportions are toy-thick by default (`chunk`).
 *
 * Parts: `nacelle` (yaw) › `rotor` (spin about Z) › `blade0…2` (pitch); `nacelle` › `cover`.
 * Anchors: `hub`, `top` (aviation light), `door`, `cable` (grid connection at the base), `mainBearing`,
 * `gearbox`, `brake`, `generator`, `transformer`, `blade0…2.tip`.
 */
import { col, type ColorLike } from '@/style';
import { bandGeometry } from '../core/bands';
import { Builder, type KitModel } from '../core/builder';
import { bladeGeometry } from './wind-blade';
import type { Object3D } from 'three';
import { addDriveTrain, addDriveTrainAnchors, addTurbineFoundation, addTurbineHub, addTurbineTower } from './wind-parts';

export interface WindTurbineOptions {
  /** Hub height above the ground / sea level. Default 90. */
  hubHeight?: number;
  /** Rotor diameter. Default 110. */
  rotorDiameter?: number;
  /** Thickness exaggeration of tower and blades (1 = real slenderness). Default 1.5. */
  chunk?: number;
  /** `onshore` gravity foundation or `offshore` monopile (set `depth` to the water depth). */
  foundation?: 'onshore' | 'offshore';
  depth?: number;
  /** Red warning stripes at the blade tips. Default true. */
  stripes?: boolean;
  accent?: ColorLike;
  /**
   * Nacelle interior (M3): `true` (default) = the kit drive train; `false` = empty nacelle (cheaper, for distant
   * turbines); an `Object3D` = a chapter-built machine room mounted in the nacelle frame (origin on the rotor
   * axis at the bearing height, rotor toward +Z; 1 unit = 1 m × `rotorDiameter / 110`). The drive-train anchors
   * exist in every case.
   */
  interior?: boolean | Object3D;
}

export interface WindTurbine extends KitModel {
  /** Rotor speed in rad/s used by `update` (12 rpm ≈ 1.26 rad/s). Set 0 to stop. */
  rotorSpeed: number;
  readonly hubHeight: number;
  readonly rotorRadius: number;
  /** Turn the nacelle into the wind (radians around Y). */
  setYaw(angle: number): void;
  /** Blade pitch in radians: 0 = working position, π/2 = feathered (edge to the wind). */
  setPitch(angle: number): void;
  /** Lift the nacelle cover: 0 closed … 1 raised clear of the drive train. */
  setCover(open: number): void;
}

export function windTurbine(o: WindTurbineOptions = {}): WindTurbine {
  const H = o.hubHeight ?? 90;
  const R = (o.rotorDiameter ?? 110) / 2;
  const chunk = o.chunk ?? 1.5;
  const offshore = o.foundation === 'offshore';
  const accent = col(o.accent ?? 'coral');
  const white = col('white');
  const k = R / 55; // nacelle and hub scale with the rotor
  const rb = 0.024 * H * chunk;
  const rt = 0.014 * H * chunk;
  const b = new Builder('wind-turbine');
  const y0 = addTurbineFoundation(b, rb, offshore, o.depth ?? 20);
  addTurbineTower(b, y0, H - 2.2 * k, rb, rt, chunk, accent);
  b.anchor('cable', rb + 0.5, offshore ? -(o.depth ?? 20) : 0.3, 0);
  // nacelle (yaws on the tower top): yaw bearing, bed plate, drive train, side walls; the cover is a part
  const nac = b.part('nacelle', { at: [0, H, 0] });
  const L = 11 * k;
  const NW = 4.0 * k;
  const NH = 4.0 * k;
  nac.cyl(rt * 1.15, 1.0 * k, { seg: 20, slot: 'metal', c: 'steel', at: [0, -2.4 * k, 0] });
  nac.box(NW, 0.4 * k, L, { r: 0.15 * k, slot: 'metal', c: 'steel', at: [0, -1.9 * k, -1.2 * k] });
  const interior = o.interior ?? true;
  if (interior === true) addDriveTrain(nac, k);
  else {
    addDriveTrainAnchors(nac, k);
    if (interior !== false) nac.attach(interior);
  }
  for (const s of [-1, 1]) nac.box(0.12 * k, NH * 0.5, L, { r: 0.05 * k, slot: 'gloss', c: white, at: [s * (NW / 2), -1.7 * k, -1.2 * k] });
  nac.box(NW, NH * 0.5, 0.12 * k, { r: 0.05 * k, slot: 'gloss', c: white, at: [0, -1.7 * k, -1.2 * k - L / 2] });
  const cover = nac.part('cover', { at: [0, 0.3 * k, -1.2 * k] });
  const ch = NH * 0.5 + 0.2 * k;
  cover.box(NW + 0.2 * k, ch, L + 0.2 * k, { r: 0.6 * k, seg: 3, slot: 'gloss', c: [col('mist'), white] });
  // on the cover: cooler, wind vane mast with anemometer bar, red aviation light
  cover.box(NW * 0.5, 0.5 * k, 1.6 * k, { r: 0.1 * k, slot: 'gloss', c: 'steel.light', at: [0, ch - 0.05 * k, -L * 0.3] });
  cover.cyl(0.05 * k, 1.2 * k, { seg: 5, slot: 'gloss', c: 'slate', at: [0.8 * k, ch - 0.1 * k, -L * 0.42], bevel: 0 });
  cover.box(0.9 * k, 0.06 * k, 0.06 * k, { r: 0, slot: 'gloss', c: 'slate', at: [0.8 * k, ch + 1.05 * k, -L * 0.42] });
  cover.sphere(0.2 * k, { seg: 8, slot: 'glow', c: 'red', at: [-0.8 * k, ch + 0.15 * k, -L * 0.42] });
  cover.anchor('top', -0.8 * k, ch + 0.4 * k, -L * 0.42);
  // rotor: hub with spinner, three blades on pitch bearings
  const rotor = nac.part('rotor', { at: [0, 0, 4.6 * k] });
  addTurbineHub(rotor, k, accent);
  const bo = { tipRadius: R, rootRadius: 1.7 * k, chunk };
  const stripe = (o.stripes ?? true) ? col('red') : white;
  // crisp tip stripes: the lofted blade is cut along iso-lines of the span coordinate
  const blade = bandGeometry(bladeGeometry(bo), (_x, y) => (y - bo.rootRadius) / (R - bo.rootRadius), [[0.78, white], [0.84, stripe], [0.9, white], [0.96, stripe]], white);
  for (let i = 0; i < 3; i++) {
    const bp = rotor.part(`blade${i}`);
    bp.add(blade, { slot: 'gloss' });
    bp.cyl(0.024 * R * chunk, 0.5 * k, { seg: 14, slot: 'gloss', c: 'steel', at: [0, bo.rootRadius - 0.3 * k, 0] });
    bp.anchor('tip', 0, R, 0);
  }
  const model = b.build();
  const blades = [0, 1, 2].map((i) => model.part(`blade${i}`));
  const setPitch = (angle: number): void => {
    blades.forEach((g, i) => {
      // azimuth about the rotor axis first, then pitch about the blade's own span axis
      g.rotation.order = 'ZYX';
      g.rotation.set(0, angle, (i * Math.PI * 2) / 3);
    });
  };
  setPitch(0);
  const turbine: WindTurbine = Object.assign(model, {
    rotorSpeed: 1.26,
    hubHeight: H,
    rotorRadius: R,
    setYaw: (angle: number): void => void (model.part('nacelle').rotation.y = angle),
    setPitch,
    setCover: (open: number): void => void (model.part('cover').position.y = 0.3 * k + open * NH * 1.1),
  });
  turbine.update = (dt) => {
    model.part('rotor').rotation.z -= turbine.rotorSpeed * dt;
  };
  return turbine;
}
