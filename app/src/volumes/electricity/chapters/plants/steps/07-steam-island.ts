/**
 * Step 7 `steam-island` — «Спільний „паровий острів“». On the hub floor: the HP→IP→LP turbine-generator set, a
 * condenser beside the LP end, a socket on the left where the heat source docks, and one of three ways to dump the
 * condenser heat (river / cooling tower / air-cooled condenser). «Джерело тепла» slides a different stove into the
 * socket — everything else stays as it is, which is the point of the step. Steam temperatures and efficiencies:
 * the document's step 7 and the comparison table (`COMPARE_ROWS`); cooling figures are the document's.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { createFlow } from '@/fx';
import { addHeatExchanger, Builder } from '@/kit';
import { col } from '@/style';
import { COMPARE_ROWS } from '@electricity/sim/plants';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { LISTS, OWN } from '../labels-own';
import { createCooling } from '../parts/cooling';
import { createSource, OUTLET, SOURCE_IDS, type SourceId } from '../parts/heat-sources';
import { group } from '../world';

const ID = 'steam-island';
const COOL = ['river', 'tower', 'air'] as const;
type Cool = (typeof COOL)[number];
/** Row of the comparison table that gives each source's typical efficiency. */
const ROW: Record<SourceId, string> = { coal: 'coal', nuclear: 'nuclear', hrsg: 'gasCcgt', csp: 'csp', geothermal: 'geothermal', biomass: 'biomass' };
/** Hot steam keeps its pink tint only where it is really hot (document: weaker for nuclear and geothermal). */
const PINK: Record<SourceId, number> = { coal: 0.45, nuclear: 0.08, hrsg: 0.4, csp: 0.35, geothermal: 0.05, biomass: 0.3 };

