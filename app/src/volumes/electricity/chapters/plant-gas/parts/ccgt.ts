/**
 * The combined-cycle unit «1+1» in one line (single shaft): main hall with a removable roof and south wall,
 * steam turbine · generator · gas turbine on one shaft, the air-intake filter house on the roof, the exhaust
 * transition into the heat-recovery boiler, the bypass stack with its damper, the main stack, the air-cooled
 * condenser behind the steam turbine. Kit models + chapter models; positions from `layout.ts`.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, addPipe, machineHall, stack, steamTurbine, turbogenerator, type KitModel, type MachineHall, type SteamTurbine, type Turbogenerator } from '@/kit';
import { col } from '@/style';
import { ACC, BYPASS, HALL, HRSG, INTAKE, ISLAND, SHAFT, STACK } from '../layout';
import { buildAcc, type Acc } from './acc';
import { buildHeroGt, type HeroGt } from './gas-turbine';
import { GT_X } from './gt-model';
import { buildHrsg, type HrsgModel } from './hrsg';

export interface Ccgt {
  group: Group;
  hall: MachineHall;
  /** Steam turbine, generator, gas turbine and the shaft (visible with the roof off). */
  interior: Group;
  st: SteamTurbine;
  gen: Turbogenerator;
  gt: HeroGt;
  hrsg: HrsgModel;
  stack: KitModel;
  bypass: KitModel;
  /** Damper of the bypass stack: 0 = gas to the boiler … 1 = gas up the bypass stack. */
  damper: Group;
  acc: Acc;
  intake: KitModel;
  /** Exhaust transition duct (turbine → boiler) with the branch to the bypass stack. */
  exhaustDuct: KitModel;
  /** HP steam line boiler → steam turbine (world points, for the steam flow). */
  steamPath: Vector3[];
  /** Floor level of the hall (world y). */
  floorY: number;
  /** Shaft axis height (world y). */
  axisY: number;
  /** All models (lit windows, lamps). */
  lit: KitModel[];
  /** Steam turbine speed share 0…1 (single shaft with a self-synchronising clutch: 0 = boiler off, ST at rest). */
  stSpin: number;
  update(dt: number): void;
}

