/**
 * The primary circuit inside the containment (real size, metres, local origin = reactor axis on the ground):
 * four loops — hot leg → horizontal steam generator (kit `heatExchanger`, cut open onto its tubes) → main
 * circulation pump (vertical, a turning impeller) → cold leg → vessel — and the pressurizer (cut open: water
 * below, a steam cushion above, heaters at the bottom, spray nozzle on top) with its surge line to loop 4.
 * The steam lines of the second circuit rise from the generators and leave through the east wall.
 *
 * `paths` (local) feed the coolant flows: `hot[i]`, `cold[i]` per loop, `steam[i]`, `feed`.
 */
import { Group, Vector3 } from 'three';
import { Builder, G, heatExchanger, type KitModel } from '@/kit';
import { LOOPS, RPV } from '../layout';
import { VESSEL } from './rpv';

const P = 0.43; // primary pipe radius (Ø 850 mm)
export const SG = { radius: 13.5, y: 15.5, r: 2.0, length: 13 } as const;
export const PRESSURIZER = { az: Math.PI * 1.15, radius: 9.5, y: 3, h: 13, r: 1.5 } as const;
const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

export interface Loops {
  group: Group;
  primary: KitModel;
  secondary: KitModel;
  sgs: KitModel[];
  pressurizer: KitModel;
  /** Impellers of the four pumps (rotate about Y). */
  impellers: Group[];
  paths: { hot: Vector3[][]; cold: Vector3[][]; steam: Vector3[][]; feed: Vector3[][] };
  at: { sg: Vector3; pump: Vector3; pressurizer: Vector3; valve: Vector3; hotLeg: Vector3; coldLeg: Vector3; steam: Vector3 };
}

