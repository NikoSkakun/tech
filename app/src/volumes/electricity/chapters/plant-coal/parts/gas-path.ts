/**
 * The gas path behind the boiler house, in flow order: catalyst block for nitrogen oxides (SCR) on its steel
 * stand → rotary regenerative air heater → electrostatic precipitator (three fields with ash hoppers) →
 * induced-draft fans → wet desulphurisation absorber → stack (kit `stack`, red–white bands, aviation lights).
 * The precipitator's south wall and a sector of the absorber are parts, so step 8 can look inside.
 * `route` is the centre line of the gas through all of it (for the particle flow of steps 4 and 8).
 */
import { Vector3 } from 'three';
import { Builder, G, addPipe, stack, type KitModel } from '@/kit';
import { col } from '@/style';
import { BOILER, GAS, ISLAND } from '../layout';

export interface GasPath {
  models: KitModel[];
  body: KitModel;
  chimney: KitModel;
  /** Gas centre line: boiler outlet → … → stack top (world). */
  route: Vector3[];
  /** Section boundaries along `route` (indices) for colouring / counters. */
  marks: { scr: Vector3; airHeater: Vector3; esp: Vector3; fan: Vector3; fgd: Vector3; stackTop: Vector3; espFields: Vector3[] };
  /** Hide the precipitator's south wall and the absorber's front sector (step 8). */
  setOpen(open: number): void;
  update(dt: number): void;
}

const g = ISLAND.ground;
const z = GAS.z;

