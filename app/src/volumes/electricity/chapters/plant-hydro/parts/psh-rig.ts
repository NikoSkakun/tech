/**
 * Step 8 rig on the stand: a cross-section through a pumped-storage plant — the upper bowl high on the left
 * (its water level is the stored energy), the inclined pressure shaft down to the underground cavern, the
 * reversible unit (motor-generator above, pump-turbine below; it spins one way as a turbine and the other way as
 * a pump), the tailrace tunnel to the lower reservoir on the right, and the cable up to the surface transformer
 * and the line toward the town. Water pulses in the shaft run down while generating and up while pumping;
 * the line's `yellow` pulses run into the grid or out of it.
 */
import { CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { K, type KToonMaterial } from '@/style';
import { Builder, G, francisRunner, type KitModel } from '@/kit';

const BOWL = new Vector3(-36, 30, -4);
const UNIT = new Vector3(4, 7, 0);
const LOWER = new Vector3(40, 6, -2);

export interface PshRig {
  group: Group;
  water: Mesh;
  lowerWater: Mesh;
  runner: KitModel;
  rotor: Group;
  shaft: KToonMaterial;
  line: KToonMaterial;
  /** 0…1 fill of the upper bowl (the lower reservoir mirrors it). */
  setFill(f: number): void;
  /** +1 generating, −1 pumping, 0 stopped (speeds and pulse directions). */
  setMode(m: number): void;
  at(name: 'bowl' | 'unit' | 'motor' | 'lower' | 'line', out: Vector3): Vector3;
}

export function buildPshRig(_ctx: ChapterContext): PshRig {
  const group = new Group();
  group.name = 'psh-rig';
  const b = new Builder('psh-rig');
  // the mountain in section: a rock wedge from the bowl down to the valley floor
  b.add(
    G.extrude(
      [
        [-58, 0],
        [56, 0],
        [56, 4],
        [20, 4],
        [-14, 22],
        [-24, 34],
        [-50, 36],
        [-58, 30],
      ],
      14,
      { bevel: 0.6 },
    ),
    { c: ['bg.violet', 'slate'], slot: 'facet', at: [0, 0, -10] },
  );
  // upper bowl: ring embankment on top of the mountain
  b.lathe(
    [
      [15, 0],
      [12, 7],
      [10.5, 7],
      [9.5, 1],
      [0.01, 1],
    ],
    { seg: 48, c: ['steel.light', 'mist'], slot: 'matte', at: BOWL.toArray() },
  );
  // underground cavern (a dark vault cut into the rock) and the lower reservoir basin
  b.add(
    G.extrude(
      [
        [-8, 1],
        [14, 1],
        [14, 14],
        [3, 18],
        [-8, 14],
      ],
      2,
      { bevel: 0.3 },
    ),
    { c: ['ink', 'bg.deep'], slot: 'matte', at: [UNIT.x, 0.4, -2.6] },
  );
  b.box(24, 2, 22, {
    r: 0.6,
    c: ['steel', 'steel.light'],
    slot: 'matte',
    at: LOWER.clone()
      .add(new Vector3(0, -2, 0))
      .toArray(),
  });
  // surface: transformer and the first tower of the line to the town
  b.box(6, 5, 5, { r: 0.6, c: ['slate', 'steel'], at: [20, 4, 6] });
  b.box(1, 22, 1, { r: 0.2, c: 'steel', at: [50, 4, 6] });
  b.box(8, 1, 1, { r: 0.2, c: 'steel', at: [50, 24, 6] });
  // the unit: spiral case, head cover, shaft and the motor-generator stator ring
  b.add(
    G.revolve(
      [
        [5.4, -1.4],
        [7.4, -1.4],
        [7.4, 1.4],
        [5.4, 1.4],
      ],
      { seg: 40 },
    ).shell,
    { c: ['steel', 'steel.light'], slot: 'metal', at: UNIT.toArray() },
  );
  b.cyl(0.6, 8, { seg: 14, c: 'steel.light', slot: 'metal', at: [UNIT.x, UNIT.y + 1, UNIT.z] });
  b.add(
    G.revolve(
      [
        [4.6, 0],
        [5.8, 0],
        [5.8, 4],
        [4.6, 4],
      ],
      { seg: 40, phiStart: Math.PI * 0.7, phiLength: Math.PI * 1.6 },
    ).shell,
    { c: ['blue.dark', 'blue'], slot: 'gloss', at: [UNIT.x, UNIT.y + 6, UNIT.z] },
  );
  const model = b.build();
  group.add(model.group);
  // pressure shaft (bowl → unit) and tailrace (unit → lower reservoir): glass with water pulses
  const shaft = K.energy({
    color: 'steel',
    pulseColor: 'sky',
    repeat: 0.12,
    speed: 8,
    length: 0.4,
    intensity: 1.4,
  });
  const tunnel = [
    BOWL.clone().add(new Vector3(3, 1, 0)),
    new Vector3(-24, 22, 0),
    new Vector3(-6, 8, 0),
    UNIT.clone().add(new Vector3(-7, 0, 0)),
  ];
  group.add(new Mesh(G.tube(G.roundPath(tunnel, 4), 1.4, { seg: 14 }), shaft));
  const tail = [UNIT.clone().add(new Vector3(0, -2, 0)), new Vector3(10, 3, 0), new Vector3(30, 4, 0)];
  group.add(new Mesh(G.tube(G.roundPath(tail, 3), 1.2, { seg: 12 }), shaft));
  const line = K.energy({
    color: 'steel',
    pulseColor: 'yellow',
    repeat: 0.15,
    speed: 10,
    length: 0.35,
    intensity: 2.4,
  });
  const cable = [
    UNIT.clone().add(new Vector3(5, 7, 0)),
    new Vector3(16, 14, 3),
    new Vector3(20, 9.5, 6),
    new Vector3(36, 20, 6),
    new Vector3(50, 25.5, 6),
  ];
  group.add(new Mesh(G.tube(G.roundPath(cable, 3), 0.45, { seg: 8 }), line));
  // upper and lower water surfaces (levels animated)
  const water = new Mesh(
    new CylinderGeometry(11, 10, 1, 40),
    K.toon({ color: 'blue', emissive: 'blue', emissiveIntensity: 0.25 }),
  );
  group.add(water);
  const lowerWater = new Mesh(
    new CylinderGeometry(1, 1, 1, 4),
    K.toon({ color: 'blue', emissive: 'blue', emissiveIntensity: 0.2 }),
  );
  lowerWater.rotation.y = Math.PI / 4;
  group.add(lowerWater);
  const runner = francisRunner({ radius: 4.6, blades: 9, color: 'sky' });
  runner.group.position.copy(UNIT);
  group.add(runner.group);
  const rotor = new Group();
  const rb = new Builder('psh-rotor');
  rb.cyl(4.3, 3.4, { seg: 32, c: ['steel', 'steel.light'], slot: 'metal' });
  for (let i = 0; i < 8; i++)
    rb.box(0.8, 3, 0.5, {
      r: 0.1,
      c: 'orange',
      at: [4.3 * Math.sin((i / 8) * Math.PI * 2), 0.2, 4.3 * Math.cos((i / 8) * Math.PI * 2)],
      rot: [0, (i / 8) * Math.PI * 2, 0],
    });
  rotor.add(rb.build().group);
  rotor.position.set(UNIT.x, UNIT.y + 6.3, UNIT.z);
  group.add(rotor);
  return {
    group,
    water,
    lowerWater,
    runner,
    rotor,
    shaft,
    line,
    setFill(f) {
      water.position.set(BOWL.x, BOWL.y + 1.4 + 5 * f, BOWL.z);
      water.scale.set(0.92 + 0.12 * f, 1, 0.92 + 0.12 * f);
      const h = 0.5 + 6 * (1 - f);
      lowerWater.scale.set(15, h, 14);
      lowerWater.position.set(LOWER.x, LOWER.y - 1 + h / 2, LOWER.z);
    },
    setMode(m) {
      shaft.power = Math.abs(m);
      shaft.speed = 8 * Math.sign(m || 1);
      line.power = Math.abs(m);
      line.speed = 10 * Math.sign(m || 1);
    },
    at(name, out) {
      const p =
        name === 'bowl'
          ? out.copy(BOWL).add(new Vector3(0, 10, 0))
          : name === 'unit'
            ? out.copy(UNIT).add(new Vector3(4, -1, 6))
            : name === 'motor'
              ? out.copy(UNIT).add(new Vector3(-3, 8, 5))
              : name === 'lower'
                ? out.copy(LOWER).add(new Vector3(0, 5, 6))
                : out.set(46, 26, 6);
      return group.localToWorld(p);
    },
  };
}
