/**
 * `inside/touch` (VISUAL.md §4.3 «Зсунути»): one zinc grain and one crumb of manganese oxide with nothing between
 * them, brought together by the reader's slider. At contact electrons hop straight across and the place of contact
 * glows orange: the reaction runs and gives only heat; nothing goes anywhere else. `near` 0 apart … 1 touching.
 */
import { DodecahedronGeometry, Group, IcosahedronGeometry, Mesh, SphereGeometry } from 'three';
import { K, col } from '@/style';
import { electrons } from './particles';
import { smooth } from '../scrub';

/** Where the pair stands in the micro frame: far above the field, out of its shots. */
export const PAIR_AT = { x: 2, y: 30, z: 0 } as const;
const ZINC_R = 1.5;
const OXIDE_R = 1.2;
const HOPS = 10;

export interface Pair {
  group: Group;
  near: number;
  /** 0 … 1: how hot the contact has become (it builds while touching, fades apart). */
  readonly heat: number;
  /** The two pieces (their positions are in the pair's frame, which sits at `PAIR_AT`). */
  readonly zinc: Mesh;
  readonly oxide: Mesh;
  update(dt: number, t: number): void;
}

export function createPair(): Pair {
  const group = new Group();
  group.position.set(PAIR_AT.x, PAIR_AT.y, PAIR_AT.z);
  const zincMat = K.metal({ color: 'white', emissive: 'mist', emissiveIntensity: 0.32 });
  const zinc = new Mesh(new IcosahedronGeometry(ZINC_R, 4), zincMat);
  const mist = col('mist');
  const orange = col('orange');
  const oxide = new Mesh(
    new DodecahedronGeometry(OXIDE_R, 0),
    K.toon({ color: 'ink', emissive: 'slate', emissiveIntensity: 0.2, flatShading: true }),
  );
  const glowMat = K.glow({ color: 'orange', intensity: 0, additive: true, whiten: 0.2 });
  const glow = new Mesh(new SphereGeometry(0.9, 24, 12), glowMat);
  group.add(zinc, oxide, glow);
  const hops = electrons(group, HOPS, 0.09);
  let heat = 0;
  const pair: Pair = {
    group,
    near: 0,
    zinc,
    oxide,
    get heat() {
      return heat;
    },
    update(dt, t) {
      const gap = 3.2 * (1 - smooth(0, 1, pair.near));
      zinc.position.x = -(ZINC_R + gap / 2) + 0.1;
      oxide.position.x = OXIDE_R + gap / 2 - 0.1;
      const contact = smooth(0.9, 1, pair.near);
      heat += ((contact > 0.5 ? 1 : 0) - heat) * Math.min(1, dt * (contact > 0.5 ? 0.6 : 1.5));
      const cx = zinc.position.x + ZINC_R;
      glow.position.set(cx, 0, 1.4);
      glow.scale.setScalar(0.6 + heat * 1.2);
      glowMat.intensity = 1.4 * heat;
      zincMat.emissive.copy(mist).lerp(orange, 0.8 * heat);
      zincMat.emissiveIntensity = 0.32 + 0.5 * heat;
      zinc.rotation.y = t * 0.05;
      oxide.rotation.set(0.3, t * 0.04, 0.2);
      // electrons hop from the zinc into the oxide over the contact, one after another
      for (let i = 0; i < HOPS; i++) {
        const k = (t * 1.3 + i / HOPS) % 1;
        const a = (i / HOPS) * Math.PI * 2;
        const x = cx - 0.6 + k * 1.2;
        hops.put(i, x, Math.sin(a) * 0.35 * (1 - Math.abs(k - 0.5)), 0.5 + Math.cos(a) * 0.2, contact);
      }
      hops.commit();
    },
  };
  return pair;
}
