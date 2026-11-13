/**
 * Set dressing of step 10 around the P-V mountain: a small module under its own sun-lamp (the source being
 * tracked), a cloud that slides in front of the lamp, and the hybrid inverter «ЛІ-6» (kit) in which the tracker
 * lives. Pure builder; the step sets the light level and the cloud cover.
 */
import { Group, type Object3D, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, hybridInverter, pvModule } from '@/kit';
import { shadows } from '../world';
import { createSunLamp, type SunLamp } from './sun-lamp';

export interface MpptSet {
  group: Group;
  lamp: SunLamp;
  anchors: { inverter: Object3D; pv1: Object3D; module: Object3D };
  /** `light` = G / 1000, `cover` 0…1 = how far the cloud has slid in front of the lamp. */
  set(light: number, cover: number, t: number): void;
}

export function createMpptSet(ctx: ChapterContext): MpptSet {
  const group = new Group();
  group.name = 'mppt-set';
  // small module on a post, tilted toward the lamp
  const module = pvModule({ detail: 'mid' });
  module.group.scale.setScalar(0.95);
  module.group.rotation.set(0.95, 0.5, 0, 'YXZ');
  module.group.position.set(-2.75, 1.25, -1.9);
  const post = new Builder('mppt-post');
  post.cyl(0.3, 0.08, { seg: 24, c: 'bg.indigo', at: [-2.75, 0, -2.05] });
  post.beam([-2.75, 0.06, -2.05], [-2.75, 1.2, -2.0], 0.09, { slot: 'metal', c: 'steel' });
  // inverter on a wall panel
  post.box(1.5, 2.0, 0.14, { r: 0.05, slot: 'gloss', c: ['slate', 'steel'], at: [2.75, 0, -2.0] });
  post.box(1.8, 0.1, 0.5, { r: 0.04, c: 'bg.indigo', at: [2.75, 0, -2.0] });
  const inverter = hybridInverter();
  inverter.group.scale.setScalar(2.1);
  inverter.group.position.set(2.75, 1.25, -1.92);
  group.add(shadows(module.group), shadows(post.build().group), shadows(inverter.group));

  const centre = module.group.position.clone();
  const normal = new Vector3(0, 1, 0).applyEuler(module.group.rotation);
  const lamp = createSunLamp(ctx, { radius: 0.3, count: 14, packet: 0.6 });
  const lampAt = centre.clone().addScaledVector(normal, 2.6).add(new Vector3(0.2, 0.5, 0));
  lamp.place(lampAt, centre, 0.7, normal);
  group.add(lamp.group);

  // toon cloud: a few merged puffs
  const c = new Builder('cloud');
  for (const [x, y, z, r] of [[0, 0, 0, 0.42], [0.45, -0.05, 0.05, 0.32], [-0.45, -0.08, 0, 0.3], [0.15, 0.2, -0.05, 0.3], [-0.2, 0.16, 0.08, 0.27]] as const) {
    c.sphere(r, { seg: 18, slot: 'soft', c: 'white', at: [x, y, z] });
  }
  const cloud = c.build().group;
  group.add(cloud);
  const cloudRest = lampAt.clone().add(new Vector3(-2.2, 0.6, 0.4));
  const cloudOver = centre.clone().lerp(lampAt, 0.62);

  return {
    group,
    lamp,
    anchors: { inverter: inverter.anchor('display'), pv1: inverter.anchor('pv1'), module: module.anchor('centre') },
    set(light, cover, t) {
      lamp.setLevel(light, 1);
      cloud.position.lerpVectors(cloudRest, cloudOver, Math.min(1, Math.max(0, cover)));
      cloud.position.y += Math.sin(t * 0.8) * 0.05;
      cloud.scale.setScalar(0.85 + 0.25 * cover);
    },
  };
}
