/**
 * Step 4 rig on the stand: the longitudinal section «dam + powerhouse» and the path of the water through it.
 * The dam body and the powerhouse are cut along the section plane z = 0 (only their back halves stand), so the
 * waterway in front reads whole: trash rack and intake gate on the upstream face → steel penstock (glass, so
 * the water shows) → spiral case wound round the unit → stay vanes → the ring of 20 wicket gates (turn with
 * the opening) → Francis runner (kit, spins) → draft tube widening through its elbow → tailwater. Above the
 * runner: head cover, shaft and generator. A surge tank stands on the penstock (shown by its toggle).
 * Toy metres; origin = centre of the stand top. Moving parts are returned; flows live in `path-flow.ts`.
 */
import { CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import { K } from '@/style';
import { Builder, G, francisRunner, type KitModel } from '@/kit';

/** Key points of the waterway (toy metres, stand frame). */
export const PATH = {
  unit: new Vector3(16, 14, 0),
  intake: new Vector3(-31, 33, 0),
  penstock: [
    new Vector3(-31, 33, 0),
    new Vector3(-22, 33, 0),
    new Vector3(-4, 17, 3),
    new Vector3(10, 14, 7),
    new Vector3(16, 14, 7),
  ],
  draft: [
    new Vector3(16, 12.6, 0),
    new Vector3(16, 8.5, 0),
    new Vector3(20, 6.8, 0),
    new Vector3(30, 6.8, 0),
    new Vector3(42, 7.4, 0),
  ],
  /** Spiral case: radius from SPIRAL_R0 down to SPIRAL_R1 over SPIRAL_TURN of a turn, starting in front (+Z). */
  spiralR0: 7,
  spiralR1: 4.4,
  spiralTurn: 0.92,
  tank: new Vector3(-13, 24.5, 1.5),
  gauge: new Vector3(2, 16, 5),
} as const;

export function spiralPoint(u: number, out = new Vector3()): Vector3 {
  const phi = u * PATH.spiralTurn * Math.PI * 2;
  const r = PATH.spiralR0 + (PATH.spiralR1 - PATH.spiralR0) * u;
  return out.set(PATH.unit.x + r * Math.sin(phi), PATH.unit.y, PATH.unit.z + r * Math.cos(phi));
}

export interface PathRig {
  group: Group;
  /** Penstock + spiral: the part that shakes in a water hammer. */
  pipeGroup: Group;
  runner: KitModel;
  rotor: Group;
  vanes: Group[];
  tank: Group;
  tankWater: Mesh;
  model: KitModel;
}

export function buildPathRig(): PathRig {
  const group = new Group();
  group.name = 'water-path-rig';
  const b = new Builder('path-rig');
  // rock, the dam's back half (gravity profile) and the reservoir / tailwater glass blocks
  b.box(116, 6, 30, { r: 1, c: ['bg.violet', 'slate'], slot: 'facet', at: [-2, 0, 0] });
  b.add(
    G.extrude(
      [
        [-30, 6],
        [4, 6],
        [-22, 50],
        [-22, 55],
        [-30, 55],
      ],
      15,
      { bevel: 0.4 },
    ),
    { c: ['steel.light', 'mist'], slot: 'matte', at: [0, 0, -7.5] },
  );
  b.box(28, 42, 26, { r: 0.6, c: 'sky', slot: 'glass', at: [-44.5, 6, -1] });
  b.box(18, 13, 26, { r: 0.6, c: 'sky', slot: 'glass', at: [48, 6, -1] });
  // trash rack bars in front of the intake mouth, the intake gate raised in its slot
  for (let k = -3; k <= 3; k++)
    b.box(0.35, 9, 0.35, { r: 0, c: 'steel', slot: 'metal', at: [-31.6, 28.5, k * 1.1] });
  for (const y of [29.5, 32, 34.5, 37])
    b.box(0.4, 0.35, 7.6, { r: 0, c: 'steel', slot: 'metal', at: [-31.6, y, 0] });
  b.box(1, 7, 6.6, { r: 0.2, c: 'amber', at: [-28.2, 39.5, 0] });
  b.box(1.6, 18, 1, { r: 0.2, c: 'slate', at: [-28.2, 37, -3.8] });
  // powerhouse: back wall, floors, crane rail; the unit's head cover, shaft and stator ring
  b.box(34, 32, 2, { r: 0.6, c: ['mist', 'white'], slot: 'matte', at: [18, 6, -13] });
  b.box(34, 1.2, 14, { r: 0.4, c: 'steel.light', slot: 'matte', at: [18, 22, -7] });
  b.box(34, 1.6, 2.4, { r: 0.4, c: 'yellow', at: [18, 36, -11] });
  b.cyl(4.6, 1, {
    seg: 40,
    c: ['steel', 'steel.light'],
    slot: 'metal',
    at: [PATH.unit.x, PATH.unit.y + 1.6, 0],
  });
  b.cyl(0.7, 10, { seg: 16, c: 'steel.light', slot: 'metal', at: [PATH.unit.x, PATH.unit.y + 2.6, 0] });
  b.add(
    G.revolve(
      [
        [6, 0],
        [7.4, 0],
        [7.4, 5],
        [6, 5],
      ],
      { seg: 48, phiStart: Math.PI * 0.75, phiLength: Math.PI * 1.5 },
    ).shell,
    { c: ['blue.dark', 'blue'], slot: 'gloss', at: [PATH.unit.x, 24, 0] },
  );
  // stay vanes: ten fixed columns between the spiral and the wicket gates
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.cyl(0.38, 2.4, {
      seg: 10,
      c: 'steel',
      slot: 'metal',
      at: [PATH.unit.x + 4.1 * Math.sin(a), PATH.unit.y - 1.2, 4.1 * Math.cos(a)],
    });
  }
  b.anchor('stayVanes', PATH.unit.x + 2.9, PATH.unit.y - 1, 2.9);
  b.anchor('headCover', PATH.unit.x, PATH.unit.y + 2.8, 3.4);
  b.anchor('generator', PATH.unit.x, 31, 6);
  const model = b.build();
  group.add(model.group);

  // penstock and spiral case: glass tubes (the shake group of the water hammer)
  const pipeGroup = new Group();
  const glass = K.glass({ color: 'steel', opacity: 0.42 });
  const ring = K.metal({ color: 'steel' });
  pipeGroup.add(
    new Mesh(G.tube(G.roundPath(PATH.penstock as unknown as Vector3[], 4), 2.2, { seg: 20 }), glass),
  );
  const spiral: Vector3[] = [];
  for (let i = 0; i <= 40; i++) spiral.push(spiralPoint(i / 40));
  pipeGroup.add(new Mesh(G.tube(spiral, 2, { seg: 18, taper: (t) => 1 - 0.6 * t }), glass));
  const pen = PATH.penstock as unknown as Vector3[];
  const penLen = G.pathLength(pen);
  for (const u of [0.15, 0.4, 0.62]) {
    const tangent = new Vector3();
    const p = G.pathAt(pen, u * penLen, new Vector3(), tangent);
    const flange = new Mesh(new CylinderGeometry(2.45, 2.45, 0.5, 20), ring);
    flange.position.copy(p);
    flange.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), tangent.normalize());
    pipeGroup.add(flange);
  }
  group.add(pipeGroup);
  // draft tube: widening glass elbow
  group.add(
    new Mesh(
      G.tube(G.roundPath(PATH.draft as unknown as Vector3[], 3), 1.8, { seg: 18, taper: (t) => 1 + 1.4 * t }),
      glass,
    ),
  );

  // wicket gates: 20 small vanes on a ring, each turning about its own vertical stem
  const vanes: Group[] = [];
  const vaneGeo = new CylinderGeometry(0.12, 0.12, 2, 6);
  vaneGeo.scale(5, 1, 1);
  const vaneMat = K.metal({ color: 'amber.light' });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const v = new Group();
    v.position.set(PATH.unit.x + 3.1 * Math.sin(a), PATH.unit.y, 3.1 * Math.cos(a));
    v.userData.base = a;
    v.add(new Mesh(vaneGeo, vaneMat));
    group.add(v);
    vanes.push(v);
  }
  const runner = francisRunner({ radius: 2.5, blades: 13, color: 'amber' });
  runner.group.position.copy(PATH.unit);
  group.add(runner.group);
  // generator rotor (spins with the runner): a disc with coral pole marks under the stator ring
  const rotor = new Group();
  const rb = new Builder('rotor');
  rb.cyl(5.6, 4, { seg: 40, c: ['steel', 'steel.light'], slot: 'metal' });
  for (let i = 0; i < 12; i++)
    rb.box(0.9, 3.6, 0.6, {
      r: 0.1,
      c: i % 2 ? 'coral' : 'blue',
      at: [5.6 * Math.sin((i / 12) * Math.PI * 2), 0.2, 5.6 * Math.cos((i / 12) * Math.PI * 2)],
      rot: [0, (i / 12) * Math.PI * 2, 0],
    });
  rotor.add(rb.build().group);
  rotor.position.set(PATH.unit.x, 24.5, 0);
  group.add(rotor);
  // surge tank: a tall glass tower on the penstock with its water column
  const tank = new Group();
  tank.add(
    new Mesh(
      new CylinderGeometry(2.4, 2.4, 34, 24, 1, true),
      K.glass({ color: 'steel.light', opacity: 0.35 }),
    ),
  );
  const tankWater = new Mesh(
    new CylinderGeometry(2.1, 2.1, 1, 24),
    K.toon({ color: 'blue', emissive: 'blue', emissiveIntensity: 0.25 }),
  );
  tank.add(tankWater);
  tank.children[0]!.position.y = 17;
  tank.position.copy(PATH.tank);
  group.add(tank);
  return { group, pipeGroup, runner, rotor, vanes, tank, tankWater, model };
}
