/**
 * The rest of the site: two hyperbolic cooling towers, the 330 kV switchyard with the outgoing line toward the
 * east rim (phase conductors carry `yellow` pulses), the gypsum cone by the absorber, the grey ash pond with its
 * slurry pipe, and the carbon-capture plant (absorber + stripper columns, compressor) in the north-east.
 */
import { Group, Mesh, Vector3 } from 'three';
import { Builder, G, addPipe, coolingTower, latticeTower, powerLine, substation, waterDisc, type KitModel, type Substation } from '@/kit';
import { K, col, type KToonMaterial } from '@/style';
import { ASH_POND, CCS, GAS, GYPSUM, ISLAND, SWITCHYARD, TOWERS, TOWER_H } from '../layout';
import type { World } from './world';

export const YARD_SCALE = 0.42;

export interface Site {
  models: KitModel[];
  towers: KitModel[];
  switchyard: Substation;
  /** Phase conductors of the outgoing line: tween `.power` (0…1). */
  wire: KToonMaterial;
  yardGroup: Group;
  gypsum: Mesh;
  pond: KitModel;
  ccs: KitModel;
  /** World points: tower tops (plumes), the switchyard's gantry, the ash pond centre, the CCS columns. */
  points: { towerTops: Vector3[]; gantry: Vector3; pond: Vector3; ccsTop: Vector3; ccsWell: Vector3 };
  setGypsum(scale: number): void;
}

const g = ISLAND.ground;

function buildCcs(): KitModel {
  const b = new Builder('ccs-plant');
  b.box(46, 1, 32, { r: 0.2, slot: 'matte', c: col('mist').lerp(col('steel.light'), 0.4), at: [0, -0.5, 0] });
  // absorber (tall), stripper (shorter, with the reboiler), compressor house, CO₂ well head
  b.cyl(5, 38, { seg: 28, slot: 'gloss', c: ['teal.dark', 'teal'], at: [-14, 0, -4] });
  b.cyl(5.6, 1.2, { seg: 28, slot: 'gloss', c: 'amber', at: [-14, 38, -4] });
  b.cyl(3.6, 26, { seg: 24, slot: 'gloss', c: ['teal.dark', 'teal'], at: [2, 0, -6] });
  b.cyl(4.1, 1.2, { seg: 24, slot: 'gloss', c: 'amber', at: [2, 26, -6] });
  b.box(12, 8, 10, { r: 0.4, c: ['steel', 'mist'], at: [14, 0, 6] });
  b.cyl(1.4, 4, { seg: 16, slot: 'metal', c: 'slate', at: [16, 8, 6] });
  b.cyl(1.2, 3, { seg: 16, slot: 'gloss', c: 'violet', at: [20, 0, -10] }); // well head: the pipe goes down here
  addPipe(b, [[-14, 30, -4], [-14, 32, 4], [2, 32, 4], [2, 20, -6]], { radius: 0.8, color: 'teal.light', bend: 1.5 });
  addPipe(b, [[2, 4, -6], [10, 4, 2], [14, 4, 6]], { radius: 0.9, color: 'violet', bend: 1.5 });
  addPipe(b, [[16, 2, 6], [20, 2, -2], [20, 3, -10]], { radius: 0.9, color: 'violet', bend: 1.5 });
  b.anchor('top', -14, 40, -4).anchor('well', 20, 0, -10);
  return b.build();
}

export function buildSite(world: World): Site {
  const models: KitModel[] = [];
  const towers = TOWERS.map(([x, z]) => {
    const t = coolingTower({ height: TOWER_H });
    t.group.position.set(x, g, z);
    models.push(t);
    return t;
  });
  // switchyard: bay 1 = outgoing line (east), bay 2 = the incoming link from the step-up transformer
  const yardGroup = new Group();
  yardGroup.scale.setScalar(YARD_SCALE);
  yardGroup.position.set(SWITCHYARD.x, g, SWITCHYARD.z);
  yardGroup.rotation.y = Math.PI / 2;
  const switchyard = substation({ kV: 330, detail: 'light', fence: true, bays: [{ type: 'line' }, { type: 'line' }] });
  yardGroup.add(switchyard.group);
  yardGroup.updateMatrixWorld(true);
  const spots: [number, number][] = [
    [190, 112],
    [252, 116],
  ];
  const lineTowers = spots.map(([x, z], i) => {
    const t = latticeTower({ voltage: 330, type: i === spots.length - 1 ? 'tension' : 'suspension', low: true });
    t.group.position.copy(yardGroup.worldToLocal(new Vector3(x, world.y(x, z), z)));
    yardGroup.add(t.group);
    return t;
  });
  lineTowers.forEach((t, i) => {
    const prev = i === 0 ? switchyard.anchorLocal('bay1.gantry.b1.p2') : lineTowers[i - 1]!.group.position;
    t.group.rotation.y = Math.atan2(t.group.position.x - prev.x, t.group.position.z - prev.z);
  });
  const wire = K.energy({ color: 'steel', pulseColor: 'yellow', repeat: 0.09, speed: 14, length: 0.35, intensity: 3.2 });
  const line = powerLine([switchyard.ports[0]!, ...lineTowers], { material: wire, sag: 0.05 });
  yardGroup.add(line.group);
  yardGroup.updateMatrixWorld(true);
  // gypsum cone (grows in step 8), ash pond water, CCS plant
  const gypsum = new Mesh(G.cone(9, 8, { seg: 28 }), K.toon({ color: col('white').lerp(col('mist'), 0.25) }));
  gypsum.position.set(GYPSUM.x, g, GYPSUM.z);
  gypsum.castShadow = gypsum.receiveShadow = true;
  const pond = waterDisc(ASH_POND.r, g - 0.3, { shallow: 'mist', deep: 'steel' });
  pond.group.position.set(ASH_POND.x, 0, ASH_POND.z);
  const pipe = new Builder('ash-pipe');
  addPipe(pipe, [[GAS.esp.x, g + 1, GAS.z - 10], [GAS.esp.x, g + 1, -60], [ASH_POND.x + 10, g + 1, ASH_POND.z + ASH_POND.r - 4]], { radius: 0.7, color: 'steel', bend: 4, supportEvery: 8 });
  const ccs = buildCcs();
  ccs.group.position.set(CCS.x, g + 0.5, CCS.z);
  models.push(pipe.build(), ccs);
  const extra = new Group();
  extra.add(gypsum, pond.group);
  for (const m of models) extra.add(m.group);
  extra.add(yardGroup);
  world.island.group.add(extra);
  return {
    models,
    towers,
    switchyard,
    wire,
    yardGroup,
    gypsum,
    pond,
    ccs,
    points: {
      towerTops: towers.map((t) => t.anchorWorld('top')),
      gantry: switchyard.anchorWorld('bay2.gantry.b1.p2'),
      pond: new Vector3(ASH_POND.x, g, ASH_POND.z),
      ccsTop: ccs.anchorWorld('top'),
      ccsWell: ccs.anchorWorld('well'),
    },
    setGypsum(scale) {
      gypsum.scale.set(scale, scale, scale);
    },
  };
}
