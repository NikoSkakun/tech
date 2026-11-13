/**
 * Sub-assemblies of the wind turbine: foundation (onshore gravity base / offshore monopile with transition
 * piece), tubular tower, and the drive train inside the nacelle. Units: metres.
 */
import type { Color } from 'three';
import type { ColorLike } from '@/style';
import { col } from '@/style';
import type { Builder } from '../core/builder';
import type { Pt } from '../core/geo';

/** Foundation under a tower of base radius `rb`. Returns the height at which the tower starts. */
export function addTurbineFoundation(b: Builder, rb: number, offshore: boolean, depth: number): number {
  if (!offshore) {
    b.cyl(rb * 3.4, 1.2, { rTop: rb * 2.6, seg: 28, slot: 'matte', c: ['steel', 'mist'], at: [0, -0.9, 0], bevel: 0.15 });
    b.cyl(rb * 1.5, 0.7, { rTop: rb * 1.25, seg: 24, slot: 'matte', c: 'mist', at: [0, 0.2, 0], bevel: 0.1 });
    return 0.9;
  }
  // monopile driven into the seabed, yellow transition piece with work platform, boat landing and ladder
  b.cyl(rb * 1.02, depth + 6, { seg: 24, c: ['slate', 'steel'], at: [0, -depth, 0], bevel: 0 });
  b.cyl(rb * 1.22, 9, { seg: 24, slot: 'gloss', c: ['amber', 'yellow'], at: [0, 2, 0], bevel: 0.15 });
  b.cyl(rb * 2.1, 0.4, { seg: 28, c: 'steel', at: [0, 10.6, 0] });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    b.cyl(0.09, 1.3, { seg: 5, slot: 'metal', c: 'yellow', at: [Math.cos(a) * rb * 2, 11, Math.sin(a) * rb * 2], bevel: 0 });
  }
  b.ring(rb * 2, 0.09, { seg: 28, tubeSeg: 5, slot: 'metal', c: 'yellow', at: [0, 12.3, 0] });
  for (const s of [-1, 1]) b.cyl(0.25, 12, { seg: 8, slot: 'gloss', c: 'yellow', at: [s * 0.9, -1.5, rb * 1.4], bevel: 0.05 });
  for (let i = 0; i < 12; i++) b.box(1.6, 0.1, 0.1, { r: 0, slot: 'metal', c: 'steel', at: [0, -1 + i, rb * 1.4] });
  return 11;
}

/** Tapered tower from `y0` to `top`: one lathe with flange bulges at the three section joints, band, door. */
export function addTurbineTower(b: Builder, y0: number, top: number, rb: number, rt: number, chunk: number, accent: Color): void {
  const profile: Pt[] = [
    [0, 0],
    [rb * 1.06, 0],
  ];
  const h = top - y0;
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    const r = rb + (rt - rb) * t;
    const y = t * h;
    if (i > 0) profile.push([r * 1.045, y - 0.5], [r * 1.045, y]);
    profile.push([r, y + (i < 3 ? 0.3 : 0)]);
  }
  profile.push([0, h]);
  b.lathe(profile, { seg: 28, slot: 'gloss', c: [col('mist'), col('white')], at: [0, y0, 0], crease: 60 });
  b.ring(rb * 0.995, 0.35 * chunk, { seg: 28, tubeSeg: 6, slot: 'gloss', c: accent, at: [0, y0 + h * 0.09, 0], s: [1, 2.2, 1] });
  b.box(1.1 * chunk, 2.2 * chunk, 0.3, { r: 0.12, slot: 'gloss', c: 'slate', at: [0, y0 + 0.2, rb * 0.97] });
  b.anchor('door', 0, y0 + 1.2, rb + 0.5);
}

/**
 * Drive train on the nacelle bed plate (rotor axis = local Z at y = 0, rotor toward +Z), colour-coded by
 * function: main bearing and shafts steel, gearbox teal, brake disc coral, generator amber, transformer white.
 * `k` = scale (1 for a 110 m rotor). Anchors: `mainBearing`, `gearbox`, `brake`, `generator`, `transformer`.
 */