export const steamIsland: StepFactory = (hub) => {
  const { ctx, ui, arch } = hub;
  const set = group(ID, 0, 0, 0);
  hub.stageRoot.add(set);
  const L = arch.turbo.length;
  const socket = new Vector3(-L / 2 - 13, 0, 8);
  const pb = new Builder('socket');
  pb.cyl(8, 0.8, { at: [socket.x, 0, socket.z], seg: 40, c: ['slate', 'steel'], slot: 'matte' });
  pb.ring(8, 0.25, { axis: 'y', at: [socket.x, 0.8, socket.z], seg: 48, tubeSeg: 8, c: 'cyan', slot: 'glow' });
  const condAt = new Vector3(L / 2 - 14, 0, 10);
  pb.frame({ at: [condAt.x, 0, condAt.z] }, () => addHeatExchanger(pb, { kind: 'condenser', length: 10, radius: 2.2, cut: 1.2 }), 'cd.');
  const steamIn = arch.turbo.anchorWorld('steamIn');
  const outlet = socket.clone().add(new Vector3(...OUTLET));
  const steamPath = new CatmullRomCurve3([outlet, outlet.clone().add(new Vector3(4, 4, 0)), steamIn.clone().add(new Vector3(-3, 5, 2)), steamIn]);
  const feedPath = new CatmullRomCurve3([condAt.clone().setY(0.8).add(new Vector3(-4, 0, 2)), new Vector3(socket.x + 6, 0.8, socket.z + 5), socket.clone().add(new Vector3(3, 1.6, 4))]);
  pb.tube(steamPath.getPoints(30), 0.7, { c: 'sky', slot: 'glass' });
  pb.tube(feedPath.getPoints(30), 0.5, { c: 'sky', slot: 'glass' });
  set.add(pb.build().group);
  const steam = createFlow(ctx, { kind: 'blob', color: 'white', paths: [{ path: steamPath }], count: 60, radius: 0.42, speed: 9, spread: 0.3 });
  const feed = createFlow(ctx, { kind: 'blob', color: 'blue', paths: [{ path: feedPath }], count: 40, radius: 0.28, speed: 3, spread: 0.2 });
  set.add(steam, feed);
  const sources = SOURCE_IDS.map((id) => {
    const g = createSource(id);
    g.position.copy(socket);
    set.add(g);
    const actor = ctx.stage.actor(g, {
      appear: (o, v) => {
        o.position.set(socket.x - 30 * (1 - v), socket.y, socket.z);
        o.visible = v > 0.002;
      },
      inDuration: 0.8,
      outDuration: 0.35,
    });
    return { id, actor };
  });
  const cooling = createCooling(ctx);
  cooling.tower.position.set(30, 0, -24);
  cooling.acc.position.set(28, 0, -22);
  cooling.river.position.set(0, 0, 30);
  set.add(cooling.tower, cooling.acc, cooling.river);
  const aCool: Record<Cool, ReturnType<typeof ctx.stage.actor>> = {
    tower: ctx.stage.actor(cooling.tower, { appear: 'grow' }),
    river: ctx.stage.actor(cooling.river, { appear: 'fade' }),
    air: ctx.stage.actor(cooling.acc, { appear: 'grow' }),
  };
  const src = (): SourceId => ui.value<SourceId>('src7');
  const cool = (): Cool => ui.value<Cool>('cool7');
  const row = () => COMPARE_ROWS.find((r) => r.id === ROW[src()])!;
  const sync = (instant: boolean): void => {
    for (const s of sources) if (ctx.stage.shown(s.actor) !== (s.id === src())) ctx.stage.toggle(s.actor, s.id === src(), { instant });
    for (const c of COOL) if (ctx.stage.shown(aCool[c]) !== (c === cool())) ctx.stage.toggle(aCool[c], c === cool(), { instant });
  };
  const w = (o: { localToWorld(v: Vector3): Vector3 }, p: Vector3): Vector3 => o.localToWorld(p.clone());
  ctx.qa.probe('socket', () => socket.clone().setY(6));
  const range = (r: readonly [number, number] | null): string => (r ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) : '—');

  return {
    id: ID,
    turboSet: true,
    shots: {
      [ID]: { position: [-12, 30, 72], target: [-4, 6, 2], fov: 40, drift: 0.5, fit: { center: [0, 6, 8], radius: 44 } },
    },
    stage: { show: [set], enter: (info) => sync(info.instant) },
    ui: {
      honesty: ['notToScale', 'illustrative'],
      controls: [
        { type: 'segmented', id: 'src7', label: doc(ID, 0), items: SOURCE_IDS.map((s, i) => ({ id: s, label: LISTS.sources[i] ?? s })), value: 'coal', onChange: () => hub.sound.relay() },
        { type: 'segmented', id: 'cool7', label: doc(ID, 3), items: COOL.map((c, i) => ({ id: c, label: LISTS.cooling[i] ?? c })), value: 'tower', onChange: () => hub.sound.click() },
        { type: 'readout', id: 'temp7', label: doc(ID, 1), text: () => LISTS.steamTemp[SOURCE_IDS.indexOf(src())] ?? '', color: () => 'orange' },
        { type: 'readout', id: 'eta7', label: doc(ID, 2), text: () => `${range(row().etaPct)} %`, color: () => 'green' },
        { type: 'readout', id: 'evap7', label: doc(ID, 4), text: () => LISTS.evaporation[COOL.indexOf(cool())] ?? '', color: () => 'sky' },
        { type: 'readout', id: 'dEta7', label: doc(ID, 5), text: () => LISTS.coolEta[COOL.indexOf(cool())] ?? '', color: () => (cool() === 'air' ? 'amber' : 'mist') },
      ],
      callouts: [
        { anchor: () => socket.clone().setY(16), text: () => LISTS.sources[SOURCE_IDS.indexOf(src())] ?? '', side: 'up', color: 'orange', priority: 1 },
        { anchor: () => arch.turbo.anchorWorld('ip1', new Vector3()).add(new Vector3(0, 3, 0)), text: OWN.steamTurbine, side: 'up', priority: 2 },
        { anchor: () => condAt.clone().add(new Vector3(0, 5, 0)), text: OWN.condenser, side: 'right', priority: 3 },
      ],
      hotspots: [
        { anchor: () => w(cooling.tower, cooling.at.tower), content: 'cooling-tower', visible: () => cool() === 'tower' },
        { anchor: () => w(cooling.acc, cooling.at.acc), content: 'acc', visible: () => cool() === 'air' },
      ],
    },
    probe: () => ({ source: src(), cooling: cool(), shown: sources.filter((s) => ctx.stage.shown(s.actor)).map((s) => s.id).join(','), eta: row().etaPct }),
    update(dt) {
      if (!hub.isCurrent(ID)) return;
      sync(false);
      steam.setColor(col('white').lerp(col('pink'), PINK[src()]));
      for (const f of cooling.fans) f.rotation.y += dt * 3;
      arch.want.shaft = 2;
      arch.want.ring = 0.8;
      hub.sound.hum = 0.1;
      hub.sound.turbine = 0.25;
      hub.sound.steam = 0.2;
      hub.sound.water = cool() === 'river' ? 0.3 : 0;
      hub.sound.wind = cool() === 'air' ? 0.25 : 0;
    },
  };
};
