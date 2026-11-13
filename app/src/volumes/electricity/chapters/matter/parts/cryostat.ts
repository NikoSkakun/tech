/**
 * Superconductivity sub-scene of step 5: a frosted cryostat flask with a silvery mercury drop inside, and a ring
 * of superconductor beside it. Below T_c (`superconducting` → 1) electrons travel in Cooper pairs joined by thin
 * `cyan` threads, in an even file around the ring — the current never decays; above T_c the pairs break up,
 * the electrons scatter and the ring current dies.
 */
import { Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { boxEmitter, createOrbs, createParticles, RibbonLines } from '@/fx';
import { Builder, G } from '@/kit';
import { K } from '@/style';

const PAIRS = 12;
const RING_R = 1.05;

export interface Cryostat {
  group: Group;
  /** 0…1 (eased by the caller): superconducting share. */
  superconducting: number;
  ring: Vector3;
  drop: Vector3;
  update(dt: number, t: number): void;
}

export function createCryostat(ctx: ChapterContext): Cryostat {
  const group = new Group();
  const b = new Builder('cryostat');
  // flask: base, double glass wall, frosted collar, cap with two leads
  b.cyl(0.95, 0.22, { seg: 48, c: ['bg.deep', 'slate'], at: [-1.6, 0, 0] });
  b.lathe(
    [
      [0.01, 0.22],
      [0.72, 0.24],
      [0.8, 0.5],
      [0.8, 2.4],
      [0.62, 2.62],
    ],
    { seg: 48, slot: 'glass', at: [-1.6, 0, 0] },
  );
  b.cyl(0.66, 0.22, { seg: 48, c: ['white', 'sky.light'], at: [-1.6, 2.55, 0] });
  b.cyl(0.5, 0.16, { seg: 40, slot: 'metal', c: 'steel', at: [-1.6, 2.77, 0] });
  for (const s of [-1, 1]) b.rod([-1.6 + 0.2 * s, 2.9, 0], [-1.6 + 0.3 * s, 1.15, 0], 0.025, { c: 'orange' });
  b.cyl(0.18, 0.5, { seg: 24, c: 'slate', at: [-1.6, 0.22, 0] });
  // the ring stand
  b.cyl(0.55, 0.14, { seg: 40, c: ['bg.deep', 'slate'], at: [1.5, 0, 0] });
  b.cyl(0.07, 0.9, { seg: 16, slot: 'metal', c: 'steel', at: [1.5, 0.14, 0] });
  group.add(b.build().group);
  const drop = new Mesh(G.sphere(0.32, 40), K.metal({ color: 'mist', specular: 0.95, shininess: 90 }));
  drop.scale.set(1, 0.72, 1);
  drop.position.set(-1.6, 0.95, 0);
  const ring = new Mesh(G.ring(RING_R, 0.14, 96, 20), K.metal({ color: 'sky.light', specular: 0.8 }));
  ring.position.set(1.5, 1.6, 0);
  ring.rotation.x = -1.15;
  const frost = createParticles(ctx, {
    count: 90,
    emitter: boxEmitter([2, 2.4, 1.8]),
    sprite: 'disc',
    color: ['white', 'sky.light'],
    life: [3, 5],
    speed: [0.02, 0.08],
    size: [0.03, 0.06, 0.02],
    gravity: [0, -0.03, 0],
    blend: 'normal',
  });
  frost.position.set(-1.6, 1.5, 0);
  const electrons = createOrbs({ kind: 'electron', count: PAIRS * 2, radius: 0.095 });
  const threads = new RibbonLines({ capacity: PAIRS * 2 + 2, color: 'cyan', width: 0.03, intensity: 1.2 });
  ring.add(electrons, threads);
  group.add(drop, ring, frost);
  const lines = Array.from({ length: PAIRS }, () => ({ points: [new Vector3(), new Vector3()] }));
  let phase = 0;
  let speed = 1;
  const a = new Vector3();
  const c = new Vector3();
  const cryo: Cryostat = {
    group,
    superconducting: 1,
    ring: new Vector3(1.5, 1.6 + RING_R * 0.6, 0.6),
    drop: new Vector3(-1.6, 1.25, 0.4),
    update(dt, t) {
      const sc = cryo.superconducting;
      // a supercurrent keeps going; in the normal state it dies within a second or two
      speed = sc > 0.5 ? 1 : Math.max(speed - dt * 0.8, 0);
      phase += dt * 0.9 * speed;
      for (let k = 0; k < PAIRS; k++) {
        const ang = phase + (k / PAIRS) * Math.PI * 2;
        for (const m of [0, 1]) {
          const da = m === 0 ? -0.07 : 0.07;
          const jitter = (1 - sc) * 0.12;
          const target = m === 0 ? a : c;
          target.set(
            Math.cos(ang + da * sc) * RING_R + jitter * Math.sin(t * 7 + k * 3 + m),
            jitter * Math.cos(t * 6 + k * 2 + m * 4),
            Math.sin(ang + da * sc) * RING_R + jitter * Math.cos(t * 8 + k + m),
          );
          electrons.setPosition(2 * k + m, target.x, target.y, target.z);
        }
        lines[k]!.points[0]!.copy(a);
        lines[k]!.points[1]!.copy(c);
      }
      electrons.commit();
      threads.setLines(sc > 0.05 ? lines : []);
      threads.intensity = 1.2 * sc;
    },
  };
  return cryo;
}
