/**
 * Step 2 analogy: a tube packed with balls. Push one in at the left — at once another drops out at the right.
 * The state is one number, `phase` = pushes so far (the fraction is the push in progress), so the picture is a
 * pure function of it. `pushing` makes the plunger push once every `PERIOD` seconds.
 */
import { CylinderGeometry, Group, Mesh } from 'three';
import { createOrbs } from '@/fx';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';
import { RACE } from './race';

export interface BallTube {
  group: Group;
  pushing: boolean;
  /** Pushes completed (+ fraction of the one in progress). */
  readonly phase: number;
  reset(): void;
  update(dt: number): void;
}

const PERIOD = 1.15;
const STROKE = 0.3; // seconds of one push
const R = 0.19;

export function createBallTube(): BallTube {
  const g = new Group();
  g.name = 'ball-tube';
  const L = RACE.x1 - RACE.x0;
  const N = Math.floor(L / (2 * R));
  const d = L / N; // pitch: the row exactly fills the tube
  const geo = new CylinderGeometry(0.235, 0.235, L, 32, 1, true);
  geo.rotateZ(Math.PI / 2);
  const tube = new Mesh(geo, K.glass({ color: 'sky', opacity: 0.14, edgeOpacity: 0.6 }));
  tube.position.set(0, RACE.wireY, 0);
  tube.renderOrder = 5;
  const b = new Builder('ball-tube-rig');
  for (const x of [RACE.x0 + 0.5, RACE.x1 - 0.5]) {
    b.box(0.2, RACE.wireY - 0.2, 0.34, { at: [x, 0, 0], r: 0.04, c: ['ink', 'slate'] });
    b.ring(0.25, 0.035, { at: [x, RACE.wireY, 0], axis: 'x', seg: 28, slot: 'metal', c: 'steel' });
  }
  b.box(0.9, 0.06, 0.7, { at: [RACE.x1 + 0.55, 0, 0], r: 0.02, c: 'slate' }); // tray that catches the balls
  const plunger = b.part('plunger', { at: [RACE.x0, RACE.wireY, 0] });
  plunger.cyl(0.2, 0.08, { at: [-0.08, 0, 0], axis: 'x', seg: 24, slot: 'gloss', c: 'coral' });
  plunger.cyl(0.05, 0.7, { at: [-0.78, 0, 0], axis: 'x', seg: 12, slot: 'metal', c: 'steel' });
  plunger.cyl(0.13, 0.1, { at: [-0.88, 0, 0], axis: 'x', seg: 20, slot: 'gloss', c: 'coral' });
  const rig = b.build();
  const rod = rig.part('plunger');
  // N balls in the tube + the one that is entering + the one that is falling out
  const balls = createOrbs({ kind: 'blob', count: N + 2, radius: R, color: SEMANTIC.electron });
  g.add(rig.group, tube, balls);

  let count = 0; // pushes completed
  let clock = 0; // time inside the current cycle
  let active = false;
  const slot = (k: number): number => RACE.x0 + d * (k + 0.5);
  const self: BallTube = {
    group: g,
    pushing: false,
    get phase() {
      return count + (active ? Math.min(clock / STROKE, 1) : 0);
    },
    reset() {
      count = 0;
      clock = 0;
      active = false;
    },
    update(dt) {
      if (!active && self.pushing) {
        active = true;
        clock = 0;
      }
      if (active) clock += dt;
      if (active && clock >= PERIOD) {
        count++;
        active = false;
        clock = 0;
      }
      const k = active ? Math.min(clock / STROKE, 1) : 0;
      const s = k * k * (3 - 2 * k);
      if (k < 1) {
        // the stroke: the whole row moves one pitch at once — the far ball leaves as the near one enters
        for (let i = 0; i < N; i++) balls.setPosition(i, slot(i + s), RACE.wireY, 0);
        balls.setPosition(N, slot(s - 1), RACE.wireY, 0, s > 0.02 ? 1 : 0);
        balls.setPosition(N + 1, 0, -1, 0, 0);
        rod.position.x = RACE.x0 + d * (s - 1);
      } else {
        // after the stroke the row is at rest again (shifted by one ball); the pushed-out ball drops on the tray
        const tf = clock - STROKE;
        for (let i = 0; i < N; i++) balls.setPosition(i, slot(i), RACE.wireY, 0);
        balls.setPosition(N, 0, -1, 0, 0);
        const y = Math.max(RACE.wireY - 6 * tf * tf, R + 0.06);
        const fade = 1 - Math.min(Math.max((clock - PERIOD + 0.25) / 0.25, 0), 1);
        balls.setPosition(N + 1, slot(N) + Math.min(tf, 0.45) * 0.9, y, 0, fade);
        rod.position.x = RACE.x0 - d * Math.min(tf / 0.4, 1);
      }
      balls.commit();
    },
  };
  return self;
}
