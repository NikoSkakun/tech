/**
 * Step 2: the water cycle that lifts the water — a stylised sun above the bay with yellow rays down to the
 * sea, white / mist vapour rising from the water, a train of three rain clouds sailing from the bay to the
 * western mountains (where `water-fx` rains), all in one group shown as a stage actor.
 */
import { Group, Mesh, CylinderGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { K } from '@/style';
import { Builder } from '@/kit';
import { boxEmitter, createParticles } from '@/fx';
import { ISLAND } from '../layout';

export interface WaterCycle {
  group: Group;
  /** World points for callouts: above the vapour, the lead cloud, the rain. */
  sunAt: Vector3;
  cloudAt(out: Vector3): Vector3;
  rainAt: Vector3;
  update(dt: number): void;
}

const SEA_X = ISLAND.coastX + 70;
const FROM = new Vector3(SEA_X, 150, -20);
const TO = new Vector3(-236, 190, -10);

export function buildWaterCycle(ctx: ChapterContext): WaterCycle {
  const group = new Group();
  group.name = 'water-cycle';
  const sun = new Mesh(new CylinderGeometry(16, 16, 2, 40), K.glow({ color: 'yellow', intensity: 1.6 }));
  sun.rotation.x = Math.PI / 2;
  sun.position.set(SEA_X - 10, 230, -90);
  group.add(sun);
  // rays: thin glowing rods fanning from the sun down onto the sea
  for (let i = 0; i < 5; i++) {
    const target = new Vector3(SEA_X - 30 + i * 18, ISLAND.seaLevel, -10 + (i % 2) * 30);
    const dir = target.clone().sub(sun.position);
    const len = dir.length();
    const ray = new Mesh(
      new CylinderGeometry(0.6, 1.6, len, 8, 1, true),
      K.glow({ color: 'yellow', intensity: 0.9, falloff: 0.6 }),
    );
    ray.position.copy(sun.position).addScaledVector(dir, 0.5);
    ray.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    group.add(ray);
  }
  const vapour = createParticles(ctx, {
    count: 260,
    emitter: boxEmitter([90, 2, 120]),
    sprite: 'puff',
    color: ['white', 'mist'],
    life: [5, 8],
    speed: [10, 18],
    size: [1.2, 4.5, 2],
    turbulence: { amplitude: 3 },
    fadeIn: 0.2,
    fadeOut: 0.4,
    opacity: 0.8,
    blend: 'normal',
  });
  vapour.position.set(SEA_X, ISLAND.seaLevel + 2, 20);
  group.add(vapour);
  // three puffy clouds that grow darker as they reach the mountains
  const clouds: Group[] = [];
  for (let i = 0; i < 3; i++) {
    const b = new Builder(`cloud${i}`);
    for (const [x, y, z, r] of [
      [0, 0, 0, 14],
      [13, -3, 4, 10],
      [-12, -2, -3, 11],
      [4, 6, -2, 10],
    ] as const)
      b.sphere(r, { c: ['mist', 'white'], slot: 'soft', at: [x, y, z] });
    const c = b.build().group;
    group.add(c);
    clouds.push(c);
  }
  let phase = 0;
  const lead = new Vector3();
  return {
    group,
    sunAt: new Vector3(SEA_X, 60, 20),
    cloudAt: (out) => out.copy(lead),
    rainAt: new Vector3(-226, 120, 30),
    update(dt) {
      phase = (phase + dt / 16) % 1;
      clouds.forEach((c, i) => {
        const u = (phase + i / 3) % 1;
        c.position.lerpVectors(FROM, TO, u);
        c.position.z += (i - 1) * 40;
        const grow = Math.min(1, u * 4) * Math.min(1, (1 - u) * 8);
        c.scale.setScalar(0.4 + 0.8 * grow);
        if (i === 0) lead.copy(c.position);
      });
    },
  };
}
