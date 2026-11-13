/**
 * Step 2 hero: the long wire (3 m, not to scale) in transparent insulation, full of electrons, with two "race
 * lanes" above it — the snail-electron on the lower one, the `amber` field front on the upper one. The front
 * sweeps the wire in `DRIFT.frontSceneS`; every electron it has passed starts to drift (all of them almost at
 * once), while the snail crawls at the true drift speed in the wire's true scale — i.e. it practically stands.
 */
import { CylinderGeometry, Group, Mesh, TorusGeometry, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createElectron, createHalo, createOrbs, createTrail } from '@/fx';
import { Builder } from '@/kit';
import { K, SEMANTIC, col } from '@/style';

export const RACE = { x0: -2.0, x1: 2.0, wireY: 0.62, snailY: 1.3, frontY: 1.85 } as const;

export interface Race {
  group: Group;
  snail: Object3D;
  frontMark: Object3D;
  /** 0…1 progress of the field front along the wire (0 = at the switch, not started). */
  front: number;
  /** Scene drift speed of the electrons the front has passed, units/s (exaggerated; 0 = circuit open). */
  drift: number;
  /** True scale position of the snail along the lane, 0…1 of the 3 m (≈ 0 for any watchable time). */
  snailAt: number;
  update(dt: number, t: number): void;
}

export function createRace(ctx: ChapterContext): Race {
  const g = new Group();
  g.name = 'race';
  const L = RACE.x1 - RACE.x0;
  // the wire: copper-tinted glass insulation on two posts, brass ferrules at the ends
  const b = new Builder('race-rig');
  for (const x of [RACE.x0 - 0.12, RACE.x1 + 0.12]) {
    b.cyl(0.24, 0.22, {
      at: [x - 0.11, RACE.wireY, 0],
      axis: 'x',
      seg: 28,
      slot: 'metal',
      c: 'amber',
      bevel: 0.03,
    });
    b.box(0.2, RACE.wireY - 0.1, 0.3, { at: [x, 0, 0], r: 0.04, c: ['ink', 'slate'] });
    // lane posts with start / finish flags
    b.cyl(0.03, RACE.frontY + 0.15, { at: [x, 0, -0.42], seg: 10, slot: 'metal', c: 'steel' });
    b.box(0.02, 0.2, 0.26, { at: [x, RACE.frontY - 0.02, -0.29], r: 0, c: x < 0 ? 'white' : 'coral' });
  }
  for (const y of [RACE.snailY - 0.2, RACE.frontY - 0.2])
    b.rod([RACE.x0 - 0.12, y, -0.42], [RACE.x1 + 0.12, y, -0.42], 0.018, { slot: 'metal', c: 'steel' });
  g.add(b.build().group);
  const tubeGeo = new CylinderGeometry(0.21, 0.21, L, 32, 1, true);
  tubeGeo.rotateZ(Math.PI / 2);
  const tube = new Mesh(
    tubeGeo,
    K.glass({ color: col('orange').lerp(col('sky'), 0.5), opacity: 0.16, edgeOpacity: 0.6 }),
  );
  tube.position.set(0, RACE.wireY, 0);
  tube.renderOrder = 5;
  g.add(tube);

  // electrons inside the wire: two staggered rows, CPU-positioned so that each one can wait for the front
  const N = ctx.quality.count(44, 24);
  const electrons = createOrbs({ kind: 'electron', count: N, radius: 0.07 });
  const home = Array.from({ length: N }, (_, i) => (i + 0.5) / N);
  const moved = new Float32Array(N);
  g.add(electrons);

  // the snail: a hero electron under a tiny steel helmet
  const snail = new Group();
  const hb = new Builder('helmet');
  hb.dome(0.2, 0.16, { at: [0, 0.02, 0], seg: 20, slot: 'metal', c: 'mist' });
  hb.box(0.42, 0.03, 0.05, { at: [0, 0.02, 0], r: 0.01, c: 'coral' });
  snail.add(createElectron({ radius: 0.17 }), hb.build().group);
  snail.position.set(RACE.x0, RACE.snailY, -0.42);
  // the field front: an amber mote on its lane and an amber ring sweeping the wire itself
  const mote = new Group();
  const moteBall = createOrbs({ kind: 'pulse', count: 1, radius: 0.13, color: SEMANTIC.fieldE });
  moteBall.setPosition(0, 0, 0, 0);
  moteBall.commit();
  mote.add(moteBall, createHalo({ color: SEMANTIC.fieldE, size: 0.9, intensity: 0.55 }));
  mote.position.set(RACE.x0, RACE.frontY, -0.42);
  const sweep = new Mesh(
    new TorusGeometry(0.3, 0.035, 10, 40),
    K.glow({ color: SEMANTIC.fieldE, intensity: 1.6, falloff: 0, whiten: 0, keepHue: true }),
  );
  sweep.rotation.y = Math.PI / 2;
  const trail = createTrail(mote, { color: SEMANTIC.fieldE, duration: 0.5, width: 0.12 });
  g.add(snail, mote, sweep, trail);

  const self: Race = {
    group: g,
    snail,
    frontMark: mote,
    front: 0,
    drift: 0,
    snailAt: 0,
    update(dt, t) {
      const f = Math.min(Math.max(self.front, 0), 1);
      const fx = RACE.x0 + L * f;
      mote.position.x = fx;
      sweep.position.set(fx, RACE.wireY, 0);
      sweep.visible = f > 0.001 && f < 0.999;
      snail.position.x = RACE.x0 + L * Math.min(self.snailAt, 1);
      snail.position.y = RACE.snailY + Math.sin(t * 2.1) * 0.012;
      for (let i = 0; i < N; i++) {
        // only electrons behind the front feel the field; they all drift at the same speed
        if (home[i]! <= f) moved[i] = (moved[i]! + (self.drift * dt) / L) % 1;
        const u = (home[i]! + moved[i]!) % 1;
        const edge = Math.min(u, 1 - u) * 14; // shrink in / out at the ferrules
        const row = i % 2 ? 0.07 : -0.07;
        electrons.setPosition(
          i,
          RACE.x0 + L * u,
          RACE.wireY + row + Math.sin(t * 7 + i * 1.9) * 0.012,
          row * 0.6,
          Math.min(edge, 1),
        );
      }
      electrons.commit();
    },
  };
  return self;
}
