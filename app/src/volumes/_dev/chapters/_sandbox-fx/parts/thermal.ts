/**
 * Stand 6 — boiler corner: burner flames under a boiler that glows with heat, bubbles in its water gauge,
 * steam and smoke, a cooling tower with its plume, a stream running over a spillway with foam, splashes and
 * ripples, and a condenser box with falling droplets.
 */
import { BoxGeometry, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry, Group, LatheGeometry, Mesh, Vector2, Vector3 } from 'three';
import { audio } from '@/audio';
import type { ChapterContext } from '@/engine/api';
import {
  applyHeat,
  createBubbles,
  createFlame,
  createFoam,
  createGasFlame,
  createHeatShimmer,
  createHotSteam,
  createParticles,
  createPlume,
  createRain,
  createRipples,
  createSmoke,
  createSplash,
  createSteam,
  createWaterStrip,
  surfaceEmitter,
} from '@/fx';
import { K } from '@/style';
import type { Exhibit } from './exhibit';

export function createThermalExhibit(ctx: ChapterContext): Exhibit {
  const group = new Group();
  group.name = 'exhibit:thermal';
  const add = <T extends Mesh>(m: T, x: number, y: number, z: number, shadow = true): T => {
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // boiler on a firebox, with burner flames, a glowing belly, a water gauge and a steam whistle
  const shell = K.metal({ color: 'slate.light' });
  const boiler = add(new Mesh(new CapsuleGeometry(0.8, 1.5, 12, 32), shell), -3.2, 1.75, 0);
  boiler.rotation.z = Math.PI / 2;
  add(new Mesh(new BoxGeometry(2.6, 0.5, 1.3), K.toon({ color: 'slate' })), -3.2, 0.25, 0);
  const flames = [-0.8, -0.25, 0.3, 0.85].map((dx, i) => {
    const f = i % 2 === 0 ? createFlame({ height: 0.62, width: 0.36, seed: i }) : createGasFlame({ height: 0.55, width: 0.26, seed: i });
    f.position.set(-3.2 + dx, 0.5, 0.35);
    group.add(f);
    return f;
  });
  boiler.updateMatrix();
  const motes = createParticles(ctx, { count: 50, emitter: surfaceEmitter(boiler.geometry, { matrix: boiler.matrix }), color: ['orange', 'red'], size: [0.05, 0.015], life: [0.8, 1.6], speed: [0.1, 0.3], gravity: [0, 0.5, 0], intensity: 1.5 });
  group.add(motes);
  const mist = createSteam(ctx, { radius: 0.3, height: 1.1, count: 16, opacity: 0.55 });
  mist.position.set(2.4, 0.2, 1.3);
  group.add(mist);
  const shimmer = createHeatShimmer({ width: 2.2, height: 1.3, intensity: 0.7 });
  shimmer.position.set(-3.2, 2.5, 0.2);
  group.add(shimmer);
  add(new Mesh(new CapsuleGeometry(0.16, 1.0, 8, 16), K.glass({ color: 'sky', opacity: 0.25 })), -1.95, 1.75, 0.55, false);
  const bubbles = createBubbles(ctx, { size: [0.2, 1.1, 0.2], count: 14, radius: 0.045, rise: 0.5 });
  bubbles.position.set(-1.95, 1.75, 0.55);
  group.add(bubbles);
  add(new Mesh(new CylinderGeometry(0.09, 0.09, 0.6, 16), shell), -3.9, 2.8, 0);
  const steam = createHotSteam(ctx, { radius: 0.13, height: 1.7, count: 30 });
  steam.position.set(-3.9, 3.1, 0);
  group.add(steam);
  add(new Mesh(new CylinderGeometry(0.2, 0.26, 2.6, 20), K.toon({ color: 'slate' })), -4.8, 1.3, -0.4);
  const smoke = createSmoke(ctx, { radius: 0.17, height: 2.0, count: 26, wind: [0.25, 0, 0] });
  smoke.position.set(-4.8, 2.65, -0.4);
  group.add(smoke);

  // cooling tower (hyperboloid lathe, bottom → top) with a plume
  const profile = [[1.25, 0], [1.02, 0.7], [0.85, 1.5], [0.82, 2.1], [0.95, 2.9]].map(([r, y]) => new Vector2(r, y));
  add(new Mesh(new LatheGeometry(profile, 48), K.toon({ color: 'mist', side: 2 })), 4.2, 0, -0.6);
  const plume = createPlume(ctx, { radius: 0.75, height: 3.2, count: 46, wind: [-0.3, 0, 0] });
  plume.position.set(4.2, 2.9, -0.6);
  group.add(plume);

  // stream → spillway → pool
  const bed = new CatmullRomCurve3([new Vector3(-0.9, 1.5, 0.9), new Vector3(0.3, 1.47, 0.9), new Vector3(1.0, 1.42, 0.9)]);
  const fall = new CatmullRomCurve3([new Vector3(1.0, 1.42, 0.9), new Vector3(1.25, 1.2, 0.9), new Vector3(1.4, 0.16, 0.9)]);
  add(new Mesh(new BoxGeometry(2.1, 1.45, 1.2), K.toon({ color: 'steel', gradient: { bottom: 'slate', top: 'steel', range: [-0.6, 0.6] } })), 0.0, 0.725, 0.9);
  group.add(createWaterStrip(bed, { width: 0.9, speed: 0.9, whiteWater: 0.15 }));
  group.add(createWaterStrip(fall, { width: 0.9, speed: 2.6, whiteWater: 0.8, up: new Vector3(1, 0.4, 0) }));
  const pool = add(new Mesh(new CylinderGeometry(1.25, 1.25, 0.12, 48), K.water({ shape: 'disc', scale: 0.8 })), 2.0, 0.08, 1.0, false);
  void pool;
  const foam = createFoam(ctx, { radius: 0.42, count: 20 });
  foam.position.set(1.5, 0.2, 0.9);
  const splash = createSplash(ctx);
  splash.position.set(1.5, 0.2, 0.9);
  const ripples = createRipples({ size: 2.2, rings: 3 });
  ripples.position.set(1.6, 0.16, 0.95);
  group.add(foam, splash, ripples);

  // condenser: a glass box with a rain of droplets
  add(new Mesh(new BoxGeometry(1.3, 1.5, 1.0), K.glass({ color: 'sky', opacity: 0.1 })), 2.4, 3.5, -0.2, false).renderOrder = 3;
  const rain = createRain(ctx, { size: [1.1, 1.4, 0.8], count: 46, speed: 2.4, dropSize: 0.045 });
  rain.position.set(2.4, 3.5, -0.2);
  group.add(rain);

  let nextSplash = 0;
  return {
    group,
    update(_dt, t) {
      // the burner breathes between half and full power; the boiler shell follows with a delay
      const power = 0.72 + 0.28 * Math.sin(t * 0.9);
      flames.forEach((f, i) => (f.power = power * (0.9 + 0.1 * Math.sin(t * 2 + i))));
      audio.loop('fire').set({ gain: 0.3 * power });
      audio.loop('water').set({ gain: 0.22 });
      applyHeat(shell, 0.3 + 0.15 * Math.sin(t * 0.9 - 0.8), 0.9);
      if (t >= nextSplash) {
        nextSplash = t + 0.35;
        splash.burst([ctx.random.signed(0.25), 0, ctx.random.signed(0.3)], 5, [0.3, 1, 0], 0.6);
      }
    },
  };
}
