/**
 * What stands inside the containment, assembled in its frame (origin = reactor axis on the ground): the vessel
 * (`rpv.ts`), the four loops and the pressurizer (`loops.ts`), the polar crane turning slowly under the dome,
 * the spent-fuel pool with its stylised Cherenkov glow (`sky`→`white`), and the coolant flows: cold water
 * (`blue`) down the gap between vessel and barrel, up through the core and out hot (`sky`), with a few violet
 * sparks that mark the primary water as radioactive; steam (`white`) and feed water (`blue`) in the second circuit.
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, createHalo, type Flow } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { K } from '@/style';
import { CONTAINMENT, LOOPS, RPV } from '../layout';
import { buildLoops, type Loops } from './loops';
import { VESSEL, buildRpv, type Rpv } from './rpv';

export interface Interior {
  group: Group;
  rpv: Rpv;
  loops: Loops;
  crane: KitModel;
  pool: Group;
  flows: { cold: Flow; hot: Flow; sparks: Flow; vesselCold: Flow; vesselHot: Flow; steam: Flow; feed: Flow };
  /** Back to the plain running state: vessel closed, nothing dimmed, rods out, core glowing. */
  restore(): void;
  /** Local → world (the interior group is placed at the containment base). */
  world(p: Vector3): Vector3;
}

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

export function buildInterior(ctx: ChapterContext, ground: number): Interior {
  const group = new Group();
  group.position.set(CONTAINMENT.x, ground, CONTAINMENT.z);
  const rpv = buildRpv();
  rpv.group.position.y = RPV.y;
  const loops = buildLoops();
  group.add(rpv.group, loops.group);
  // polar crane: a bridge across the dome on the ring girder, with a trolley and hook
  const cb = new Builder('polar-crane');
  const span = 2 * (CONTAINMENT.radius - 2);
  cb.box(span, 1.6, 2.2, { r: 0.2, slot: 'metal', c: ['amber.dark', 'amber'], at: [0, 34.4, -1.6] });
  cb.box(span, 1.6, 2.2, { r: 0.2, slot: 'metal', c: ['amber.dark', 'amber'], at: [0, 34.4, 1.6] });
  cb.box(3.4, 1.4, 5.6, { r: 0.2, slot: 'metal', c: 'slate', at: [4, 36, 0] });
  cb.rod([4, 36, 0], [4, 28, 0], 0.05, { c: 'steel' });
  cb.box(0.9, 1.2, 0.5, { r: 0.1, slot: 'metal', c: 'amber', at: [4, 26.8, 0] });
  const crane = cb.build();
  group.add(crane.group);
  // spent-fuel pool on the north side: basin, assembly racks under water, glowing water
  const pool = new Group();
  const pb = new Builder('pool');
  pb.box(8.4, 3.2, 4.4, { r: 0.2, slot: 'matte', c: ['slate', 'steel'], at: [0, -1, 0] });
  for (let i = 0; i < 9; i++) for (let k = 0; k < 4; k++) pb.cyl(0.14, 0.9, { seg: 6, slot: 'metal', c: 'steel', at: [-3.2 + i * 0.8, 0.2, -1.2 + k * 0.8] });
  pool.add(pb.build().group);
  const water = new Mesh(new BoxGeometry(7.8, 1.8, 3.8), K.glass({ color: 'sky', opacity: 0.55, edgeOpacity: 0.8 }));
  water.position.y = 1.3;
  const glow = createHalo({ color: 'sky.light', size: 11, intensity: 0.9 });
  glow.position.y = 2.6;
  pool.add(water, glow);
  pool.position.set(-17, 2.1, 0);
  pool.rotation.y = Math.PI / 2;
  group.add(pool);

  // coolant paths inside the vessel (local to the interior frame)
  const yIn = RPV.y + VESSEL.nozzleIn;
  const yOut = RPV.y + VESSEL.nozzleOut;
  const vCold: Vector3[][] = [];
  const vHot: Vector3[][] = [];
  LOOPS.azimuths.forEach((a) => {
    const u = v(Math.sin(a), 0, Math.cos(a));
    const at = (r: number, y: number): Vector3 => u.clone().multiplyScalar(r).setY(y);
    vCold.push([at(VESSEL.r + 1.1, yIn), at(VESSEL.barrelR + 0.15, yIn), at(VESSEL.barrelR + 0.15, RPV.y + 1.2), at(0.9, RPV.y + 0.7)]);
    vHot.push([at(0.9, RPV.y + 1.6), at(0.9, RPV.y + VESSEL.coreY + VESSEL.coreH + 1.6), at(VESSEL.barrelR - 0.3, yOut), at(VESSEL.r + 1.1, yOut)]);
  });
  const q = ctx.quality.count.bind(ctx.quality);
  const flow = (paths: Vector3[][], color: 'blue' | 'sky' | 'white' | 'violet', n: number, r: number, speed: number, kind: 'blob' | 'pulse' = 'blob'): Flow => {
    const f = createFlow(ctx, { kind, color, paths: paths.map((p) => ({ path: p })), count: q(n), radius: r, spread: kind === 'pulse' ? 0.25 : 0.22, speed });
    group.add(f);
    return f;
  };
  // the vessel's inner paths ride in the same swarms as the loops (fewer draw calls)
  const cold = flow([...loops.paths.cold, ...vCold], 'blue', 700, 0.16, 2.2);
  const hot = flow([...vHot, ...loops.paths.hot], 'sky', 560, 0.16, 2.2);
  const flows = {
    cold,
    hot,
    vesselCold: cold,
    vesselHot: hot,
    sparks: flow([...loops.paths.hot, ...loops.paths.cold, ...vHot], 'violet', 90, 0.09, 2.4, 'pulse'),
    steam: flow(loops.paths.steam, 'white', 300, 0.16, 4),
    feed: flow(loops.paths.feed, 'blue', 160, 0.1, 1.6),
  };
  const restore = (): void => {
    rpv.quarter.group.position.set(0, 0, 0);
    rpv.barrelQuarter.group.position.set(0, 0, 0);
    rpv.quarter.group.visible = rpv.barrelQuarter.group.visible = true;
    for (const m of [rpv.vessel, rpv.quarter, rpv.barrel, rpv.barrelQuarter, rpv.head, loops.primary, loops.secondary, loops.pressurizer, ...loops.sgs]) for (const mat of m.mats.list() as unknown as { fade: number }[]) mat.fade = 1;
    (rpv.core.material as unknown as { fade: number }).fade = 1;
    rpv.rods.position.y = 0;
    rpv.setGlow(1);
    for (const f of Object.values(flows)) f.fade = 1;
  };
  return { group, rpv, loops, crane, pool, flows, restore, world: (p) => group.localToWorld(p.clone()) };
}
