/**
 * The column of air of step 1: the Sun (the shared sun-lamp) on an arc, a 1 m² frame facing it above the
 * atmosphere (1361 W/m²), the atmosphere as a translucent `sky` slab in which some light is scattered (blue
 * sparkles) and the ray's path through it is drawn — the lower the Sun, the longer the path (air mass) —
 * and the 1 m² `cyan` frame on the ground with the counter. Not to scale; the Sun's arc is flattened to fit.
 */
import { BoxGeometry, Group, Mesh, type Object3D, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { boxEmitter, createBeam, createParticles } from '@/fx';
import { Builder } from '@/kit';
import { K } from '@/style';
import type { Text3D } from '@/text';
import { tag } from '../world';
import { createSunLamp, type SunLamp } from './sun-lamp';

const SLAB = { y0: 2.7, y1: 3.7, w: 5.6, d: 2.4 } as const;
const FRAME = 1.5; // the "1 m²" frame, stage units

export interface SkyColumn {
  group: Group;
  lamp: SunLamp;
  anchors: { slab: Object3D; ground: Object3D; top: Object3D };
  counter: Text3D;
  topCounter: Text3D;
  pathLabel: Text3D;
  /** `elevation` in degrees, `transmitted` = G_n / 1361 (share of the beam that survives the air). */
  set(elevationDeg: number, transmitted: number, t: number): void;
}

export function createSkyColumn(ctx: ChapterContext): SkyColumn {
  const group = new Group();
  group.name = 'sky-column';
  const slab = new Mesh(new BoxGeometry(SLAB.w, SLAB.y1 - SLAB.y0, SLAB.d), K.glass({ color: 'sky', opacity: 0.16, edgeOpacity: 0.55 }));
  slab.position.y = (SLAB.y0 + SLAB.y1) / 2;
  const frame = (): Group => {
    const b = new Builder('m2-frame');
    for (const s of [-1, 1]) {
      b.box(FRAME, 0.05, 0.05, { r: 0.02, slot: 'glow', c: 'cyan', at: [0, 0, (s * FRAME) / 2] });
      b.box(0.05, 0.05, FRAME, { r: 0.02, slot: 'glow', c: 'cyan', at: [(s * FRAME) / 2, 0, 0] });
    }
    return b.build().group;
  };
  const ground = frame();
  ground.position.y = 0.02;
  const top = frame();
  top.scale.setScalar(0.62);
  const scatter = createParticles(ctx, {
    count: 70,
    emitter: boxEmitter([SLAB.w * 0.7, SLAB.y1 - SLAB.y0, SLAB.d * 0.7]),
    sprite: 'soft',
    color: ['sky', 'white'],
    life: [0.8, 1.6],
    speed: [0.2, 0.7],
    size: [0.03, 0.11, 0.02],
    intensity: 1.4,
  });
  scatter.position.y = slab.position.y;
  const path = createBeam({ from: [0, SLAB.y1, 0], to: [0, SLAB.y0, 0], color: 'white', width: 0.06, intensity: 1.2, ripple: 0 });
  const lamp = createSunLamp(ctx, { radius: 0.5, count: 46, packet: 0.8, speed: 3.2 });
  const counter = tag('', 24, 'white', 'display');
  counter.position.set(0, 0.75, FRAME / 2 + 0.2);
  const topCounter = tag('', 19, 'yellow', 'display');
  const pathLabel = tag('', 19, 'sky', 'display');
  group.add(slab, ground, top, scatter, path, lamp.group, counter, topCounter, pathLabel);

  const sun = new Vector3();
  const aim = new Vector3(0, 0.02, 0);
  const dir = new Vector3();
  const up = new Vector3(0, 1, 0);
  const at = (y: number, out: Vector3): Vector3 => out.copy(sun).addScaledVector(dir, (y - sun.y) / dir.y);
  const a = new Vector3();
  const b = new Vector3();
  return {
    group,
    lamp,
    counter,
    topCounter,
    pathLabel,
    anchors: { slab, ground, top },
    set(elevationDeg, transmitted, t) {
      const h = (elevationDeg * Math.PI) / 180;
      // flattened arc: the Sun stays inside the frame for every elevation
      sun.set(-Math.cos(h) * 2.9, 4.6 + Math.sin(h) * 2.3, 0);
      dir.subVectors(aim, sun).normalize();
      lamp.place(sun, aim, FRAME * 0.5, up);
      lamp.setLevel(1, transmitted);
      top.position.copy(sun).addScaledVector(dir, 1.25);
      top.quaternion.setFromUnitVectors(up, dir.clone().negate());
      topCounter.position.copy(top.position).add(a.set(1.25, 0.1, 0));
      at(SLAB.y1, a);
      at(SLAB.y0, b);
      path.from.copy(a);
      path.to.copy(b);
      pathLabel.position.copy(a).lerp(b, 0.5);
      pathLabel.position.x += 1.0;
      pathLabel.position.z += SLAB.d / 2;
      scatter.rate = Math.min(1, (1 - transmitted) * 1.6);
      ground.position.y = 0.02 + Math.sin(t * 2) * 0.004;
    },
  };
}