export function buildGasPath(): GasPath {
  const b = new Builder('gas-path');
  const steel = [col('steel'), col('mist')] as const;
  const duct = col('steel').lerp(col('slate'), 0.3);
  // SCR block on a steel stand
  const scr = new Vector3(GAS.scr.x, g + GAS.scr.y, z);
  b.box(12, 16, 14, { r: 0.4, c: steel, at: [scr.x, scr.y - 8, z] });
  for (const k of [0.25, 0.5, 0.75]) b.box(12.2, 0.6, 14.2, { r: 0, c: 'teal', at: [scr.x, scr.y - 8 + 16 * k, z] });
  for (const dx of [-5, 5]) for (const dz of [-6, 6]) b.box(0.9, scr.y - 8 - g, 0.9, { r: 0, slot: 'metal', c: 'slate', at: [scr.x + dx, g, z + dz] });
  // air heater: squat drum (rotor is a part)
  const ah = new Vector3(GAS.airHeater.x, g + 18, z);
  b.cyl(7, 2, { seg: 32, c: 'steel', at: [ah.x, g + 10, z] });
  b.cyl(7, 2, { seg: 32, c: 'steel', at: [ah.x, g + 24, z] });
  for (const dx of [-5, 5]) for (const dz of [-5, 5]) b.box(0.8, 10, 0.8, { r: 0, slot: 'metal', c: 'slate', at: [ah.x + dx, g, z + dz] });
  const rotor = b.part('rotor', { at: [ah.x, g + 12, z] });
  rotor.cyl(6.6, 12, { seg: 32, slot: 'gloss', c: ['orange.dark', 'amber'] });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI;
    rotor.box(13.4, 12.2, 0.25, { r: 0, slot: 'metal', c: 'slate', at: [0, 0, 0], rot: [0, a, 0] });
  }
  // electrostatic precipitator: three fields + hoppers; front wall as a part
  const espX0 = GAS.esp.x - GAS.esp.w / 2;
  const fieldW = GAS.esp.w / 3;
  const espTop = g + 30;
  const espFields: Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const x = espX0 + fieldW * (i + 0.5);
    espFields.push(new Vector3(x, g + 22, z));
    // casing open to the south (the lid is the front wall): back wall, partition, floor plate
    b.box(fieldW - 0.6, 16, 0.6, { r: 0.2, c: steel, at: [x, g + 14, z - 8.7] });
    b.box(0.5, 16, 18, { r: 0.1, c: steel, at: [x + fieldW / 2 - 0.3, g + 14, z] });
    b.box(fieldW - 0.6, 0.5, 18, { r: 0.1, c: steel, at: [x, g + 14, z] });
    b.add(G.cone(5.5, 7, { seg: 4 }), { c: ['slate', 'steel'], at: [x, g + 14, z], rot: [Math.PI, Math.PI / 4, 0] });
    b.box(1.2, 7, 1.2, { r: 0.1, slot: 'metal', c: 'slate', at: [x, g, z] });
    b.box(fieldW, 1.2, 19, { r: 0.2, slot: 'gloss', c: 'amber', at: [x, espTop, z] });
    b.box(3, 1.4, 3, { r: 0.2, slot: 'metal', c: 'slate', at: [x, espTop + 1.2, z] }); // rappers' drive
  }
  for (const dx of [-GAS.esp.w / 2 + 1, GAS.esp.w / 2 - 1]) for (const dz of [-8, 8]) b.box(1, 14, 1, { r: 0, slot: 'metal', c: 'slate', at: [GAS.esp.x + dx, g, z + dz] });
  const espLid = b.part('espLid', { at: [GAS.esp.x, g + 14, z + 9.2] });
  espLid.box(GAS.esp.w - 0.4, 16, 0.6, { r: 0.2, c: steel });
  // induced-draft fans: two volutes with motors
  for (const dz of [-5, 5]) {
    b.cyl(4, 3, { seg: 28, axis: 'z', slot: 'gloss', c: ['blue.dark', 'blue'], at: [GAS.fan.x, g + 5, z + dz - 1.5] });
    b.cyl(1.4, 3.4, { seg: 18, axis: 'x', slot: 'metal', c: 'slate', at: [GAS.fan.x + 3, g + 5, z + dz] });
  }
  // absorber: banded cylinder with a removable front sector, spray headers inside
  const fgd = GAS.fgd;
  const shell = G.revolve([[fgd.r, 0], [fgd.r, fgd.h], [fgd.r - 0.6, fgd.h], [fgd.r - 0.6, 0]], { seg: 40, phiStart: 2.2, phiLength: Math.PI * 2 - 1.9 });
  b.add(shell.shell, { slot: 'gloss', c: ['steel', 'white'], at: [fgd.x, g, z] });
  const lid = G.revolve([[fgd.r, 0], [fgd.r, fgd.h], [fgd.r - 0.6, fgd.h], [fgd.r - 0.6, 0]], { seg: 14, phiStart: 0.3, phiLength: 1.9 });
  b.part('fgdLid', { at: [fgd.x, g, z] }).add(lid.shell, { slot: 'gloss', c: ['steel', 'white'] });
  b.cyl(fgd.r + 0.6, 1.4, { seg: 40, slot: 'gloss', c: 'amber', at: [fgd.x, g + fgd.h, z] });
  for (const k of [0.62, 0.7, 0.78]) b.cyl(0.35, fgd.r * 1.9, { seg: 10, axis: 'x', slot: 'metal', c: 'mist', at: [fgd.x - fgd.r * 0.95, g + fgd.h * k, z] });
  b.dome(fgd.r - 0.8, 4, { seg: 32, slot: 'matte', c: col('mist').lerp(col('white'), 0.4), at: [fgd.x, g + 1.5, z] }); // slurry sump
  // ducts (world coordinates of the gas centre line)
  const outlet = new Vector3(BOILER.x + BOILER.w / 2, g + 24, z);
  const route = [
    outlet,
    new Vector3(scr.x - 6, g + 24, z),
    new Vector3(scr.x + 6, g + 24, z),
    new Vector3(ah.x, g + 26, z),
    new Vector3(ah.x, g + 6, z),
    new Vector3(espX0 - 4, g + 6, z),
    new Vector3(espX0 - 2, g + 22, z),
    new Vector3(GAS.esp.x + GAS.esp.w / 2 + 2, g + 22, z),
    new Vector3(GAS.fan.x - 4, g + 5, z),
    new Vector3(GAS.fan.x + 6, g + 5, z),
    new Vector3(fgd.x - fgd.r, g + 8, z),
    new Vector3(fgd.x, g + 10, z),
    new Vector3(fgd.x, g + fgd.h - 2, z),
    new Vector3(GAS.stack.x, g + fgd.h - 4, z),
    new Vector3(GAS.stack.x, g + 30, z),
    new Vector3(GAS.stack.x, g + GAS.stack.h, z),
  ];
  const ductRuns: [number, number][] = [[0, 1], [2, 4], [4, 6], [7, 9], [9, 11], [12, 14]];
  for (const [i, j] of ductRuns) addPipe(b, route.slice(i, j + 1).map((p) => [p.x, p.y, p.z] as const), { radius: 2.4, color: duct, bend: 3, flangeEvery: 9 });
  const body = b.build();
  const chimney = stack({ height: GAS.stack.h, radius: 6.4, bands: 3 });
  chimney.group.position.set(GAS.stack.x, g, z);
  const fanBox = new Vector3(GAS.fan.x, g + 5, z);
  const fgdMid = new Vector3(fgd.x, g + fgd.h / 2, z);
  return {
    models: [body, chimney],
    body,
    chimney,
    route,
    marks: { scr, airHeater: ah, esp: new Vector3(GAS.esp.x, g + 22, z), fan: fanBox, fgd: fgdMid, stackTop: route[route.length - 1]!.clone(), espFields },
    setOpen(open) {
      body.part('espLid').position.y = g + 14 - open * 18;
      body.part('espLid').visible = open < 0.95;
      body.part('fgdLid').visible = open < 0.5;
    },
    update(dt) {
      body.part('rotor').rotation.y += dt * 0.35;
    },
  };
}
