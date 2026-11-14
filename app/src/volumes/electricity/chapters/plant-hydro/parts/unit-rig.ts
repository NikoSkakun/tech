/**
 * Step 6 rig on the stand: a slice of the machine hall. Two more units show as round «pucks» in the floor; the
 * hero unit is cut vertically — below the floor the runner and spiral, above it the generator: a stator ring
 * with its phase-coloured winding, the rotor (diameter grows with the number of pole pairs) whose rim carries
 * 2p identical copper pole coils (two neighbours tinted N `coral` / S `blue` where the excitation hotspot
 * sits), the thrust bearing under it, brake jacks, and the bars L1 / L2 / L3 to the transformer. Beside it the
 * governor cabinet with its frequency dial (49,8…50,2 Hz) and a small map for the black start: five
 * substations and two other plants that light up one after another.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import { K, SEMANTIC } from '@/style';
import { Builder, G, francisRunner, type KitModel } from '@/kit';

const AXIS = new Vector3(-8, 0, 0);
const FLOOR = 12;
const MAX_POLES = 96;
/** Toy rotor radius for p pole pairs (p = 40 → ≈ 12 toy metres, «майже 19 m»). */
export const rotorRadius = (p: number): number => 3 + 0.23 * p;

export interface UnitRig {
  group: Group;
  rotor: Group;
  runner: KitModel;
  needle: Group;
  /** Lamps of the black-start map: 0 = our plant, 1…5 substations, 6…7 other plants. */
  lamps: Mesh[];
  links: Mesh[];
  setPoles(p: number): void;
  at(
    name: 'generator' | 'thrust' | 'excitation' | 'brakes' | 'governor' | 'map' | 'runner',
    out: Vector3,
  ): Vector3;
}

