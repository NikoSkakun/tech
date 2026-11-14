/**
 * The whole power station as one object the steps share: coal handling, the main building, the gas path and
 * the rest of the site, plus the ambient effects that keep it alive (cooling-tower plumes, the vapour over the
 * stack, the furnace glow in the boiler-house windows, blinking aviation lights).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createHalo, createPlume, type ParticleSystem } from '@/fx';
import type { KitModel } from '@/kit';
import { buildBoilerCore, type BoilerCore } from './boiler-core';
import { buildBoilerFx, type BoilerFx } from './boiler-fx';
import { buildGasPath, type GasPath } from './gas-path';
import { buildMainBuilding, type MainBuilding } from './main-building';
import { buildSite, type Site } from './site';
import type { World } from './world';
import { buildYard, type Yard } from './yard';

export interface Plant {
  group: Group;
  yard: Yard;
  main: MainBuilding;
  gas: GasPath;
  site: Site;
  /** Inside the boiler house (step 4): models + effects in the shell frame, shown as one stage actor. */
  interior: Group;
  core: BoilerCore;
  boilerFx: BoilerFx;
  /** Plumes over the cooling towers, white vapour and dark smoke over the stack (step 8 blends them). */
  plumes: ParticleSystem[];
  stackVapour: ParticleSystem;
  stackSmoke: ParticleSystem;
  /** Every model with lit windows / lamps (time of day). */
  lit: KitModel[];
  update(dt: number, t: number): void;
}

export function buildPlant(ctx: ChapterContext, world: World): Plant {
  const group = new Group();
  group.name = 'plant';
  world.island.group.add(group);
  const yard = buildYard();
  const main = buildMainBuilding();
  const gas = buildGasPath();
  for (const m of [...yard.models, ...main.models, ...gas.models]) group.add(m.group);
  const site = buildSite(world);
  const core = buildBoilerCore();
  const interior = new Group();
  interior.name = 'boiler-interior';
  for (const m of [core.body, core.tubes, core.wall, core.drum, core.separators]) interior.add(m.group);
  const origin = main.shell.group.position;
  const outsideGas = gas.route.slice(1, 6).map((p) => p.clone().sub(origin));
  const boilerFx = buildBoilerFx(ctx, core, { gas: outsideGas });
  interior.add(boilerFx.group);
  // the interior is authored with its open side south; mirrored so it faces the north opening of the shell
  interior.scale.z = -1;
  main.shell.group.add(interior);
  // ambient effects (metres): big slow plumes, a thin vapour trail over the stack
  const wind: [number, number, number] = [3, 0, -1];
  const plumes = site.points.towerTops.map((p) => {
    const plume = createPlume(ctx, { radius: 10, height: 70, wind, count: ctx.quality.count(44, 18) });
    plume.position.copy(p);
    group.add(plume);
    return plume;
  });
  const top = gas.marks.stackTop;
  // the vapour presets rise ≈ 1 unit/s (tuned for 1-unit scenes): the plume preset scales its rise with the radius
  const stackVapour = createPlume(ctx, { radius: 6, height: 54, wind: [4, 0, -1], count: ctx.quality.count(40, 16) });
  stackVapour.position.copy(top);
  stackVapour.rate = 0.5;
  const stackSmoke = createPlume(ctx, { radius: 7, height: 70, wind: [4, 0, -1], count: ctx.quality.count(70, 24), color: ['slate', 'steel', 'steel'], opacity: 0.95 });
  stackSmoke.position.copy(top);
  stackSmoke.setEmitting(false, true);
  group.add(stackVapour, stackSmoke);
  // aviation lights: two on the stack, one on each tower rim
  const beaconSpots = [top.clone().add(new Vector3(0, -2, 0)), top.clone().setY(top.y * 0.55), ...site.points.towerTops];
  const beacons = beaconSpots.map((p) => {
    const h = createHalo({ color: 'red', size: 7, intensity: 1.6 });
    h.position.copy(p);
    group.add(h);
    return h;
  });
  const lit: KitModel[] = [main.shell, main.bunker, main.hall, yard.models[4]!, site.switchyard];
  return {
    group,
    yard,
    main,
    gas,
    site,
    interior,
    core,
    boilerFx,
    plumes,
    stackVapour,
    stackSmoke,
    lit,
    update(dt, t) {
      yard.update(dt, t);
      main.turbo.update(dt, t);
      gas.update(dt);
      if (interior.visible) boilerFx.update(dt);
      // red beacons flash together, 1 s period, short on-time
      const on = (t % 1.6) < 0.35 ? 1 : 0.05;
      for (const b of beacons) b.intensity = 1.8 * on;
    },
  };
}
