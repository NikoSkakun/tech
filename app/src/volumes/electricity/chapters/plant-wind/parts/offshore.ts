/**
 * Offshore wind farm on the sea block: 12 turbines on monopiles in the shallows, 6 on jackets, 2 floating on
 * semi-submersibles with mooring lines, the offshore substation (AC) that turns into an HVDC platform for
 * long distances, scour protection, a jack-up vessel with a blade on the hook. Local frame = `sea.group`.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, G, type KitModel } from '@/kit';
import { SEA } from '../layout';
import { Fleet } from './fleet';
import { addFloater, addJackUp, addJacket, addScour, addTopside } from './offshore-models';
import { buildSea, seaDepth, type SeaBlock } from './sea';

const MONO_X = [-96, -66, -38];
const ROW_Z = [54, 18, -18, -54];
const JACKETS: readonly (readonly [number, number])[] = [[0, 52], [0, 16], [0, -20], [0, -56], [34, -20], [34, -56]];
const FLOATERS: readonly (readonly [number, number])[] = [[88, 44], [92, -30]];
export const PLATFORM: readonly [number, number] = [40, 30];
const JACKET_TOP = 7;
const FLOAT_TOP = 4.2;

export interface Offshore {
  sea: SeaBlock;
  monopiles: Fleet;
  jackets: Fleet;
  floaters: { group: Group; fleet: Fleet; phase: number }[];
  /** Topsides on the platform jacket: cross-faded by the «distance to shore» control. */
  ac: Group;
  dc: Group;
  /** Local positions (sea frame) of things steps point at. */
  spots: Record<'monopile' | 'jacket' | 'floating' | 'platform' | 'transition' | 'scour' | 'mooring' | 'vessel' | 'dcPlus' | 'dcMinus', Vector3>;
  /** Sea-bed cable routes (local): inter-array strings and the export route to the west wall. */
  strings: Vector3[][];
  /** Models with lamps / beacons (night switch, aviation lights). */
  lit: KitModel[];
  /** Rotor speed of all offshore turbines, rad/s. */
  speed: number;
  update(dt: number, t: number): void;
}

