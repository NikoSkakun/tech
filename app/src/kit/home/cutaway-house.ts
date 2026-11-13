/**
 * The shared cutaway house — «будинок-лялька» of `home`, the service entrance of `distribution` and the
 * «дім-лабораторія» of the four labs (DECISIONS §13, §24; `docs/volumes/<volume>/chapters/_shared-house.md`). One model:
 *
 *  ground floor (in front of the spine wall): living room · hall with the distribution board and the lab niche
 *                («комора», the technical corner of the labs) · kitchen; stair and back rooms behind the wall
 *  first floor:  bedroom · study · bathroom; balcony on the east wall
 *  roof (part `roof`): 35° south slope with 12 × ЛМ-440 in two strings; south facade = part `front`.
 *
 * With `lab: true` the niche holds the hybrid inverter ЛІ-6, the 10.24 kWh battery, the DC box and
 * the critical-loads board, and the roof carries the PV array (the `home` chapter shows the house without them).
 * Units: metres; origin = centre of the footprint; the cut (south) side faces +Z.
 *
 * Anchors: rooms `room.<name>`, lamps `light.<room>`, devices by simulator id (`fridge`, `kettle`, `stove`,
 * `microwave`, `boiler_pump`, `water_heater`, `washer`, `air_cond`, `router`, `tv`, `laptop`), `board`,
 * `meter`, `service`, `ev`, and with `lab`: `inverter.*`, `battery.*`, `critical`, `dcbox`, `pv.*`.
 * Paths (cable routes for energy flows): `grid`, `pvDc`, `batDc`, `backup`, `toInverter`.
 */
import { Vector3 } from 'three';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { addBatteryCabinet, type BatteryHandles } from '../energy/battery';
import { addHybridInverter, type InverterHandles } from '../energy/inverter';
import { addPvTable } from '../energy/pv';
import * as A from './appliances';
import { addDistributionBoard, type BoardHandles, type DinModule } from './board';
import * as F from './furniture';
import { HOUSE, addHouseShell, type ShellOptions } from './house-shell';

export interface CutawayHouseOptions extends ShellOptions {
  /** Lab equipment (PV array, inverter, battery, DC box, critical-loads board). Default true. */
  lab?: boolean;
  /** Board levers as individual parts (`board.setLever`). Turn off when the house is scenery: −14 draw calls. Default true. */
  boardLevers?: boolean;
}

export interface CutawayHouse extends KitModel {
  board: BoardHandles;
  inverter?: InverterHandles;
  battery?: BatteryHandles;
  /** Show / hide the south facade and the roof (they are parts: tween or fade them for nicer transitions). */
  setOpen(front: boolean, roof?: boolean): void;
}

/** The board of the shared house: main 2P C40 → voltage relay → SPD → RCD → seven MCBs, RCBO (bath), EV. */
const BOARD: DinModule[][] = [
  [{ type: 'main' }, { type: 'relay' }, { type: 'spd', poles: 2 }, { type: 'rcd' }],
  [
    ...(['yellow', 'sky', 'teal', 'orange', 'coral', 'violet', 'blue'] as const).map((tag) => ({ type: 'mcb' as const, tag })),
    { type: 'rcbo', tag: 'pink' },
    { type: 'mcb', tag: 'lime' },
  ],
];

const floorTone = (c: ColorLike): [ReturnType<typeof col>, ReturnType<typeof col>] => [col(c).multiplyScalar(0.92), col(c)];

