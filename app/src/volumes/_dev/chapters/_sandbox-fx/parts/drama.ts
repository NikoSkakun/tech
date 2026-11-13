/**
 * Stand 5 — electric drama: an arc between two electrodes, corona on a high-voltage bar, a lamp with halo
 * and light shaft, a periodic short circuit with sparks, a lightning strike and affordance rings.
 */
import { CapsuleGeometry, CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import { audio } from '@/audio';
import type { ChapterContext } from '@/engine/api';
import {
  createArc,
  createCorona,
  createHalo,
  createLightShaft,
  createPulseRings,
  createShortCircuit,
} from '@/fx';
import { K } from '@/style';
import type { Exhibit } from './exhibit';

export function createDramaExhibit(ctx: ChapterContext): Exhibit {
  const group = new Group();
  group.name = 'exhibit:drama';
  const metal = K.metal({ color: 'steel' });
  const ceramic = K.toon({ color: 'mist', gloss: 0.4 });
  const dark = K.toon({ color: 'slate' });

  // two electrodes on ribbed insulators with a burning arc
  const electrode = (x: number): void => {
    const post = new Mesh(new CylinderGeometry(0.16, 0.22, 1.5, 24), ceramic);
    post.position.set(x, 0.75, 0);
    for (let i = 0; i < 4; i++) {
      const rib = new Mesh(new CylinderGeometry(0.3, 0.3, 0.07, 28), ceramic);
      rib.position.set(x, 0.35 + i * 0.3, 0);
      rib.castShadow = true;
      group.add(rib);
    }
    const ball = new Mesh(new SphereGeometry(0.24, 32, 20), metal);
    ball.position.set(x, 1.72, 0);
    post.castShadow = ball.castShadow = true;
    group.add(post, ball);
  };
  electrode(-3.4);
  electrode(-1.6);
  const arc = createArc({ from: [-3.18, 1.78, 0], to: [-1.82, 1.78, 0], jaggedness: 0.14, branches: 1, width: 0.035 });
  const arcGlow = createHalo({ color: 'sky', size: 2.4, intensity: 0.5 });
  arcGlow.position.set(-2.5, 1.78, 0);
  group.add(arc, arcGlow);

  // high-voltage bar with corona crowns at both ends
  const bar = new Mesh(new CapsuleGeometry(0.07, 2.6, 8, 20), metal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(1.2, 3.5, 0);
  bar.castShadow = true;
  group.add(bar);
  for (const x of [-0.15, 2.55]) {
    const corona = createCorona({ size: 1.3, intensity: 1.3, speed: 1 });
    corona.position.set(x, 3.5, 0);
    group.add(corona);
  }

  // lamp: bulb halo + light shaft falling on the floor
  const lampArm = new Mesh(new CapsuleGeometry(0.05, 1.0, 6, 12), dark);
  lampArm.position.set(4.3, 4.3, 0);
  const bulb = new Mesh(new SphereGeometry(0.17, 24, 16), K.glow({ color: 'yellow', intensity: 2.2 }));
  bulb.position.set(4.3, 3.7, 0);
  const halo = createHalo({ color: 'yellow', size: 1.5, intensity: 0.9, amount: 0.15 });
  halo.position.copy(bulb.position);
  const shaft = createLightShaft({ length: 3.7, radiusTop: 0.15, radiusBottom: 1.3, intensity: 0.45 });
  shaft.position.copy(bulb.position);
  group.add(lampArm, bulb, halo, shaft);

  // short circuit on a small terminal block, lightning from above, affordance rings on the floor
  const block = new Mesh(new CylinderGeometry(0.35, 0.4, 0.5, 6), dark);
  block.position.set(1.2, 0.25, 0.6);
  block.castShadow = true;
  group.add(block);
  const short = createShortCircuit(ctx, { size: 2.6 });
  short.position.set(1.2, 0.62, 0.6);
  group.add(short);
  const bolt = createArc({ from: [1.2, 3.4, 0], to: [1.2, 0.6, 0.6], jaggedness: 0.2, branches: 3, continuous: false, intensity: 3.2 });
  group.add(bolt);
  const rings = createPulseRings({ size: 2.2, billboard: false, intensity: 1.2, amount: 3 });
  rings.rotation.x = -Math.PI / 2;
  rings.position.set(1.2, 0.02, 0.6);
  group.add(rings);

  let next = 1.5;
  return {
    group,
    enter() {
      next = ctx.clock.time + 1.5;
    },
    update(_dt, t) {
      // every 3 s: lightning hits the block, which answers with a flash and sparks
      if (t >= next) {
        next = t + 3;
        bolt.strike(0.4);
        short.fire();
        audio.play('zap');
      }
      arc.power = 0.75 + 0.25 * Math.sin(t * 1.7);
      audio.loop('buzz').set({ gain: 0.18 * arc.power });
    },
  };
}
