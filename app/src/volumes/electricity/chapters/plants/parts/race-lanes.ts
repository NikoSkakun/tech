/**
 * The «power race» board of step 9 as a scene object: ten lanes floating above the hub, each a glowing column in
 * its plant-type colour whose height is the lane's power in % of rating; a translucent `red` bar marks the demand
 * the dispatchable lanes chase; finished lanes get a small flag; black-start lanes get a `green` ring at their foot;
 * small clouds float over the weather lanes (wind, sun). Metres, origin = middle of the track's base.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, TorusGeometry } from 'three';
import { Builder } from '@/kit';
import { K, type ColorLike } from '@/style';

export const LANE_IDS = ['coal', 'ccgt', 'gt', 'gasEngine', 'nuclear', 'hydro', 'psh', 'bess', 'wind', 'solar'] as const;
export type RaceLane = (typeof LANE_IDS)[number];
export const LANE_COLOR: Record<RaceLane, ColorLike> = {
  coal: 'plantType.coal', ccgt: 'plantType.gas', gt: 'plantType.gas', gasEngine: 'plantType.gas', nuclear: 'plantType.nuclear',
  hydro: 'plantType.hydro', psh: 'plantType.pumpedStorage', bess: 'plantType.bess', wind: 'plantType.wind', solar: 'plantType.solar',
};
export const COL_H = 22;
const GAP = 8.5;

export interface RaceLanes {
  group: Group;
  x(i: number): number;
  columns: Mesh[];
  flags: Mesh[];
  rings: Mesh[];
  demand: Mesh;
  clouds: Group[];
  /** Set lane i to p % (0…100+). */
  set(i: number, pct: number): void;
}

export function createRaceLanes(): RaceLanes {
  const group = new Group();
  group.name = 'race-lanes';
  const n = LANE_IDS.length;
  const x = (i: number): number => (i - (n - 1) / 2) * GAP;
  const b = new Builder('race-track');
  b.box(n * GAP + 4, 1.2, 9, { r: 0.5, at: [0, -1.2, 0], c: ['ink', 'slate'], slot: 'gloss' });
  for (let i = 0; i < n; i++) {
    b.box(5.6, 0.3, 5.6, { r: 0.3, at: [x(i), 0, 0], c: 'slate', slot: 'matte' });
    // 50 % and 100 % tick posts behind each lane
    b.box(0.25, COL_H, 0.25, { at: [x(i) + 3.2, 0, -2.8], c: 'steel', slot: 'metal' });
  }
  b.box(n * GAP, 0.2, 0.2, { at: [0, COL_H, -2.8], c: 'mist', slot: 'gloss' });
  b.box(n * GAP, 0.15, 0.15, { at: [0, COL_H / 2, -2.8], c: 'steel', slot: 'gloss' });
  group.add(b.build().group);
  const colGeo = new CylinderGeometry(2.2, 2.2, 1, 32);
  colGeo.translate(0, 0.5, 0);
  const columns = LANE_IDS.map((id, i) => {
    const m = new Mesh(colGeo, K.toon({ color: LANE_COLOR[id], gloss: 0.6, rim: 0.9, emissive: LANE_COLOR[id], emissiveIntensity: 0.25 }));
    m.position.set(x(i), 0.3, 0);
    m.castShadow = true;
    group.add(m);
    return m;
  });
  const flagGeo = new BoxGeometry(2.4, 1.4, 0.2);
  const flags = LANE_IDS.map((_, i) => {
    const f = new Mesh(flagGeo, K.glow({ color: 'yellow', intensity: 1.5, keepHue: true, whiten: 0 }));
    f.position.set(x(i) + 1.6, 0, 1.2);
    f.visible = false;
    group.add(f);
    return f;
  });
  const ringGeo = new TorusGeometry(3.2, 0.3, 10, 40);
  ringGeo.rotateX(Math.PI / 2);
  const rings = LANE_IDS.map((_, i) => {
    const r = new Mesh(ringGeo, K.glow({ color: 'green', intensity: 1.6, keepHue: true, whiten: 0 }));
    r.position.set(x(i), 0.5, 0);
    r.visible = false;
    group.add(r);
    return r;
  });
  const demand = new Mesh(new BoxGeometry(GAP * 8, 0.5, 6.4), K.glow({ color: 'red', intensity: 1.3, keepHue: true, whiten: 0 }));
  demand.position.set((x(0) + x(7)) / 2, COL_H * 0.8, 0);
  group.add(demand);
  const clouds = (['wind', 'solar'] as const).map((id) => {
    const c = new Builder(`cloud-${id}`);
    for (const [dx, dy, r] of [[-1.6, 0, 1.8], [0.6, 0.5, 2.3], [2.4, 0, 1.6]] as const) c.sphere(r, { at: [dx, dy, 0], seg: 20, c: 'white', slot: 'toon' });
    const g = c.build().group;
    g.position.set(x(LANE_IDS.indexOf(id)), COL_H + 5, 0);
    group.add(g);
    return g;
  });
  return {
    group,
    x,
    columns,
    flags,
    rings,
    demand,
    clouds,
    set(i, pct) {
      const h = Math.max(0.05, (pct / 100) * COL_H);
      columns[i]!.scale.set(1, h, 1);
      flags[i]!.position.y = h + 1.4;
    },
  };
}