export function buildLoops(): Loops {
  const group = new Group();
  const pb = new Builder('primary');
  const sb = new Builder('secondary');
  const sgs: KitModel[] = [];
  const impellers: Group[] = [];
  const hot: Vector3[][] = [];
  const cold: Vector3[][] = [];
  const steam: Vector3[][] = [];
  const feed: Vector3[][] = [];
  const yOut = RPV.y + VESSEL.nozzleOut;
  const yIn = RPV.y + VESSEL.nozzleIn;
  LOOPS.azimuths.forEach((a, i) => {
    const u = v(Math.sin(a), 0, Math.cos(a));
    const t = v(Math.cos(a), 0, -Math.sin(a));
    const at = (r: number, y: number, s = 0): Vector3 => u.clone().multiplyScalar(r).addScaledVector(t, s).setY(y);
    const hotPts = [at(VESSEL.r + 1.1, yOut), at(SG.radius - 2.4, yOut, -1.4), at(SG.radius, yOut, -1.4), at(SG.radius, SG.y - 0.5, -1.4)];
    const coldPts = [at(SG.radius, SG.y - 0.5, 1.4), at(SG.radius, 7, 1.4), at(9.6, 7, 2.6), at(9.6, 10.2, 2.6), at(6, yIn, 1.2), at(VESSEL.r + 1.1, yIn)];
    pb.tube(G.roundPath(hotPts, 1.2), P, { seg: 16 });
    pb.tube(G.roundPath(coldPts, 1.2), P, { seg: 16 });
    hot.push(G.roundPath(hotPts, 1.2));
    cold.push(G.roundPath(coldPts, 1.2));
    // main circulation pump: casing, motor and flywheel on top, impeller part
    const pump = at(9.6, 0, 2.6);
    pb.cyl(1.25, 3.2, { seg: 28, slot: 'metal', c: ['steel', 'steel.light'], at: [pump.x, 5.6, pump.z] });
    pb.cyl(0.9, 4.2, { seg: 28, slot: 'gloss', c: ['blue.dark', 'blue'], at: [pump.x, 10.8, pump.z] });
    pb.cyl(1.2, 0.5, { seg: 28, slot: 'metal', c: 'slate', at: [pump.x, 15, pump.z] });
    for (let k = 0; k < 4; k++) pb.rod([pump.x + Math.cos(k * 1.57) * 1.1, 0, pump.z + Math.sin(k * 1.57) * 1.1], [pump.x + Math.cos(k * 1.57) * 1.1, 5.6, pump.z + Math.sin(k * 1.57) * 1.1], 0.12, { c: 'slate' });
    const ib = new Builder(`impeller-${i}`);
    for (let k = 0; k < 6; k++) ib.box(1.5, 0.5, 0.12, { r: 0.04, slot: 'metal', c: 'amber', at: [0.6 * Math.cos((k * Math.PI) / 3), -0.25, 0.6 * Math.sin((k * Math.PI) / 3)], rot: [0, -(k * Math.PI) / 3, 0] });
    const imp = ib.build();
    imp.group.position.set(pump.x, 15.6, pump.z);
    impellers.push(imp.group);
    group.add(imp.group);
    // steam generator, its axis along the tangent, cut open toward the cameras / the sky
    const sg = heatExchanger({ length: SG.length, radius: SG.r, cut: 1.6, hot: 'sky', cold: 'blue', color: 'steel.light' });
    sg.group.position.copy(at(SG.radius, SG.y));
    sg.group.rotation.y = Math.atan2(-t.z, t.x);
    sgs.push(sg);
    group.add(sg.group);
    // steam line (second circuit) up from the generator and out through the east wall
    const z0 = -6 + i * 4;
    const s = [at(SG.radius, SG.y + SG.r), at(SG.radius, 23), v(21.5, 24, z0), v(40, 24, z0)];
    sb.tube(G.roundPath(s, 1.5), 0.38, { seg: 14 });
    steam.push(G.roundPath(s, 1.5));
    const f = [v(40, 20.5, z0 + 1), v(21.5, 20.5, z0 + 1), at(SG.radius, 20.5, 2.6), at(SG.radius, SG.y + SG.r - 0.2, 2.6)];
    sb.tube(G.roundPath(f, 1.2), 0.22, { seg: 12 });
    feed.push(G.roundPath(f, 1.2));
  });
  const pu = v(Math.sin(PRESSURIZER.az), 0, Math.cos(PRESSURIZER.az)).multiplyScalar(PRESSURIZER.radius);
  const h4 = hot[3]![1]!;
  pb.tube(G.roundPath([v(pu.x, PRESSURIZER.y + 0.2, pu.z), v(pu.x, 1.2, pu.z), v(h4.x, 1.2, h4.z), v(h4.x, yOut - P, h4.z)], 1), 0.18, { seg: 10 });
  const primary = pb.build();
  const secondary = sb.build();
  // pressurizer, cut open: shell, heaters, water and steam inside, spray nozzle; surge line to loop 4
  const pz = new Builder('pressurizer');
  const shell = G.revolve([[PRESSURIZER.r - 0.15, 0], [PRESSURIZER.r, 0], [PRESSURIZER.r, PRESSURIZER.h], [PRESSURIZER.r - 0.15, PRESSURIZER.h]], { phiStart: Math.PI / 2 + 0.9, phiLength: Math.PI * 2 - 1.8, seg: 32 });
  pz.add(shell.shell, { slot: 'metal', c: ['steel', 'steel.light'], at: [0, 0, 0] });
  if (shell.caps) pz.add(shell.caps, { slot: 'matte', c: 'slate.light' });
  pz.dome(PRESSURIZER.r, 0.9, { seg: 32, slot: 'metal', c: 'steel.light', at: [0, PRESSURIZER.h, 0] });
  pz.cyl(PRESSURIZER.r - 0.18, 7.2, { seg: 32, slot: 'gloss', c: ['blue.dark', 'blue'], at: [0, 0.2, 0] });
  for (let k = 0; k < 7; k++) pz.cyl(0.07, 1.8, { seg: 8, slot: 'glow', c: 'orange', at: [-0.9 + k * 0.3, 0.3, 0.3] });
  pz.cyl(0.25, 0.8, { seg: 12, slot: 'metal', c: 'slate', at: [0, PRESSURIZER.h - 0.6, 0] });
  pz.anchor('level', 0, 7.4, 0).anchor('spray', 0, PRESSURIZER.h - 0.8, 0).anchor('heaters', 0, 1.2, 0);
  const pressurizer = pz.build();
  pressurizer.group.position.set(pu.x, PRESSURIZER.y, pu.z);
  group.add(primary.group, secondary.group, pressurizer.group);
  const l0 = LOOPS.azimuths[0];
  return {
    group,
    primary,
    secondary,
    sgs,
    pressurizer,
    impellers,
    paths: { hot, cold, steam, feed },
    at: {
      sg: sgs[0]!.group.position.clone().add(v(0, SG.r + 0.6, 0)),
      pump: v(Math.sin(l0) * 9.6 + Math.cos(l0) * 2.6, 13, Math.cos(l0) * 9.6 - Math.sin(l0) * 2.6),
      pressurizer: v(pu.x, PRESSURIZER.y + PRESSURIZER.h + 1, pu.z),
      valve: hot[1]![1]!.clone(),
      hotLeg: hot[0]![1]!.clone(),
      coldLeg: cold[0]![2]!.clone(),
      steam: steam[0]![2]!.clone(),
    },
  };
}
