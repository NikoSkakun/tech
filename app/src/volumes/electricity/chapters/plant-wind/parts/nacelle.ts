/**
 * The hero's machine room (document: `nacelleInterior`). It replaces the kit turbine's simple nacelle: bed
 * frame on the yaw bearing, a fixed roof spine with cooler, wind sensors and aviation light, and two cover
 * petals that swing open over the drive train (parts/nacelle-drive.ts). Built with the kit `Builder` in the
 * kit's own nacelle units: 1 unit = `k` metres, rotor axis = local Z at y = 0, rotor toward +Z.
 * Colours by function (document, step 5): mechanics `steel` / `slate`, generator copper `orange`, power
 * electronics `violet` with `cyan` indicators, oil and cooling `blue`.
 */
import { Vector3, type Group, type Object3D } from 'three';
import { Builder, G, addBoltCircle, type KitModel } from '@/kit';
import { addDriveTrain, type DriveParts } from './nacelle-drive';

/** Nacelle box in units: floor, shoulder and roof heights, half width, rear and front ends. */
export const NAC = { floor: -2.0, sill: -1.0, roof: 2.3, half: 2.35, rear: -9.2, front: 3.6, spine: 0.6 } as const;

export interface Nacelle {
  model: KitModel;
  group: Group;
  petals: [Group, Group];
  drive: DriveParts;
  /** Named points for hotspots and labels. */
  at(name: string): Object3D;
  /** 0 closed … 1 open. */
  setOpen(v: number): void;
  /** Spin the anemometer cups and trim the vane (wind speed in m/s). */
  update(dt: number, wind: number): void;
}

/** Cross-section of one cover petal (right side, relative to its hinge on the sill): wall, shoulder, half roof. */
function petalOutline(): [number, number][] {
  const h = NAC.roof - NAC.sill;
  const w = NAC.half - NAC.spine;
  const t = 0.13;
  const r = 0.85;
  const arc = (rad: number, n = 6): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * (Math.PI / 2);
      return [-r + Math.cos(a) * rad, h - r + Math.sin(a) * rad] as [number, number];
    });
  // outer skin up the wall, round the shoulder, in to the spine; back along the inner skin
  return [[0, 0], ...arc(r), [-w, h], [-w, h - t], ...arc(r - t).reverse(), [-t, 0]];
}

