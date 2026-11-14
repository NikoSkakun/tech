/**
 * Everything built on the island, assembled once: the combined-cycle unit in the centre and the facilities
 * around it (gas station, peaker, engine hall, town, switchyard), plus the island-wide life: `violet` gas
 * flowing to the turbine, heat haze over the stacks, `orange` heat main to the town. Steps receive this bundle
 * through `Deps`.
 */
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, createHeatShimmer, type Flow, type HeatShimmer } from '@/fx';
import { Builder, addPipe, type KitModel } from '@/kit';
import { ENGINES, ISLAND, PEAKER, STACK, TOWN } from '../layout';
import { buildCcgt, type Ccgt } from './ccgt';
import { buildEngineHall, type EngineHall } from './engine-hall';
import { buildGasStation, type GasStation } from './gas-station';
import { buildPeaker, type Peaker } from './peaker';
import { buildTown, type Town } from './town';
import { buildYard, type Yard } from './yard';

export interface Island {
  ccgt: Ccgt;
  gas: GasStation;
  peaker: Peaker;
  engines: EngineHall;
  town: Town;
  yard: Yard;
  /** `violet` gas flow from the trunk to the turbine. */
  gasFlow: Flow;
  /** Heat shimmer over the main stack, the bypass stack and the peaker. */
  haze: { main: HeatShimmer; bypass: HeatShimmer; peaker: HeatShimmer };
  /** Heat main engine hall → town: `orange` flow. */
  heatFlow: Flow;
  /** Models with lit windows / lamps (driven by `night`). */
  lit: KitModel[];
  update(dt: number, t: number): void;
}

function haze(parent: Group, at: Vector3, width: number, height: number): HeatShimmer {
  const h = createHeatShimmer({ width, height, lines: 6, intensity: 0.75 });
  h.position.copy(at);
  parent.add(h);
  return h;
}

export async function buildIsland(ctx: ChapterContext): Promise<Island> {
  const root = new Group();
  root.name = 'facilities';
  ctx.root.add(root);
  const ccgt = buildCcgt(ctx);
  root.add(ccgt.group);
  await ctx.breathe();
  const gas = buildGasStation(ccgt.axisY);
  for (const m of gas.models) root.add(m.group);
  const peaker = buildPeaker();
  peaker.model.group.position.set(PEAKER.x, ISLAND.y, PEAKER.z);
  root.add(peaker.model.group);
  const engines = buildEngineHall(ctx);
  root.add(engines.group);
  await ctx.breathe();
  const town = buildTown(ctx);
  root.add(town.group);
  const yard = buildYard();
  root.add(yard.group);
  await ctx.breathe();

  // heat main: from the hall's exhaust-gas boilers south to the town (pipe on low supports, `orange` band)
  const hp = [new Vector3(ENGINES.x - 30, ISLAND.y + 1.4, ENGINES.z + ENGINES.width / 2 + 2), new Vector3(ENGINES.x - 30, ISLAND.y + 1.4, 30), new Vector3(TOWN.x - 30, ISLAND.y + 1.4, 34), new Vector3(TOWN.x - 30, ISLAND.y + 1.4, TOWN.z - 30)];
  const hb = new Builder('heat-main');
  addPipe(hb, hp.map((p) => [p.x, p.y, p.z] as [number, number, number]), { radius: 0.5, color: 'orange', supportEvery: 10 });
  const heatMain = hb.build();
  root.add(heatMain.group);
  const heatFlow = createFlow(ctx, { kind: 'blob', color: 'orange', paths: new CatmullRomCurve3(hp, false, 'catmullrom', 0.05), count: 60, radius: 0.5, speed: 6, spread: 0.1 });
  root.add(heatFlow);
  // two runs: the trunk up to the transparent segment of step 2, and from the station to the turbine
  const curve = (pts: Vector3[]): CatmullRomCurve3 => new CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
  const gasFlow = createFlow(ctx, { kind: 'blob', color: 'violet', paths: [{ path: curve(gas.route.slice(0, gas.inlet)) }, { path: curve(gas.route.slice(gas.inlet)), weight: 2.4 }], count: 220, radius: 0.42, speed: 9, spread: 0.12 });
  root.add(gasFlow);

  root.updateMatrixWorld(true);
  const hz = {
    main: haze(root, new Vector3(STACK.x, ISLAND.y + STACK.height, STACK.z), 10, 26),
    bypass: haze(root, ccgt.bypass.anchorWorld('top'), 7, 18),
    peaker: haze(root, peaker.model.group.localToWorld(peaker.exhaust.clone()), 5, 14),
  };
  return {
    ccgt,
    gas,
    peaker,
    engines,
    town,
    yard,
    gasFlow,
    haze: hz,
    heatFlow,
    lit: [...ccgt.lit, ...gas.models, peaker.model, engines.hall, ...yard.lit],
    update(dt) {
      ccgt.update(dt);
      engines.update(dt);
      town.update(dt);
    },
  };
}