export function buildCcgt(ctx: ChapterContext): Ccgt {
  const group = new Group();
  group.name = 'ccgt';
  const floorY = ISLAND.y + 0.32;
  const axisY = floorY + SHAFT.axisY;
  const hall = machineHall({ length: HALL.length, width: HALL.width, height: HALL.height, units: 2, color: col('mist').lerp(col('violet.light'), 0.18) });
  hall.group.position.set(HALL.x, ISLAND.y, HALL.z);
  const st = steamTurbine({ sections: ['hp', 'ip', 'lp'], axisHeight: SHAFT.axisY });
  st.group.position.set(SHAFT.gtX - 18.5 - st.length, floorY, SHAFT.z);
  const gen = turbogenerator({ axisHeight: SHAFT.axisY, cut: 0 });
  // coupling toward the gas turbine (east), exciter toward the steam turbine
  gen.group.position.set(SHAFT.gtX - 0.6, floorY, SHAFT.z);
  gen.group.rotation.y = Math.PI;
  const gt = buildHeroGt(ctx);
  gt.group.position.set(SHAFT.gtX, axisY, SHAFT.z);
  // shaft piece between the steam turbine and the generator's far end (the line is one shaft)
  const link = new Builder('shaft-link');
  link.cyl(0.32, 6, { axis: 'x', seg: 16, slot: 'metal', c: 'mist', at: [SHAFT.gtX - 19, axisY, SHAFT.z] });
  // the machines are only seen with the roof off (steps 3–5): one group the stage shows / hides
  const interior = new Group();
  interior.name = 'hall-interior';
  interior.add(st.group, gen.group, gt.group, link.build().group);
  group.add(hall.group, interior);

  // air-intake filter house on the roof with its downcomer duct to the compressor inlet plenum
  const ib = new Builder('air-intake');
  const plenumX = SHAFT.gtX + (GT_X.plenum0 + GT_X.igv) / 2;
  ib.box(3.2, INTAKE.y - axisY - 1.5, 3.6, { r: 0.2, c: ['sky.dark', 'sky.light'], at: [plenumX, axisY + 1.5, SHAFT.z] });
  ib.box(9, 7, 12, { r: 0.3, c: ['mist', 'white'], at: [plenumX, INTAKE.y, INTAKE.z] });
  for (let k = 0; k < 6; k++) ib.box(9.4, 0.5, 1.2, { r: 0.1, slot: 'metal', c: 'steel', at: [plenumX, INTAKE.y + 0.8 + k * 1.05, INTAKE.z - 6.4], rot: [0.5, 0, 0] });
  ib.box(9.4, 0.8, 12.4, { r: 0.1, slot: 'matte', c: 'slate', at: [plenumX, INTAKE.y + 7, INTAKE.z] });
  ib.anchor('mouth', plenumX, INTAKE.y + 3.5, INTAKE.z - 7);
  const intake = ib.build();

  // exhaust transition: round diffuser → rectangular boiler inlet, and the bypass stack branching off it
  const tb = new Builder('exhaust-duct');
  const exX = SHAFT.gtX + GT_X.end;
  // cone from the diffuser (⌀ 4.9 m) to a tall rectangular duct that meets the boiler's inlet face
  tb.cyl(2.45, 3, { axis: 'x', rTop: 3.4, seg: 32, slot: 'gloss', c: ['coral.dark', 'coral'], at: [exX, axisY, SHAFT.z], bevel: 0.1 });
  const ductH = HRSG.height - 2;
  tb.box(HRSG.x0 - exX - 2.6, ductH, HRSG.width - 3, { r: 0.4, c: ['coral.dark', 'coral'], at: [(exX + 2.8 + HRSG.x0) / 2, ISLAND.y + 1.2, SHAFT.z] });
  tb.box(4, 6, BYPASS.z - SHAFT.z, { r: 0.3, c: ['coral.dark', 'coral'], at: [BYPASS.x, axisY - 2, SHAFT.z + 2] });
  const ductModel = tb.build();
  const bypass = stack({ height: BYPASS.height, radius: BYPASS.radius, bands: 1 });
  bypass.group.position.set(BYPASS.x, ISLAND.y, BYPASS.z);
  const damper = new Group();
  const db = new Builder('damper');
  db.box(0.3, 5.4, 5.4, { r: 0.1, slot: 'metal', c: 'amber', at: [0, -2.7, 0], mid: false });
  damper.add(db.build().group);
  damper.position.set(BYPASS.x - 1.6, axisY + 2.7, SHAFT.z + 3.2);

  const hrsg = buildHrsg({ length: HRSG.x1 - HRSG.x0, width: HRSG.width, height: HRSG.height, inletY: axisY - ISLAND.y });
  hrsg.group.position.set(HRSG.x0, ISLAND.y, HRSG.z);
  const main = stack({ height: STACK.height, radius: STACK.radius, bands: 2 });
  main.group.position.set(STACK.x, ISLAND.y, STACK.z);
  const ob = new Builder('stack-duct');
  ob.box(STACK.x - HRSG.x1 + 1, 9, 10, { r: 0.4, c: ['steel', 'mist'], at: [HRSG.x1 + (STACK.x - HRSG.x1) / 2 - 0.5, 10, 0] });
  const outDuct = ob.build();
  outDuct.group.position.set(0, ISLAND.y, HRSG.z);

  // HP steam line: from the boiler's superheater outlet over the roof down to the steam turbine's inlet
  hrsg.group.updateMatrixWorld(true);
  st.group.updateMatrixWorld(true);
  const shOut = hrsg.group.localToWorld(new Vector3(hrsg.bundles[0]!.x, HRSG.height + 1.4, -2));
  const stIn = st.anchorWorld('steamIn');
  const steamPath = [shOut, shOut.clone().setY(HRSG.height + 6), new Vector3(stIn.x, HRSG.height + 6, -2), new Vector3(stIn.x, stIn.y + 2.5, -2), stIn.clone().add(new Vector3(0, 1.2, 0))];
  const sb = new Builder('steam-line');
  addPipe(sb, steamPath.map((p) => [p.x, p.y, p.z] as [number, number, number]), { radius: 0.45, color: col('white').lerp(col('pink'), 0.25), supportEvery: 0 });
  const steamLine = sb.build();
  const acc = buildAcc(ACC);
  acc.group.position.set(ACC.x, ISLAND.y, ACC.z);
  group.add(steamLine.group, intake.group, ductModel.group, bypass.group, damper, hrsg.group, main.group, outDuct.group, acc.group);
  const genRotor = gen.part('rotor');
  let genAngle = 0;
  const ccgt: Ccgt = {
    group,
    hall,
    interior,
    st,
    gen,
    gt,
    hrsg,
    stack: main,
    bypass,
    damper,
    acc,
    intake,
    exhaustDuct: ductModel,
    steamPath,
    floorY,
    axisY,
    lit: [hall, main, bypass],
    stSpin: 1,
    update(dt) {
      gt.update(dt);
      // one shaft: the generator (turned 180°) and the steam turbine follow the gas turbine's angle
      genAngle += gt.speed * dt;
      genRotor.rotation.x = -genAngle;
      st.speed = ccgt.stSpin * gt.speed;
      st.update?.(dt, 0);
      acc.update(dt);
    },
  };
  return ccgt;
}
