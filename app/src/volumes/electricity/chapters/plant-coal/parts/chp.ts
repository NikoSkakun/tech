/**
 * Step 10 set: the city on its own snowy islet east of the plant (blocks of flats, a downtown, lit windows), the
 * district-heating mains on supports from the plant to the city — supply `orange` (≈ 90–130 °C) and return `blue`
 * (≈ 50–70 °C) with water flowing in them — the network heaters by the turbine hall and the heat accumulator
 * tank, and a thermometer in a flat at the edge of the city (kit `levelTube`) that warms with the heat delivered.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, type Flow } from '@/fx';
import { Builder, addApartmentBlock, addPipe, cityBlock, heatExchanger, island, levelTube, verticalTank, type Island, type KitModel, type LevelTube } from '@/kit';
import { CITY, ISLAND } from '../layout';
import { noShadow } from './shadows';

export interface Chp {
  /** Everything of the step (one actor): heaters, accumulator, mains, thermometer. */
  group: Group;
  /** The city islet (always there, on the horizon). */
  city: Island;
  lit: KitModel[];
  supply: Flow;
  back: Flow;
  thermometer: LevelTube;
  points: { heaters: Vector3; accumulator: Vector3; supply: Vector3; back: Vector3; flat: Vector3; city: Vector3 };
  /** Heat delivered 0…1 of the maximum: flow density and speed in the mains, thermometer level. */
  setHeat(share: number): void;
}

const g = ISLAND.ground;

export function buildChp(ctx: ChapterContext): Chp {
  const city = island({ radius: CITY.r, seed: 5, relief: 1, biome: 'snow', underside: 'floating', depth: 90, wobble: 0.5 });
  city.group.position.set(CITY.x, 0, CITY.z);
  const lit: KitModel[] = [];
  const downtown = cityBlock({ size: [120, 90], floors: [4, 16], lit: 0.8, seed: 7 });
  city.place(downtown.group, 10, -10);
  lit.push(downtown);
  // three blocks of flats in one model (one draw call per material)
  const flats = new Builder('flats');
  for (const [x, z, ry] of [[-70, 40, 0.3], [-40, 70, -0.2], [60, 60, 0.5]] as const) {
    flats.frame({ at: [x, city.heightAt(x, z), z], rot: [0, ry, 0] }, () => addApartmentBlock(flats, { floors: 9, sections: 3, lit: 0.85, seed: Math.round(x) }));
  }
  const flatsModel = flats.build();
  city.group.add(flatsModel.group);
  lit.push(flatsModel);
  noShadow(city.group);
  const group = new Group();
  // network heaters and heat accumulator east of the turbine hall
  // between the switchyard and the cooling towers (steam comes from the turbine's heating extraction)
  const hx = 236;
  const hz = 20;
  for (const k of [0, 1]) {
    const h = heatExchanger({ length: 12, radius: 2.6, hot: 'orange', cold: 'blue' });
    h.group.position.set(hx + k * 2, g + 2, hz + k * 8);
    group.add(h.group);
  }
  const acc = verticalTank({ radius: 7, height: 28, band: 'orange' });
  acc.group.position.set(hx - 4, g, hz - 26);
  group.add(acc.group);
  // the mains: from the heaters east along the south of the plant, over the gap, into the city
  const cityEdge = new Vector3(CITY.x - CITY.r * 0.8, g + 4, CITY.z + 30);
  const route = (dz: number): Vector3[] => [
    new Vector3(hx + 6, g + 4, hz + dz),
    new Vector3(hx + 26, g + 8, hz + 2 + dz),
    new Vector3(300, g + 18, -20 + dz),
    new Vector3(cityEdge.x, g + 8, cityEdge.z + dz),
    new Vector3(CITY.x - 10, g + 6, CITY.z + 10 + dz),
  ];
  const sup = route(0);
  const ret = route(5);
  const mains = new Builder('heat-mains');
  addPipe(mains, sup.map((p) => [p.x, p.y, p.z] as const), { radius: 1.1, color: 'orange', bend: 8, supportEvery: 22 });
  addPipe(mains, ret.map((p) => [p.x, p.y, p.z] as const), { radius: 1.1, color: 'blue', bend: 8, supportEvery: 22 });
  group.add(mains.build().group);
  const supply = createFlow(ctx, { kind: 'blob', color: 'orange', paths: sup.map((p) => p.clone().add(new Vector3(0, 1.4, 0))), count: ctx.quality.count(60, 24), radius: 0.7, speed: 18, spread: 0.2, halo: false });
  const back = createFlow(ctx, { kind: 'blob', color: 'blue', paths: [...ret].reverse().map((p) => p.clone().add(new Vector3(0, 1.4, 0))), count: ctx.quality.count(60, 24), radius: 0.7, speed: 18, spread: 0.2, halo: false });
  group.add(supply, back);
  // a flat at the edge of the city with a big thermometer outside its window
  const thermometer = levelTube({ height: 14, radius: 1, color: 'orange', level: 0.3, ticks: 6 });
  const flat = new Vector3(CITY.x - 74, city.heightAt(-74, 58) + 1, CITY.z + 58);
  thermometer.group.position.copy(flat).add(new Vector3(-8, 0, 6));
  group.add(thermometer.group);
  return {
    group,
    city,
    lit,
    supply,
    back,
    thermometer,
    points: { heaters: new Vector3(hx + 1, g + 7, hz + 4), accumulator: new Vector3(hx - 4, g + 30, hz - 26), supply: sup[1]!.clone().add(new Vector3(0, 4, 0)), back: ret[3]!.clone().add(new Vector3(0, -2, 0)), flat: thermometer.group.position.clone().add(new Vector3(0, 16, 0)), city: new Vector3(CITY.x + 10, g + 50, CITY.z - 10) },
    setHeat(share) {
      const k = Math.max(0, Math.min(1, share));
      supply.density = back.density = 0.05 + 0.95 * k;
      supply.speed = back.speed = 6 + 16 * k;
      thermometer.level = 0.25 + 0.65 * k;
    },
  };
}
