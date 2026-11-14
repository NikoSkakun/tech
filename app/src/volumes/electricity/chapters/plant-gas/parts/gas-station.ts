/**
 * Gas side of the island: the trunk pipeline from the island's west edge, the gas receiving station (inlet
 * valve → filter separators → gas heater → metering run → booster compressor; odorant tank, control room) and
 * the fuel line on low supports to the gas turbine's fuel ring in the main hall. Pipes are `violet`-banded
 * (fuel, STYLE_GUIDE §2.2). `route` is the whole gas path in world space for the `violet` flow. The 18 m run
 * between the trunk and the filters is left open: step 2 lays its transparent pipe segment there (`at.glass`).
 */
import { Vector3 } from 'three';
import { Builder, addHeatExchanger, addHorizontalTank, addPipe, addValve, addVerticalTank, controlRoom, type KitModel } from '@/kit';
import { col } from '@/style';
import { GAS, ISLAND, SHAFT } from '../layout';
import { GT_X } from './gt-model';

export interface GasStation {
  models: KitModel[];
  /** Gas path, world: trunk → station → hall. */
  route: Vector3[];
  /** Indices into `route` of the station inlet and outlet. */
  inlet: number;
  outlet: number;
  /** World anchors: filter, heater, meter, booster, odorant, glass (the transparent pipe segment of step 2). */
  at: Record<'filter' | 'heater' | 'meter' | 'booster' | 'odorant' | 'glass' | 'valve', Vector3>;
}

export function buildGasStation(axisY: number): GasStation {
  const g = GAS.station;
  const y0 = ISLAND.y;
  const py = y0 + GAS.pipeY;
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  // the gas path, west → east
  const trunk = [v(GAS.pipeIn[0], py, GAS.pipeIn[1]), v(g.x - 72, py, GAS.pipeIn[1]), v(g.x - 54, py, g.z), v(g.x - 34, py, g.z)];
  const inside = [v(g.x - 16, py, g.z), v(g.x, py, g.z), v(g.x + 12, py, g.z), v(g.x + 22, py, g.z)];
  const fuelX = SHAFT.gtX + GT_X.burn0 + 0.05;
  const toHall = [v(g.x + 34, py, g.z - 4), v(-104, py, -17), v(fuelX, py, -17), v(fuelX, py, -3.4), v(fuelX, axisY - 2.42, -0.6)];
  const route = [...trunk, ...inside, ...toHall];

  const pb = new Builder('gas-pipes');
  const pipe = { radius: 0.55, color: col('mist').lerp(col('violet.light'), 0.25), supportEvery: 9, flangeEvery: 18 };
  addPipe(pb, trunk.map((p) => [p.x, p.y, p.z] as [number, number, number]), pipe);
  addPipe(pb, [...inside, ...toHall.slice(0, 3)].map((p) => [p.x, p.y, p.z] as [number, number, number]), { ...pipe, radius: 0.4 });
  addPipe(pb, toHall.slice(2).map((p) => [p.x, p.y, p.z] as [number, number, number]), { ...pipe, radius: 0.3, supportEvery: 0 });
  // violet bands every 12 m (fuel colour code)
  for (let x = GAS.pipeIn[0] + 6; x < g.x - 76; x += 12) pb.cyl(0.62, 0.5, { axis: 'x', seg: 18, slot: 'gloss', c: 'violet', at: [x, py, GAS.pipeIn[1]] });
  const pipes = pb.build();

  // the station itself, built around its own origin
  const sb = new Builder('gas-station');
  sb.box(56, 0.4, 30, { r: 0.2, slot: 'matte', c: ['steel', 'mist'], at: [0, 0, 0] });
  sb.frame({ at: [-42, GAS.pipeY - 0.55, 0] }, () => addValve(sb, { radius: 0.55 }), 'valve.');
  sb.anchor('valve', -42, 2.6, 0);
  // two filter separators side by side, then the heater, the meter run, the booster
  for (const dz of [-3.2, 3.2]) sb.frame({ at: [-12, 0.4, dz] }, () => addVerticalTank(sb, { radius: 1.3, height: 5.2, color: 'white', band: 'violet' }), dz < 0 ? 'f1.' : 'f2.');
  sb.anchor('filter', -12, 6.4, 3.2);
  sb.frame({ at: [-4, 1.6, 6], rot: [0, 0, 0] }, () => addHeatExchanger(sb, { length: 8, radius: 1.0, hot: 'orange', cold: 'violet', color: 'mist' }), 'heater.');
  sb.anchor('heater', 0, 3.4, 6);
  // metering run: straight pipe with a meter box and a glowing display
  sb.box(2.4, 2.4, 1.6, { r: 0.2, slot: 'gloss', c: ['steel', 'mist'], at: [10, 0.4, -5] });
  sb.box(1.6, 0.9, 0.12, { r: 0.05, slot: 'glow', c: 'cyan', at: [10, 1.6, -4.15] });
  sb.anchor('meter', 10, 3.2, -5);
  // booster compressor: skid, motor, compressor casing
  sb.box(7, 0.6, 3.6, { r: 0.12, slot: 'metal', c: 'slate', at: [6, 0.4, 12] });
  sb.cyl(1.2, 3.2, { axis: 'x', seg: 20, slot: 'gloss', c: ['teal.dark', 'teal'], at: [3, 2.2, 12] });
  sb.cyl(1.5, 2.4, { axis: 'x', seg: 20, slot: 'gloss', c: ['violet.dark', 'violet'], at: [6.6, 2.4, 12] });
  sb.anchor('booster', 6, 4.4, 12);
  sb.frame({ at: [0, 0.4, -11] }, () => addHorizontalTank(sb, { radius: 0.8, length: 3.4, color: 'white', band: 'amber' }), 'odor.');
  sb.anchor('odorant', 0, 2.4, -11);
  const station = sb.build();
  station.group.position.set(g.x, y0, g.z);
  const room = controlRoom({ width: 10, depth: 6 });
  room.group.position.set(g.x - 6, y0, g.z - 18);
  const sAt = (n: string): Vector3 => v(g.x, y0, g.z).add(station.anchorLocal(n));
  return {
    models: [pipes, station, room],
    route,
    inlet: trunk.length,
    outlet: trunk.length + inside.length - 1,
    at: {
      valve: sAt('valve'),
      filter: sAt('filter'),
      heater: sAt('heater'),
      meter: sAt('meter'),
      booster: sAt('booster'),
      odorant: sAt('odorant'),
      glass: v(g.x - 25, py, g.z),
    },
  };
}