export function buildOffshore(ctx: ChapterContext): Offshore {
  const sea = buildSea();
  const rand = ctx.random.fork('offshore');
  const bed = (x: number): number => -seaDepth(x);
  const common = { hubHeight: SEA.hubHeight + 11, rotorDiameter: SEA.rotorDiameter, chunk: 2.4, accent: 'amber' as const, castShadow: true, scale: 0.5 };

  // monopiles: the kit's monopile + transition piece come with the fleet template
  const monopiles = new Fleet({ ...common, count: MONO_X.length * ROW_Z.length, foundation: 'monopile', depth: SEA.depthShallow });
  let i = 0;
  for (const x of MONO_X) for (const z of ROW_Z) monopiles.place(i++, x, 0, z, -Math.PI / 2);
  const jackets = new Fleet({ ...common, hubHeight: SEA.hubHeight + 11, count: JACKETS.length, foundation: 'none', towerBase: JACKET_TOP + 0.5 });
  JACKETS.forEach(([x, z], k) => jackets.place(k, x, 0, z, -Math.PI / 2));
  sea.group.add(monopiles.group, jackets.group);

  // everything static in one builder: jackets, platform jacket, scour rock, mooring lines, vessel
  const b = new Builder('offshore-static');
  for (const [x, z] of JACKETS) b.frame({ at: [x, 0, z] }, () => addJacket(b, seaDepth(x), JACKET_TOP));
  b.frame({ at: [PLATFORM[0], 0, PLATFORM[1]] }, () => addJacket(b, seaDepth(PLATFORM[0]), 9, 7.5, 5));
  for (const x of MONO_X) for (const z of ROW_Z) b.frame({ at: [x, bed(x), z] }, () => addScour(b, 1.2, () => rand.next()));
  const anchors: Vector3[] = [];
  FLOATERS.forEach(([x, z]) => {
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3 + Math.PI / 6;
      const from = new Vector3(x + Math.cos(a) * 10.4, -5.4, z + Math.sin(a) * 10.4);
      const ax = Math.min(SEA.sizeX / 2 - 6, x + Math.cos(a) * 30);
      const to = new Vector3(ax, bed(ax) + 0.3, Math.max(-76, Math.min(76, z + Math.sin(a) * 30)));
      b.tube(G.catenary(from, to, 5.5, 14), 0.16, { c: 'slate', seg: 5 });
      b.dome(1.1, 0.7, { c: 'slate', slot: 'facet', seg: 6, at: [to.x, to.y - 0.3, to.z] });
      anchors.push(from.clone().lerp(to, 0.5).add(new Vector3(0, -3.6, 0)));
    }
  });
  const vessel = new Vector3(-52, 0, -36);
  b.frame({ at: [vessel.x, 0, vessel.z], rot: [0, Math.PI / 2, 0] }, () => addJackUp(b, seaDepth(vessel.x)));
  const fixed = b.build();
  sea.group.add(fixed.group);

  const floaters = FLOATERS.map(([x, z], k) => {
    const group = new Group();
    group.position.set(x, 0, z);
    const fb = new Builder('floater');
    addFloater(fb);
    const fleet = new Fleet({ ...common, hubHeight: SEA.hubHeight + 11, count: 1, foundation: 'none', towerBase: FLOAT_TOP });
    fleet.place(0, 0, 0, 0, -Math.PI / 2);
    fleet.commit();
    group.add(fb.build().group, fleet.group);
    sea.group.add(group);
    return { group, fleet, phase: k * 2.3 };
  });

  const topside = (kind: 'ac' | 'hvdc'): { group: Group; model: ReturnType<Builder['build']> } => {
    const tb = new Builder(`topside-${kind}`);
    addTopside(tb, kind);
    const model = tb.build();
    model.group.position.set(PLATFORM[0], 9.5, PLATFORM[1]);
    sea.group.add(model.group);
    return { group: model.group, model };
  };
  const ac = topside('ac');
  const dc = topside('hvdc');
  const at = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  const strings: Vector3[][] = ROW_Z.map((z, r) => {
    const pts = MONO_X.map((x) => at(x, bed(x) + 0.35, z));
    const j = JACKETS[r]!;
    pts.push(at(j[0], bed(j[0]) + 0.35, j[1]));
    if (r === 3) pts.push(at(34, bed(34) + 0.35, -56), at(34, bed(34) + 0.35, -20));
    else if (r === 2) pts.push(at(34, bed(34) + 0.35, -20));
    pts.push(at(PLATFORM[0], bed(PLATFORM[0]) + 0.35, PLATFORM[1]));
    return G.roundPath(pts, 5);
  });
  strings.push(G.roundPath([at(92, bed(92) + 0.35, -30), at(70, bed(70) + 0.35, 4), at(88, bed(88) + 0.35, 44), at(60, bed(60) + 0.35, 34), at(PLATFORM[0], bed(PLATFORM[0]) + 0.35, PLATFORM[1])], 6));

  const state: Offshore = {
    sea,
    monopiles,
    jackets,
    floaters,
    ac: ac.group,
    dc: dc.group,
    spots: {
      monopile: at(MONO_X[1]!, -SEA.depthShallow * 0.45, ROW_Z[0]!),
      jacket: at(0, -seaDepth(0) * 0.5, 52),
      floating: at(88, -3, 44),
      platform: at(PLATFORM[0], 16, PLATFORM[1]),
      transition: at(MONO_X[1]!, 7, ROW_Z[0]!),
      scour: at(MONO_X[1]! + 2.5, bed(MONO_X[1]!) + 0.8, ROW_Z[0]! + 2),
      mooring: anchors[1]!,
      vessel: at(vessel.x, 14, vessel.z),
      dcPlus: dc.model.anchorLocal('dcPlus').add(dc.group.position),
      dcMinus: dc.model.anchorLocal('dcMinus').add(dc.group.position),
    },
    strings,
    lit: [fixed, ac.model, dc.model, monopiles.model, jackets.model, ...floaters.map((f) => f.fleet.model)],
    speed: 0.8,
    update(dt, t) {
      for (const f of [monopiles, jackets]) {
        for (let k = 0; k < f.count; k++) f.angle[k] = f.angle[k]! + state.speed * (0.92 + 0.16 * ((k * 7) % 5) * 0.25) * dt;
        f.commit();
      }
      for (const f of floaters) {
        // a floating turbine barely moves: slow heave and a degree of pitch / roll
        f.group.position.y = Math.sin(t * 0.5 + f.phase) * 0.22;
        f.group.rotation.x = Math.sin(t * 0.37 + f.phase) * 0.018;
        f.group.rotation.z = Math.sin(t * 0.43 + f.phase * 1.7) * 0.022;
        f.fleet.angle[0] = f.fleet.angle[0]! + state.speed * dt;
        f.fleet.commit();
      }
    },
  };
  monopiles.commit();
  jackets.commit();
  return state;
}