export function cutawayHouse(o: CutawayHouseOptions = {}): CutawayHouse {
  const { W, D, t, F0, F1, xA, xB, zS } = HOUSE;
  const lab = o.lab ?? true;
  const b = new Builder('cutaway-house');
  const { roof } = addHouseShell(b, o);
  const x0 = -W / 2 + t;
  const x1 = W / 2 - t;
  const z0 = -D / 2 + t;
  const zw = zS + 0.08; // surface of the spine wall facing the cut
  // room floors (coloured plates) and room anchors
  const rooms: [string, number, number, number, number, number, ColorLike][] = [
    ['living', x0, xA, zS, D / 2, F0, 'orange.light'],
    ['hall', xA, xB, zS, D / 2, F0, 'yellow.light'],
    ['kitchen', xB, x1, zS, D / 2, F0, 'sky.light'],
    ['back', x0, x1, z0, zS, F0, 'mist'],
    ['bedroom', x0, xA, zS, D / 2, F1, 'pink.light'],
    ['study', xA, xB, zS, D / 2, F1, 'lime.light'],
    ['bathroom', xB, x1, zS, D / 2, F1, 'teal.light'],
  ];
  for (const [name, ax, bx, az, bz, y, c] of rooms) {
    b.box(bx - ax - 0.12, 0.04, bz - az - 0.12, { r: 0.02, slot: 'matte', c: floorTone(c), at: [(ax + bx) / 2, y, (az + bz) / 2] });
    b.anchor(`room.${name}`, (ax + bx) / 2, y + 1.3, (az + bz) / 2);
  }
  b.anchor('room.tech', 0.9, F0 + 1.3, 1.2);
  const put = (x: number, y: number, z: number, ry: number, fn: () => void, prefix = ''): void => void b.frame({ at: [x, y, z], rot: [0, ry, 0] }, fn, prefix);
  // living room: TV on the spine wall, sofa along the west wall
  put(-2.9, F0, 2.0, 0, () => F.addRug(b, 2.4, 1.8, 'teal'));
  put(-4.2, F0, 2.0, Math.PI / 2, () => F.addSofa(b, 'coral'));
  put(-2.1, F0, zw + 0.25, 0, () => F.addTv(b));
  put(-2.9, F0, 2.0, 0, () => F.addTable(b, 0.9, 0.55, 0.4));
  put(-2.1, F0 + 1.63, zw + 0.12, 0, () => A.addRouter(b));
  b.box(0.5, 0.04, 0.24, { r: 0.01, c: 'white', at: [-2.1, F0 + 1.58, zw + 0.12] });
  put(-4.3, F0, 3.3, 0, () => F.addFloorLamp(b), 'floor.');
  put(-1.75, F0, 3.3, 0, () => F.addPlant(b, 1.2));
  put(x0 + 0.02, F0 + 2.25, 0.9, Math.PI / 2, () => A.addAirConIndoor(b));
  // hall: the distribution board on the spine wall, next to the lab niche
  const bindBoard = ((): ((m: KitModel) => BoardHandles) => {
    let bind!: (m: KitModel) => BoardHandles;
    put(-0.85, F0 + 1.55, zw, 0, () => (bind = addDistributionBoard(b, { rows: BOARD, leverParts: o.boardLevers })), 'board.');
    return bind;
  })();
  b.anchor('board', -0.85, F0 + 1.55, zw + 0.25);
  put(-0.9, F0, 3.2, 0, () => F.addPlant(b, 0.8));
  // kitchen: run on the spine wall, fridge and gas boiler on the east wall, dining table
  put(3.25, F0, zw + 0.3, 0, () => A.addKitchen(b, 2.3));
  put(x1 - 0.36, F0, 3.0, -Math.PI / 2, () => A.addFridge(b));
  put(x1 - 0.02, F0 + 1.75, 1.3, -Math.PI / 2, () => A.addGasBoiler(b));
  put(2.9, F0, 2.5, 0, () => F.addTable(b, 1.0, 0.75));
  put(2.9, F0, 3.15, Math.PI, () => F.addChair(b, 'yellow'));
  put(2.25, F0, 2.5, Math.PI / 2, () => F.addChair(b, 'coral'));
  // first floor: bedroom, study, bathroom; balcony with the outdoor unit
  put(-2.6, F1, zw + 1.12, 0, () => F.addBed(b, 'violet'));
  put(-4.35, F1, 2.4, Math.PI / 2, () => F.addWardrobe(b));
  put(-2.6, F1, 2.9, 0, () => F.addRug(b, 2.0, 1.1, 'violet'));
  put(0.1, F1, zw + 0.35, 0, () => F.addDesk(b));
  put(0.1, F1, zw + 1.0, Math.PI, () => F.addChair(b, 'teal'));
  put(1.35, F1, zw + 0.17, 0, () => F.addShelf(b, 0.9, 1.7));
  put(-0.8, F1, 3.1, 0, () => F.addPlant(b, 1.0));
  put(3.6, F1, zw + 0.4, 0, () => A.addBath(b));
  put(2.35, F1, zw + 0.25, 0, () => A.addBasin(b));
  put(4.1, F1 + 1.75, zw, 0, () => A.addWaterHeater(b));
  put(x1 - 0.3, F1, 3.2, -Math.PI / 2, () => A.addWasher(b));
  put(x1 - 0.3, F1, 2.2, -Math.PI / 2, () => A.addToilet(b));
  put(W / 2 + 0.2, F1, 1.4, Math.PI / 2, () => A.addAirConOutdoor(b));
  // ceiling lamps (ground floor under the slab; first floor hangs from the roof part)
  const lampSpots = [[-3.0, 2.0], [0.3, 2.0], [3.3, 2.0]] as const;
  (['living', 'hall', 'kitchen'] as const).forEach((name, i) => {
    put(lampSpots[i]![0], 3.0, lampSpots[i]![1], 0, () => F.addCeilingLamp(b), `light.${name}.`);
    b.anchor(`light.${name}`, lampSpots[i]![0], 2.5, lampSpots[i]![1]);
  });
  (['bedroom', 'study', 'bathroom'] as const).forEach((name, i) => {
    roof.frame({ at: [lampSpots[i]![0], 0, lampSpots[i]![1]] }, () => F.addCeilingLamp(roof), `light.${name}.`);
    b.anchor(`light.${name}`, lampSpots[i]![0], HOUSE.eaves - 0.5, lampSpots[i]![1]);
  });
  // service entrance and meter box on the west wall, EV wallbox on the east wall
  put(-W / 2 - 0.02, F0 + 1.4, 2.9, -Math.PI / 2, () => {
    b.box(0.5, 0.7, 0.2, { r: 0.04, slot: 'gloss', c: 'mist', at: [0, -0.35, 0.02] });
    b.box(0.26, 0.2, 0.03, { r: 0.01, slot: 'gloss', c: 'ink', at: [0, 0.02, 0.21] });
    b.sphere(0.02, { seg: 6, slot: 'glow', c: 'red', at: [0.16, 0.1, 0.22] });
    b.cyl(0.04, 3.4, { seg: 6, slot: 'metal', c: 'slate', at: [0, 0.35, 0.08], bevel: 0 });
    b.sphere(0.09, { seg: 8, slot: 'gloss', c: 'white', at: [0, 3.8, 0.08] });
    b.anchor('meter', 0, 0, 0.3);
    b.anchor('service', 0, 3.8, 0.08);
  });
  put(W / 2 + 0.02, F0 + 1.1, -1.5, Math.PI / 2, () => {
    b.box(0.34, 0.5, 0.16, { r: 0.05, slot: 'gloss', c: 'white', at: [0, -0.25, 0.01] });
    b.ring(0.07, 0.012, { axis: 'z', seg: 14, tubeSeg: 4, slot: 'glow', c: 'green', at: [0, 0.05, 0.18] });
    b.anchor('ev', 0, 0, 0.3);
  });
  const P = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  const yc = F0 + 2.55; // cables run under the ceiling
  b.path('grid', [P(-W / 2 - 0.1, F0 + 5.2, 2.9), P(-W / 2 - 0.1, F0 + 1.4, 2.9), P(x0, yc, 2.9), P(x0, yc, zw), P(-0.85, yc, zw), P(-0.85, F0 + 1.75, zw)]);
  let bindInverter: InverterHandles | undefined;
  let bindBattery: BatteryHandles | undefined;
  if (lab) {
    // lab niche on the spine wall: critical-loads board, inverter, DC box; battery cabinet on the floor
    put(0.5, F0 + 1.5, zw, 0, () => (bindInverter = addHybridInverter(b)), 'inverter.');
    put(1.45, F0, zw + 0.14, 0, () => (bindBattery = addBatteryCabinet(b)), 'battery.');
    put(-0.2, F0 + 1.6, zw, 0, () => {
      b.box(0.3, 0.36, 0.11, { r: 0.02, mid: true, slot: 'gloss', c: 'white', at: [0, 0, 0.055] });
      for (let i = 0; i < 5; i++) b.box(0.03, 0.05, 0.02, { r: 0, mid: true, slot: 'gloss', c: i === 0 ? 'red' : 'slate', at: [-0.09 + i * 0.045, 0, 0.12] });
      b.anchor('critical', 0, 0, 0.2);
    });
    put(1.05, F0 + 2.0, zw, 0, () => {
      b.box(0.24, 0.3, 0.1, { r: 0.02, mid: true, slot: 'gloss', c: 'mist', at: [0, 0, 0.05] });
      b.cyl(0.035, 0.02, { axis: 'z', seg: 12, slot: 'gloss', c: 'yellow', at: [0, 0, 0.1] });
      b.box(0.018, 0.06, 0.02, { r: 0, mid: true, slot: 'gloss', c: 'red', at: [0, 0, 0.125] });
      b.anchor('dcbox', 0, 0, 0.2);
    });
    // PV array on the south slope: 2 rows × 6 modules, portrait
    const pitch = HOUSE.pitch;
    const zr = D / 4 + 0.1;
    roof.frame({ at: [0.6, (D / 2 - zr) * Math.tan(pitch) + 0.16, zr], rot: [pitch, 0, 0] }, () => addPvTable(roof, { cols: 6, rows: 2, mount: 'roof' }), 'pv.');
    b.path('pvDc', [P(4.05, HOUSE.eaves + 0.5, 3.6), P(xB, HOUSE.eaves - 0.3, 3.6), P(xB, yc, 3.6), P(xB, yc, zw), P(1.05, yc, zw), P(1.05, F0 + 2.15, zw), P(0.35, F0 + 1.15, zw + 0.13)]);
    b.path('batDc', [P(1.8, F0 + 0.98, zw + 0.14), P(1.8, F0 + 1.1, zw + 0.3), P(0.46, F0 + 1.1, zw + 0.3), P(0.46, F0 + 1.16, zw + 0.13)]);
    b.path('backup', [P(0.63, F0 + 1.16, zw + 0.13), P(0.63, F0 + 0.95, zw + 0.2), P(-0.2, F0 + 0.95, zw + 0.2), P(-0.2, F0 + 1.42, zw + 0.06)]);
    b.path('toInverter', [P(-0.85, F0 + 1.35, zw), P(-0.85, F0 + 0.7, zw + 0.1), P(0.56, F0 + 0.7, zw + 0.1), P(0.56, F0 + 1.16, zw + 0.13)]);
  }
  const model = b.build();
  return Object.assign(model, {
    board: bindBoard(model),
    inverter: bindInverter,
    battery: bindBattery,
    setOpen(front: boolean, roofOff = false): void {
      model.part('front').visible = !front;
      model.part('roof').visible = !roofOff;
    },
  });
}
