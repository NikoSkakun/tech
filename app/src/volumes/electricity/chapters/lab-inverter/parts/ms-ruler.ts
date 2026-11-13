/**
 * Step 10: the big time ruler «0…40 ms» along the front of the shelf. A glowing wall stands at the hold-up
 * time of the PC supply (the barrier the switch-over has to beat); one marker per UPS sits at its transfer
 * time in the UPS's colour and turns red once it is past the wall. Pure builder; `set` places everything.
 * Local space: lies on the bench, origin in the middle of the strip, +X = later.
 */
import { BoxGeometry, ConeGeometry, Group, Mesh, Vector3 } from 'three';
import { Builder } from '@/kit';
import { fmtUnit } from '@/content';
import { K, type ColorToken, type KGlowMaterial } from '@/style';
import { tag } from '../world';

export const RULER = { length: 9.4, maxS: 0.04 } as const;
/** X of a time on the ruler (clamped to its ends). */
export const rulerX = (s: number): number =>
  -RULER.length / 2 + (Math.min(Math.max(s, 0), RULER.maxS) / RULER.maxS) * RULER.length;

export interface MsRuler {
  group: Group;
  /** Hold-up time (s) and the transfer time of each UPS (s); markers past the wall turn red. */
  set(holdS: number, transfers: readonly number[]): void;
  /** Top of the barrier (local) for its callout. */
  barrierTop: Vector3;
}

export function createMsRuler(accents: readonly ColorToken[]): MsRuler {
  const b = new Builder('ms-ruler');
  b.box(RULER.length + 0.3, 0.05, 0.42, { r: 0.04, slot: 'gloss', c: ['ink', 'slate'] });
  const group = new Group();
  group.name = 'ms-ruler';
  for (let ms = 0; ms <= 40; ms += 5) {
    const x = rulerX(ms / 1000);
    const major = ms % 10 === 0;
    b.box(0.03, 0.02, major ? 0.3 : 0.16, {
      r: 0,
      slot: 'glow',
      c: 'mist',
      at: [x, 0.05, major ? 0 : -0.07],
    });
    if (major) {
      const t = tag(fmtUnit(ms, 'ms', { digits: 0 }), 18, 'mist', 'mono');
      t.position.set(x, 0.08, 0.38);
      group.add(t);
    }
  }
  group.add(b.build().group);

  // the barrier: a translucent-looking glowing wall at the hold-up time
  const wallMat = K.glow({ color: 'sky', intensity: 1.2, whiten: 0.1, keepHue: true, falloff: 0 });
  const wall = new Mesh(new BoxGeometry(0.06, 0.7, 0.5).translate(0, 0.35, 0), wallMat);
  group.add(wall);
  const markers = accents.map((c, i) => {
    const mat: KGlowMaterial = K.glow({ color: c, intensity: 1.5, whiten: 0.1, keepHue: true, falloff: 0 });
    const m = new Mesh(new ConeGeometry(0.11, 0.26, 18).rotateX(Math.PI), mat);
    m.position.set(0, 0.2 + i * 0.001, -0.12 + i * 0.12);
    group.add(m);
    return { m, mat, c };
  });
  const barrierTop = new Vector3(0, 0.75, 0);
  return {
    group,
    barrierTop,
    set(holdS, transfers) {
      wall.position.x = rulerX(holdS);
      barrierTop.x = wall.position.x;
      transfers.forEach((s, i) => {
        const k = markers[i];
        if (!k) return;
        k.m.position.x = rulerX(s);
        k.mat.setColor(s > holdS ? 'red' : k.c);
      });
    },
  };
}