export function addDriveTrain(nac: Builder, k: number): void {
  nac.cyl(1.3 * k, 1.2 * k, { axis: 'z', seg: 18, slot: 'metal', c: 'steel.light', at: [0, 0, 2.2 * k] });
  nac.box(1.8 * k, 1.2 * k, 1.0 * k, { r: 0.15 * k, slot: 'metal', c: 'slate', at: [0, -1.5 * k, 2.3 * k] });
  nac.cyl(0.5 * k, 2.6 * k, { axis: 'z', seg: 14, slot: 'metal', c: 'mist', at: [0, 0, -0.2 * k] });
  nac.box(2.3 * k, 2.4 * k, 2.2 * k, { r: 0.3 * k, seg: 2, slot: 'gloss', c: ['teal.dark', 'teal'], at: [0, -1.4 * k, -1.2 * k] });
  nac.cyl(0.75 * k, 0.16 * k, { axis: 'z', seg: 18, slot: 'gloss', c: 'coral', at: [0, 0.2 * k, -2.75 * k] });
  nac.cyl(0.2 * k, 1.4 * k, { axis: 'z', seg: 10, slot: 'metal', c: 'mist', at: [0, 0.2 * k, -3.9 * k] });
  nac.cyl(1.05 * k, 2.4 * k, { axis: 'z', seg: 20, slot: 'gloss', c: ['orange', 'amber'], at: [0, 0.2 * k, -6.2 * k] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    nac.box(0.1 * k, 0.12 * k, 2.0 * k, { r: 0, slot: 'gloss', c: 'orange', at: [Math.cos(a) * 1.08 * k, 0.14 * k + Math.sin(a) * 1.08 * k, -5.0 * k] });
  }
  nac.box(1.2 * k, 1.5 * k, 1.0 * k, { r: 0.1 * k, slot: 'gloss', c: 'white', at: [-1.2 * k, -1.7 * k, -5.2 * k] });
  addDriveTrainAnchors(nac, k);
}

/**
 * Only the anchors of `addDriveTrain` (`mainBearing`, `gearbox`, `brake`, `generator`, `transformer`) — for a
 * nacelle whose interior a chapter supplies itself (`windTurbine({ interior })`, M3).
 */
export function addDriveTrainAnchors(nac: Builder, k: number): void {
  nac.anchor('mainBearing', 0, 1.4 * k, 2.8 * k);
  nac.anchor('gearbox', 0, 1.2 * k, -1.2 * k);
  nac.anchor('brake', 0, 1.1 * k, -2.7 * k);
  nac.anchor('generator', 0, 1.4 * k, -5.0 * k);
  nac.anchor('transformer', -1.2 * k, 0, -5.2 * k);
}

/**
 * Hub with spinner and pitch-bearing ring on a rotor part (rotor axis = local Z, upwind toward +Z), as used by
 * `windTurbine`; anchor `hub`. `k` = scale (1 for a 110 m rotor). Exported for chapter-built rotors (M3).
 */
export function addTurbineHub(rotor: Builder, k: number, accent: ColorLike = 'coral'): void {
  rotor.lathe(
    [[0, 0], [1.9 * k, 0], [2.0 * k, 0.8 * k], [1.7 * k, 2.4 * k], [0.9 * k, 3.7 * k], [0.25 * k, 4.2 * k], [0, 4.25 * k]],
    { axis: 'z', seg: 22, slot: 'gloss', c: [col('mist'), col('white')], at: [0, 0, -1.2 * k], crease: 70 },
  );
  rotor.ring(1.95 * k, 0.12 * k, { axis: 'z', seg: 22, tubeSeg: 5, slot: 'gloss', c: accent, at: [0, 0, -0.5 * k] });
  rotor.anchor('hub', 0, 0, 1.5 * k);
}