export function buildNacelle(k: number, towerTopRadius: number): Nacelle {
  const b = new Builder('hero-nacelle');
  const L = NAC.front - NAC.rear;
  const zc = (NAC.front + NAC.rear) / 2;
  let drive!: DriveParts;
  let anemometer!: Builder;
  b.frame({ s: k }, () => {
    const rt = towerTopRadius / k;
    // yaw bearing with its gear ring and four yaw drives on the bed frame
    b.cyl(rt * 1.2, 0.5, { seg: 28, slot: 'metal', c: 'steel', at: [0, -2.95, 0] });
    b.cyl(rt * 1.32, 0.34, { seg: 36, slot: 'metal', c: 'slate', at: [0, -2.5, 0] });
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      b.box(0.12, 0.3, 0.2, { r: 0, slot: 'metal', c: 'steel.light', at: [Math.cos(a) * rt * 1.36, -2.48, Math.sin(a) * rt * 1.36], rot: [0, -a, 0] });
    }
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      b.cyl(0.3, 1.25, { seg: 12, slot: 'gloss', c: ['teal.dark', 'teal'], at: [sx * rt * 1.36, -2.0, sz * rt * 0.9] });
      b.cyl(0.2, 0.4, { seg: 10, slot: 'metal', c: 'steel', at: [sx * rt * 1.36, -2.3, sz * rt * 0.9] });
    }
    b.anchor('yaw', rt * 1.36, -1.2, rt * 0.9);
    // bed frame: floor plate on two long girders, low hull, checker-free walkway
    b.box(NAC.half * 2, 0.22, L, { r: 0.06, slot: 'metal', c: 'steel', at: [0, NAC.floor - 0.22, zc] });
    for (const s of [-1, 1]) b.box(0.3, 0.55, L * 0.96, { r: 0.08, slot: 'metal', c: 'slate', at: [s * 1.5, NAC.floor - 0.75, zc] });
    b.box(NAC.half * 2 + 0.26, 1.15, L + 0.2, { r: 0.45, seg: 3, slot: 'gloss', c: ['mist', 'white'], at: [0, NAC.floor - 1.02, zc] });
    for (const s of [-1, 1]) b.box(0.13, NAC.sill - NAC.floor, L, { r: 0.04, slot: 'gloss', c: 'white', at: [s * (NAC.half - 0.065), NAC.floor, zc] });
    b.box(NAC.half * 2, NAC.sill - NAC.floor, 0.13, { r: 0.04, slot: 'gloss', c: 'white', at: [0, NAC.floor, NAC.rear + 0.065] });
    // end arches and the roof spine that stay when the petals open; rear arch is a full bulkhead with a hatch
    const arch = (z: number, solid: boolean): void => {
      for (const s of [-1, 1]) b.box(0.22, NAC.roof - NAC.floor, 0.22, { r: 0.07, slot: 'gloss', c: 'white', at: [s * (NAC.half - 0.11), NAC.floor, z] });
      b.box(NAC.half * 2, 0.22, 0.22, { r: 0.07, slot: 'gloss', c: 'white', at: [0, NAC.roof - 0.22, z] });
      if (solid) b.box(NAC.half * 2 - 0.3, NAC.roof - NAC.sill - 0.2, 0.1, { r: 0.05, slot: 'gloss', c: ['mist', 'white'], at: [0, NAC.sill, z] });
    };
    arch(NAC.front - 0.11, false);
    arch(NAC.rear + 0.11, true);
    b.ring(1.5, 0.2, { axis: 'z', seg: 32, tubeSeg: 8, slot: 'gloss', c: 'teal', at: [0, 0, NAC.front - 0.05] });
    b.box(NAC.spine * 2, 0.2, L, { r: 0.08, slot: 'gloss', c: 'white', at: [0, NAC.roof - 0.2, zc] });
    // service crane rail under the spine, with its trolley and hook
    b.box(0.2, 0.26, L * 0.82, { r: 0.05, slot: 'gloss', c: 'yellow', at: [0, NAC.roof - 0.5, zc - 0.3] });
    b.box(0.5, 0.3, 0.6, { r: 0.08, slot: 'gloss', c: 'amber', at: [0, NAC.roof - 0.82, -6.4] });
    b.rod([0, NAC.roof - 0.8, -6.4], [0, NAC.roof - 1.5, -6.4], 0.03, { c: 'slate', seg: 5 });
    // on the spine: cooler with fins and blue coolant pipes, sensor mast, aviation light
    b.box(1.5, 0.75, 2.6, { r: 0.12, slot: 'gloss', c: ['steel', 'steel.light'], at: [0, NAC.roof, -4.2] });
    for (let i = 0; i < 9; i++) b.box(1.56, 0.6, 0.07, { r: 0, c: 'slate', at: [0, NAC.roof + 0.08, -5.3 + i * 0.28] });
    for (const s of [-1, 1]) b.tube(G.roundPath([[s * 0.45, NAC.roof + 0.3, -5.6], [s * 0.45, NAC.roof + 0.3, -6.3], [s * 0.45, 0.9, -6.3], [s * 0.45, 0.9, -5.2]].map(([x, y, z]) => new Vector3(x, y, z)), 0.25), 0.09, { c: s > 0 ? 'blue' : 'sky', slot: 'gloss', seg: 6 });
    b.anchor('cooling', 0, NAC.roof + 0.9, -4.2);
    b.cyl(0.07, 1.7, { seg: 6, c: 'slate', at: [0.25, NAC.roof, -8.2], bevel: 0 });
    b.box(1.3, 0.07, 0.07, { r: 0, c: 'slate', at: [0.25, NAC.roof + 1.45, -8.2] });
    // wind vane: a fin on the port end of the cross arm
    b.box(0.05, 0.36, 0.7, { r: 0.02, slot: 'gloss', c: 'coral', at: [-0.4, NAC.roof + 1.5, -8.45] });
    b.sphere(0.09, { seg: 8, c: 'slate', at: [-0.4, NAC.roof + 1.52, -8.0] });
    b.anchor('sensors', 0.25, NAC.roof + 1.8, -8.2);
    b.cyl(0.12, 0.3, { seg: 8, c: 'slate', at: [-0.3, NAC.roof, -7.0] });
    b.sphere(0.24, { seg: 10, slot: 'glow', c: 'red', at: [-0.3, NAC.roof + 0.46, -7.0] });
    b.anchor('light', -0.3, NAC.roof + 0.5, -7.0);
    anemometer = b.part('anemometer', { at: [0.9, NAC.roof + 1.52, -8.2] });
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      anemometer.rod([0, 0, 0], [Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34], 0.025, { c: 'slate', seg: 5 });
      anemometer.sphere(0.13, { seg: 8, slot: 'gloss', c: 'white', at: [Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36] });
    }
    // the two cover petals, hinged on the sills
    const outline = petalOutline();
    for (const s of [1, -1]) {
      const petal = b.part(s > 0 ? 'petalR' : 'petalL', { at: [s * NAC.half, NAC.sill, zc] });
      const o = outline.map(([x, y]): [number, number] => [x * s, y]);
      petal.add(G.extrude(s > 0 ? o : [...o].reverse(), L - 0.5).translate(0, 0, -(L - 0.5) / 2), { slot: 'gloss', c: ['mist', 'white'] });
      petal.box(0.05, 1.5, L * 0.5, { r: 0.02, slot: 'gloss', c: 'teal', at: [s * 0.03, 0.5, 0.6] }); // livery stripe
    }
    drive = addDriveTrain(b);
    addBoltCircle(b, 1.5, 12, { r: 0.07, c: 'steel.light', z: NAC.front + 0.1 });
  });
  const model = b.build();
  const petals: [Group, Group] = [model.part('petalR'), model.part('petalL')];
  const cups = model.part('anemometer');
  return {
    model,
    group: model.group,
    petals,
    drive,
    at: (name) => model.anchor(name),
    setOpen(v) {
      // each petal swings outward and down past the horizontal, like a beetle's wing cases
      petals[0].rotation.z = -v * 2.05;
      petals[1].rotation.z = v * 2.05;
    },
    update(dt, wind) {
      cups.rotation.y -= dt * (0.6 + wind * 0.9);
    },
  };
}