export function buildUnitRig(): UnitRig {
  const group = new Group();
  group.name = 'unit-rig';
  const b = new Builder('unit-rig');
  // hall floor cut open around the hero unit; two more pucks behind; the pit with the turbine below
  // (the floor is cut open in front of the hero unit, so the pit with the runner shows)
  const floor = ['steel', 'steel.light'] as [string, string];
  b.box(96, FLOOR, 22, { r: 0.8, c: floor, slot: 'matte', at: [0, 0, -23] });
  b.box(42, FLOOR, 22, { r: 0.8, c: floor, slot: 'matte', at: [27, 0, -1] });
  b.box(22, FLOOR, 22, { r: 0.8, c: floor, slot: 'matte', at: [-37, 0, -1] });
  for (const x of [22, 40]) {
    b.cyl(9, 1.6, { seg: 40, c: ['blue.dark', 'blue'], slot: 'gloss', at: [x, FLOOR, -18] });
    b.cyl(9.3, 0.5, { seg: 40, c: 'yellow', at: [x, FLOOR, -18] });
  }
  b.add(
    G.revolve(
      [
        [6.5, 2],
        [10.5, 2],
        [10.5, 7],
        [6.5, 7],
      ],
      { seg: 40, phiStart: Math.PI * 0.5, phiLength: Math.PI },
    ).shell,
    { c: ['steel', 'steel.light'], slot: 'metal', at: AXIS.toArray() },
  );
  // stator: a ring cut open toward the viewer, with winding bars in L1 / L2 / L3
  const statorR = 15.5;
  b.add(
    G.revolve(
      [
        [statorR - 1.6, 0],
        [statorR + 1.2, 0],
        [statorR + 1.2, 7],
        [statorR - 1.6, 7],
      ],
      { seg: 64, phiStart: Math.PI * 0.62, phiLength: Math.PI * 1.76 },
    ).shell,
    { c: ['slate', 'steel'], slot: 'matte', at: [AXIS.x, FLOOR + 2.5, 0] },
  );
  const phases = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3];
  for (let i = 0; i < 42; i++) {
    const a = Math.PI * 0.66 + (i / 42) * Math.PI * 1.68;
    b.box(0.5, 6.2, 0.5, {
      r: 0,
      c: phases[i % 3]!,
      at: [AXIS.x + (statorR - 1.9) * Math.sin(a), FLOOR + 2.9, (statorR - 1.9) * Math.cos(a)],
    });
  }
  // thrust bearing (amber) under the rotor spider, brake jacks on the floor ring
  b.cyl(4.2, 1.4, { seg: 32, c: ['amber.dark', 'amber'], at: [AXIS.x, FLOOR + 0.2, 0] });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    b.cyl(0.7, 2.2, { seg: 12, c: 'coral', at: [AXIS.x + 9 * Math.sin(a), FLOOR, 9 * Math.cos(a)] });
  }
  // L1 / L2 / L3 bars from the stator terminals to a step-up transformer
  phases.forEach((c, k) =>
    b.beam([AXIS.x + 12, FLOOR + 9 + k * 1.2, -10], [30, FLOOR + 9 + k * 1.2, -14], 0.5, { c }),
  );
  b.box(8, 9, 7, { r: 0.8, c: ['slate', 'steel'], at: [34, FLOOR, -14] });
  // governor cabinet with its frequency dial
  b.box(7, 13, 4, { r: 0.6, c: ['blue.dark', 'blue'], slot: 'gloss', at: [26, FLOOR, 4] });
  b.cyl(2.4, 0.3, { axis: 'z', seg: 32, c: 'white', at: [26, FLOOR + 8.6, 6] });
  b.box(0.3, 1.1, 0.1, { r: 0, c: 'green', slot: 'glow', at: [26, FLOOR + 10, 6.35] });
  b.box(5, 0.6, 0.1, { r: 0, c: 'sky', slot: 'glow', at: [26, FLOOR + 4, 6.05] });
  // the black-start map: a round plate
  b.cyl(9, 0.8, { seg: 48, c: ['bg.indigo', 'bg.violet'], at: [42, FLOOR, 8] });
  const model = b.build();
  group.add(model.group);
  const needle = new Group();
  const nm = new Mesh(new BoxGeometry(0.25, 2, 0.15), K.toon({ color: 'red' }));
  nm.position.y = 1;
  needle.add(nm);
  needle.position.set(26, FLOOR + 8.6, 6.4);
  group.add(needle);

  const runner = francisRunner({ radius: 5.5, blades: 15, color: 'amber' });
  runner.group.position.set(AXIS.x, 5, 0);
  group.add(runner.group);
  // rotor: spider + rim (scaled radially) + instanced copper pole coils
  const rotor = new Group();
  rotor.position.set(AXIS.x, FLOOR + 3, 0);
  const spider = new Mesh(new CylinderGeometry(1, 1, 5, 64), K.metal({ color: 'steel' }));
  spider.position.y = 2.4;
  const shaft = new Mesh(new CylinderGeometry(1.1, 1.1, 22, 20), K.metal({ color: 'steel.light' }));
  shaft.position.y = -4;
  const poles = new InstancedMesh(new BoxGeometry(1.2, 4.2, 1.1), K.metal({ color: 'orange' }), MAX_POLES);
  const nPole = new Mesh(new BoxGeometry(1.3, 4.3, 1.2), K.toon({ color: SEMANTIC.poleN }));
  const sPole = new Mesh(new BoxGeometry(1.3, 4.3, 1.2), K.toon({ color: SEMANTIC.poleS }));
  rotor.add(spider, shaft, poles, nPole, sPole);
  group.add(rotor);
  // black-start map lamps and the links between them
  const spots = [
    [0, 0],
    [-5, 4],
    [-3, -5],
    [4, -4],
    [6, 3],
    [1, 6],
    [-6, -1],
    [5, -1],
  ] as const;
  const lamps = spots.map(([x, z], i) => {
    const m = new Mesh(
      new CylinderGeometry(i === 0 ? 1.3 : 0.9, i === 0 ? 1.3 : 0.9, 1.4, 16),
      K.glow({ color: i === 0 ? 'green' : 'yellow', intensity: 1.4, keepHue: true }),
    );
    m.position.set(42 + x, FLOOR + 1.4, 8 + z);
    group.add(m);
    return m;
  });
  const links = spots.slice(1).map(([x, z]) => {
    const a = new Vector3(42, FLOOR + 1, 8);
    const c = new Vector3(42 + x, FLOOR + 1, 8 + z);
    const m = new Mesh(
      G.tube([a, c], 0.22, { seg: 6 }),
      K.glow({ color: 'yellow', intensity: 1, keepHue: true }),
    );
    group.add(m);
    return m;
  });
  const mtx = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  return {
    group,
    rotor,
    runner,
    needle,
    lamps,
    links,
    setPoles(p) {
      const n = Math.min(MAX_POLES, 2 * Math.round(p));
      const r = rotorRadius(p);
      spider.scale.set(r - 0.6, 1, r - 0.6);
      poles.count = n;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        q.setFromAxisAngle(up, a);
        mtx.compose(new Vector3(r * Math.sin(a), 2.4, r * Math.cos(a)), q, new Vector3(1, 1, 1));
        poles.setMatrixAt(i, mtx);
      }
      poles.instanceMatrix.needsUpdate = true;
      // the two marked neighbours sit in front (toward the viewer)
      for (const [m, i] of [
        [nPole, 0],
        [sPole, 1],
      ] as const) {
        const a = (i / n) * Math.PI * 2;
        m.position.set(r * Math.sin(a), 2.4, r * Math.cos(a));
        m.rotation.y = a;
      }
    },
    at(name, out) {
      const r = rotorRadius(40);
      const p =
        name === 'generator'
          ? out.set(AXIS.x, FLOOR + 12, 0)
          : name === 'thrust'
            ? out.set(AXIS.x + 4, FLOOR + 0.8, 3)
            : name === 'excitation'
              ? out.set(AXIS.x + 0.5, FLOOR + 6, r * 0.8)
              : name === 'brakes'
                ? out.set(AXIS.x + 9 * Math.sin(0.3), FLOOR + 2, 9 * Math.cos(0.3))
                : name === 'governor'
                  ? out.set(26, FLOOR + 13, 4)
                  : name === 'map'
                    ? out.set(42, FLOOR + 2, 12)
                    : out.set(AXIS.x, 5, 4);
      return group.localToWorld(p);
    },
  };
}
