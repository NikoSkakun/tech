/**
 * The main building: the tall boiler house (the highest box but the stack) with a removable shell — the south
 * wall splits and slides apart, the roof lifts — the bunker bay on its west side, the long low turbine hall
 * south of it with the kit turbo-set (HP, IP, 2×LP + generator) and the generator step-up transformer.
 */
import { Vector3 } from 'three';
import { Builder, machineHall, powerTransformer, turboSet, type KitModel, type MachineHall, type TurboSet } from '@/kit';
import { col } from '@/style';
import { BOILER, BUNKER, HALL, ISLAND } from '../layout';
import { noShadow } from './shadows';

export interface MainBuilding {
  models: KitModel[];
  shell: KitModel;
  bunker: KitModel;
  hall: MachineHall;
  turbo: TurboSet;
  gsu: KitModel;
  /** Scale of the turbo-set group (the kit machine is drawn larger to read in the hall). */
  turboScale: number;
  /** 0 closed … 1 open: the north wall's halves slide apart, the roof rises (step 4 looks in from the north). */
  setOpen(v: number): void;
  /** 0 … 1: roof of the turbine hall lifted away, its south wall lowered. */
  setHallOpen(v: number): void;
  /** Where things are: furnace window glow anchor, generator terminals, GSU high-voltage side. */
  points: { boilerTop: Vector3; hallRoof: Vector3; genOut: Vector3; gsuHv: Vector3 };
}

const g = ISLAND.ground;
const glass = (): ReturnType<typeof col> => col('blue.dark').lerp(col('sky'), 0.3);

/** Shell of the boiler house; walls as parts so the cutaway can open them. */
function buildShell(): KitModel {
  const { w, d, h } = BOILER;
  const b = new Builder('boiler-house', { windowGlow: 'orange' });
  const wall = [col('steel'), col('mist').lerp(col('white'), 0.2)] as const;
  const panel = (p: Builder, len: number, along: 'x' | 'z', at: [number, number, number], face: number): void => {
    const [sx, sz] = along === 'x' ? [len, 0.8] : [0.8, len];
    p.box(sx, h, sz, { r: 0.2, c: wall, at });
    // tall window strips with furnace glow behind them
    const n = Math.max(2, Math.round(len / 7));
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) / n - 0.5) * (len - 4);
      const off: [number, number, number] = along === 'x' ? [at[0] + u, at[1] + 10, at[2] + face * 0.45] : [at[0] + face * 0.45, at[1] + 10, at[2] + u];
      p.box(along === 'x' ? 2 : 0.2, h - 22, along === 'x' ? 0.2 : 2, { r: 0, slot: 'window', c: glass(), at: off });
    }
    for (const k of [0.32, 0.62, 0.9]) {
      const bandAt: [number, number, number] = [at[0], at[1] + h * k, at[2] + (along === 'x' ? face * 0.45 : 0)];
      p.box(along === 'x' ? len + 0.2 : 0.95, 1, along === 'x' ? 0.95 : len + 0.2, { r: 0, c: 'amber', at: bandAt });
    }
  };
  panel(b, w, 'x', [0, 0, d / 2], 1);
  panel(b, d, 'z', [w / 2, 0, 0], 1);
  panel(b, d, 'z', [-w / 2, 0, 0], -1);
  panel(b.part('frontL', { at: [-w / 4, 0, -d / 2] }), w / 2, 'x', [0, 0, 0], -1);
  panel(b.part('frontR', { at: [w / 4, 0, -d / 2] }), w / 2, 'x', [0, 0, 0], -1);
  const roof = b.part('roof', { at: [0, h, 0] });
  roof.box(w + 2, 1.6, d + 2, { r: 0.3, slot: 'gloss', c: ['amber.dark', 'amber'] });
  roof.box(10, 3, 8, { r: 0.4, c: 'steel', at: [-8, 1.6, -6] });
  roof.box(4, 4, 4, { r: 0.3, slot: 'metal', c: 'slate', at: [12, 1.6, 8] });
  b.anchor('top', 0, h + 6, 0);
  return b.build();
}

function buildBunkerBay(): KitModel {
  const b = new Builder('bunker-bay', { windowGlow: 'amber' });
  b.box(BUNKER.w, BUNKER.h, BUNKER.d, { r: 0.3, c: [col('steel'), col('mist')] });
  b.box(BUNKER.w + 1.2, 1.2, BUNKER.d + 1.2, { r: 0.2, slot: 'gloss', c: 'amber', at: [0, BUNKER.h, 0] });
  for (let i = 0; i < 4; i++) b.box(0.2, 6, 3, { r: 0, slot: 'window', c: glass(), at: [-BUNKER.w / 2 - 0.1, BUNKER.h - 12, -12 + i * 8] });
  return b.build();
}

export function buildMainBuilding(): MainBuilding {
  const shell = buildShell();
  shell.group.position.set(BOILER.x, g, BOILER.z);
  const bunker = buildBunkerBay();
  bunker.group.position.set(BUNKER.x, g, BUNKER.z);
  const hall = machineHall({ length: HALL.length, width: HALL.width, height: HALL.height, units: 1 });
  hall.group.position.set(HALL.x, g + 1, HALL.z);
  const turboScale = 1.9;
  const turbo = turboSet({});
  turbo.group.scale.setScalar(turboScale);
  turbo.group.position.set(HALL.x - (turbo.length * turboScale) / 2, g + 1.4, HALL.z);
  turbo.speed = 2.2;
  const gsu = powerTransformer({ hv: 330, lv: 24, scale: 1.6 });
  gsu.group.position.set(HALL.x + HALL.length / 2 + 12, g, HALL.z + 4);
  gsu.group.rotation.y = Math.PI / 2;
  noShadow(hall.part('crane'));
  const models: KitModel[] = [shell, bunker, hall, turbo, gsu];
  const roofY = hall.part('roof').position.y;
  const frontY = hall.part('front').position.y;
  return {
    models,
    shell,
    bunker,
    hall,
    turbo,
    gsu,
    turboScale,
    setOpen(v) {
      const k = Math.max(0, Math.min(1, v));
      // the halves slide apart, then step out of the way (they would hide the furnace from any front view)
      shell.part('frontL').position.set(-BOILER.w / 4 - k * 16, 0, -BOILER.d / 2 - k * 8);
      shell.part('frontR').position.set(BOILER.w / 4 + k * 16, 0, -BOILER.d / 2 - k * 8);
      shell.part('frontL').visible = shell.part('frontR').visible = k < 0.97;
      shell.part('roof').position.y = BOILER.h + k * 26;
    },
    setHallOpen(v) {
      const k = Math.max(0, Math.min(1, v));
      hall.part('roof').position.y = roofY + k * 40;
      hall.part('roof').visible = k < 0.98;
      // the south wall sinks away so the machine shows from the usual camera side
      hall.part('front').position.y = frontY - k * (HALL.height + 2);
      hall.part('front').visible = k < 0.98;
    },
    points: {
      boilerTop: new Vector3(BOILER.x, g + BOILER.h + 6, BOILER.z),
      hallRoof: new Vector3(HALL.x, g + HALL.height + 2, HALL.z),
      genOut: turbo.anchorWorld('gen.u'),
      gsuHv: gsu.anchorWorld('hv2'),
    },
  };
}
