/**
 * Step 5 rig on the stand: the three runners side by side, all on vertical shafts, in their own transparent
 * housings with water moving through them —
 *  · Kaplan (left, `teal`): a propeller hub in a glass barrel, water streams down along the axis; blades turn
 *    with the load (kit `kaplanRunner`, `setPitch`);
 *  · Francis (middle, `blue`): water comes in from a ring all round, turns down through the runner into the
 *    draft cone; at low load an `amber` vortex rope corkscrews in the cone;
 *  · Pelton (right, `sky`): a wheel of double cups in air, up to six nozzles round it shooting thin fast jets
 *    tangentially into the cups, spray falling into the pit (own model: the kit wheel has one fixed nozzle).
 * Toy metres; origin = stand top centre. `X` gives the three centres.
 */
import { CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { K } from '@/style';
import { Builder, G, francisRunner, kaplanRunner, type KaplanRunner, type KitModel } from '@/kit';
import { createFlow, createParticles, discEmitter, type Flow, type ParticleSystem } from '@/fx';

export const X = { kaplan: -30, francis: 0, pelton: 30 } as const;
const Y = 14;
const PITCH_R = 5.2;

export interface TurbineStand {
  group: Group;
  kaplan: KaplanRunner;
  francis: KitModel;
  pelton: Group;
  jets: Mesh[];
  rope: Mesh;
  rings: Record<'kaplan' | 'francis' | 'pelton', Mesh>;
  flows: Flow[];
  spray: ParticleSystem;
  /** World anchors for callouts / hotspots. */
  at(name: 'kaplan' | 'francis' | 'pelton' | 'servo' | 'deflector' | 'rope', out: Vector3): Vector3;
}

export function buildTurbineStand(ctx: ChapterContext): TurbineStand {
  const group = new Group();
  group.name = 'turbine-stand';
  const b = new Builder('turbine-stand');
  for (const x of Object.values(X))
    b.cyl(11, 2, { seg: 48, c: ['slate', 'steel'], slot: 'matte', at: [x, 0, 0] });
  // Kaplan barrel and draft pipe; Francis inflow ring (spiral stand-in) and draft cone; Pelton pit and nozzles
  b.cyl(7, 22, { seg: 40, c: 'sky', slot: 'glass', at: [X.kaplan, 2, 0] });
  b.add(
    G.revolve(
      [
        [7.2, -1.6],
        [10.4, -1.6],
        [10.4, 1.6],
        [7.2, 1.6],
      ],
      { seg: 48 },
    ).shell,
    { c: 'sky', slot: 'glass', at: [X.francis, Y + 1, 0] },
  );
  b.cyl(3.4, 9, { rTop: 2.6, seg: 32, c: 'sky', slot: 'glass', at: [X.francis, 2, 0] });
  b.cyl(9, 2.2, { seg: 40, c: 'sky', slot: 'glass', at: [X.pelton, 2, 0] });
  const jets: Mesh[] = [];
  const jetMat = K.glow({ color: 'sky', intensity: 1.5, whiten: 0.6 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const t = new Vector3(PITCH_R * Math.sin(a), 0, PITCH_R * Math.cos(a));
    const dir = new Vector3(Math.cos(a), 0, -Math.sin(a));
    const tip = t.clone().addScaledVector(dir, -3.6);
    const body = tip.clone().addScaledVector(dir, -2.4);
    b.rod([X.pelton + body.x, Y, body.z], [X.pelton + tip.x, Y, tip.z], 0.75, { c: 'blue' });
    b.cone(0.75, 1.2, {
      c: 'mist',
      at: [X.pelton + tip.x, Y, tip.z],
      rot: [0, Math.atan2(dir.x, dir.z), Math.PI / 2],
      axis: 'y',
    });
    const jet = new Mesh(new CylinderGeometry(0.32, 0.32, 3.6, 10), jetMat);
    jet.position.set(X.pelton + (tip.x + t.x) / 2, Y, (tip.z + t.z) / 2);
    jet.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    group.add(jet);
    jets.push(jet);
  }
  group.add(b.build().group);

  const kaplan = kaplanRunner({ radius: 5, blades: 5, color: 'teal' });
  kaplan.group.position.set(X.kaplan, Y, 0);
  group.add(kaplan.group);
  const francis = francisRunner({ radius: 4.6, blades: 15, color: 'blue' });
  francis.group.position.set(X.francis, Y, 0);
  group.add(francis.group);
  // Pelton wheel: disc with 20 double cups (a splitter between two half-cups)
  const pw = new Builder('pelton-wheel');
  pw.cyl(4.4, 1, { seg: 40, c: ['steel', 'steel.light'], slot: 'metal', at: [0, -0.5, 0] });
  pw.cyl(0.8, 8, { seg: 16, c: 'mist', slot: 'metal', at: [0, 0, 0] });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    pw.frame({ at: [PITCH_R * Math.sin(a), 0, PITCH_R * Math.cos(a)], rot: [0, a, 0] }, () => {
      for (const s of [-0.45, 0.45])
        pw.sphere(0.62, { c: ['sky.light', 'sky'], slot: 'metal', at: [0, s, 0], s: [1.1, 0.9, 0.8] });
      pw.box(0.16, 1.4, 1.2, { r: 0, mid: true, c: 'steel', slot: 'metal' });
    });
  }
  const pelton = pw.build().group;
  pelton.position.set(X.pelton, Y, 0);
  group.add(pelton);
  // the vortex rope: an amber corkscrew in the Francis draft cone (shown at low load)
  const helix: Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const u = i / 80;
    helix.push(new Vector3(1.3 * Math.sin(u * Math.PI * 6), 11 - u * 8, 1.3 * Math.cos(u * Math.PI * 6)));
  }
  const rope = new Mesh(
    G.tube(helix, 0.42, { seg: 8 }),
    K.glow({ color: 'amber', intensity: 1.2, keepHue: true }),
  );
  rope.position.set(X.francis, 0, 0);
  group.add(rope);
  // «вибрано»: a yellow ring under the recommended runner
  const ringMat = K.glow({ color: 'yellow', intensity: 1.4, keepHue: true });
  const ring = (x: number): Mesh => {
    const m = new Mesh(
      G.tube(
        Array.from(
          { length: 65 },
          (_, i) =>
            new Vector3(
              11.4 * Math.sin((i / 64) * Math.PI * 2),
              2.2,
              11.4 * Math.cos((i / 64) * Math.PI * 2),
            ),
        ),
        0.35,
        { seg: 6 },
      ),
      ringMat,
    );
    m.position.x = x;
    group.add(m);
    return m;
  };
  const rings = { kaplan: ring(X.kaplan), francis: ring(X.francis), pelton: ring(X.pelton) };
  // water: Kaplan axial streams, Francis inflow ring → down the cone
  const kap = [-4, -2, 0, 2, 4].flatMap((dx) => [
    {
      path: [
        new Vector3(X.kaplan + dx, 23, -2),
        new Vector3(X.kaplan + dx * 0.8, Y, -2),
        new Vector3(X.kaplan + dx * 0.7, 3, -2),
      ],
    },
  ]);
  const fra = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (k / 6) * Math.PI * 2;
    return {
      path: [
        new Vector3(X.francis + 9 * Math.sin(a), Y + 1, 9 * Math.cos(a)),
        new Vector3(X.francis + 4 * Math.sin(a + 0.6), Y, 4 * Math.cos(a + 0.6)),
        new Vector3(X.francis, Y - 3, 0),
        new Vector3(X.francis, 2.5, 0),
      ],
    };
  });
  const flows = [
    createFlow(ctx, {
      kind: 'blob',
      color: 'blue',
      paths: kap,
      count: 140,
      radius: 0.55,
      speed: 7,
      spread: 1,
    }),
    createFlow(ctx, {
      kind: 'blob',
      color: 'blue',
      paths: fra,
      count: 140,
      radius: 0.5,
      speed: 6,
      spread: 0.6,
    }),
  ];
  for (const f of flows) group.add(f);
  const spray = createParticles(ctx, {
    count: 160,
    emitter: discEmitter(PITCH_R + 0.4, { axis: [0, 1, 0], spread: 0.6 }),
    sprite: 'drop',
    color: ['white', 'sky'],
    life: [0.5, 0.9],
    speed: [4, 9],
    gravity: [0, -30, 0],
    size: 0.35,
    blend: 'normal',
  });
  spray.position.set(X.pelton, Y - 0.6, 0);
  group.add(spray);
  return {
    group,
    kaplan,
    francis,
    pelton,
    jets,
    rope,
    rings,
    flows,
    spray,
    at(name, out) {
      const p =
        name === 'servo'
          ? out.set(X.kaplan, Y + 1.2, 1.4)
          : name === 'deflector'
            ? out.set(X.pelton - 4.6, Y - 1.4, PITCH_R + 1.6)
            : name === 'rope'
              ? out.set(X.francis + 1.2, 7, 1.5)
              : out.set(X[name], 26, 0);
      return group.localToWorld(p);
    },
  };
}
