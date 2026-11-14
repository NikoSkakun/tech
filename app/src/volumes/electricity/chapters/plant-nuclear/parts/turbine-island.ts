/**
 * The turbine island inside the turbine hall (seen with its roof open in step 7): the K-1000 turbine set (kit
 * `turboSet`: one high-pressure + three low-pressure cylinders + generator), two moisture separator-reheaters
 * beside it, the condenser under the low-pressure end, the steam lines arriving from the containment wall,
 * and the third circuit — circulating water from the condenser to the cooling tower and back.
 * Models: `secondary` (steam + feed pipes, separator-reheaters), `third` (circulating-water pipes).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, type Flow } from '@/fx';
import { Builder, G, heatExchanger, turboSet, type KitModel, type TurboSet } from '@/kit';
import { CONTAINMENT, TOWERS, TURBINE_HALL } from '../layout';

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

export interface TurbineIsland {
  group: Group;
  turbine: TurboSet;
  secondary: KitModel;
  third: KitModel;
  flows: { steam: Flow; third: Flow; thirdBack: Flow };
  at: { turbine: Vector3; msr: Vector3; condenser: Vector3; third: Vector3 };
}

export function buildTurbineIsland(ctx: ChapterContext, ground: number): TurbineIsland {
  const group = new Group();
  const hx = TURBINE_HALL.x;
  const floor = ground + 0.4;
  const turbine = turboSet({ sections: ['hp', 'lp', 'lp', 'lp'] });
  const x0 = hx - turbine.length / 2;
  turbine.group.position.set(x0, floor, 4);
  group.add(turbine.group);
  // steam lines from the containment wall (they leave it at local x = 40, y = 24) down to the separator-reheaters
  const sb = new Builder('turbine-secondary');
  const wallX = CONTAINMENT.x + 40;
  const msrZ = -9;
  const steamPaths: Vector3[][] = [];
  for (let i = 0; i < 4; i++) {
    const z0 = -6 + i * 4;
    const pts = [v(wallX, ground + 24, z0), v(x0 - 4, ground + 24, z0 * 0.4), v(x0 - 4, floor + 6, z0 * 0.4), v(x0 + 1, floor + 6, 4)];
    sb.tube(G.roundPath(pts, 1.5), 0.38, { seg: 12 });
    steamPaths.push(G.roundPath(pts, 1.5));
  }
  // separator-reheaters: two horizontal vessels north of the turbine, crossover pipes to the LP cylinders
  for (const k of [0, 1]) {
    const cx = x0 + 12 + k * 16;
    sb.capsule(1.6, 12, { axis: 'x', seg: 24, slot: 'gloss', c: ['steel', 'mist'], at: [cx - 6, floor + 3.2, msrZ] });
    for (const sx of [-4, 4]) sb.rod([cx + sx, floor + 0.2, msrZ], [cx + sx, floor + 1.8, msrZ], 0.4, { c: 'slate' });
    sb.tube(G.roundPath([v(cx, floor + 4.6, msrZ), v(cx, floor + 8, msrZ), v(cx + 4, floor + 8, 4), v(cx + 4, floor + 5.6, 4)], 1), 0.45, { seg: 12 });
  }
  const secondary = sb.build();
  group.add(secondary.group);
  // condenser under the LP end and the third circuit to the cooling tower
  const cond = heatExchanger({ kind: 'condenser', length: 20, radius: 2.4, cut: 1.2, cold: 'blue', hot: 'white' });
  cond.group.position.set(x0 + 30, floor, -14);
  group.add(cond.group);
  const [tx, , tz] = TOWERS[1]!;
  const tb = new Builder('third-circuit');
  const out = [v(x0 + 30, floor + 1, -16), v(x0 + 30, ground + 1.2, -26), v(tx + 10, ground + 1.2, -60), v(tx + 6, ground + 1.2, tz + 40)];
  const back = [v(tx - 6, ground + 1.2, tz + 40), v(tx - 10, ground + 1.2, -62), v(x0 + 24, ground + 1.2, -28), v(x0 + 24, floor + 1, -16)];
  tb.tube(G.roundPath(out, 6), 1.1, { seg: 14 });
  tb.tube(G.roundPath(back, 6), 1.1, { seg: 14 });
  const third = tb.build();
  group.add(third.group);
  const flow = (paths: Vector3[][], color: 'white' | 'sky' | 'blue', n: number, r: number, speed: number): Flow => {
    const f = createFlow(ctx, { kind: 'blob', color, paths: paths.map((p) => ({ path: p })), count: ctx.quality.count(n), radius: r, spread: 0.3, speed });
    group.add(f);
    return f;
  };
  return {
    group,
    turbine,
    secondary,
    third,
    flows: { steam: flow(steamPaths, 'white', 260, 0.18, 5), third: flow([G.roundPath(out, 6)], 'sky', 220, 0.35, 6), thirdBack: flow([G.roundPath(back, 6)], 'blue', 220, 0.35, 6) },
    at: { turbine: v(x0 + 8, floor + 7, 4), msr: v(x0 + 12, floor + 5.4, msrZ), condenser: v(x0 + 30, floor + 5, -14), third: out[2]! },
  };
}
