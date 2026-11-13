/**
 * Scoops — the three "scoops" of the electron balance (chapter document, step 5: «три кнопки-„совки“»): a
 * small, a medium and a large brass cup brimming with electrons, hanging over the right pan. A scoop tips
 * toward the pan when its amount is poured (`tip(i)`); the dock buttons and a tap on the scoop do the same.
 * Built with the kit `Builder`: one part per scoop (it moves), base at the rim's pivot.
 */
import { Builder, type KitModel } from '@/kit';

/** Rim radius of each scoop — the eye reads them as 1 : 100 : 1000 only by order, not by volume. */
export const SCOOP_RADIUS = [0.26, 0.42, 0.62] as const;

export interface Scoops {
  model: KitModel;
  /** The scoop's own group (pick target, anchor for the pour): x = centre of the brim. */
  cups: readonly KitModel['group'][];
  /** Start the pouring motion of scoop `i`. */
  tip(i: number): void;
  update(dt: number, t: number): void;
}

/** Seconds of one pour: swing over, hold, swing back. */
const POUR = 0.85;

export function createScoops(positions: readonly (readonly [number, number, number])[]): Scoops {
  const b = new Builder('scoops');
  const cups = positions.map((at, i) => {
    const r = SCOOP_RADIUS[i]!;
    const cup = b.part(`scoop${i}`, { at: [at[0], at[1], at[2]] });
    // bowl: a deep rounded cup with a rolled rim (lathe, open top), hanging by its rim from the pivot
    cup.lathe(
      [
        [0, -1.35 * r],
        [0.55 * r, -1.28 * r],
        [0.9 * r, -0.95 * r],
        [1.02 * r, -0.3 * r],
        [1.08 * r, 0],
        [1.0 * r, 0.04],
        [0.94 * r, -0.28 * r],
        [0.82 * r, -0.9 * r],
        [0.5 * r, -1.2 * r],
        [0, -1.26 * r],
      ],
      { seg: 36, slot: 'metal', c: ['orange.dark', 'amber'] },
    );
    // the electrons inside: a glowing surface just under the brim
    cup.cyl(0.93 * r, 0.03, { seg: 28, slot: 'glow', c: 'cyan', at: [0, -0.2 * r, 0], bevel: 0 });
    // handle: a short bar to the right with a ball end
    cup.rod([1.02 * r, -0.1 * r, 0], [1.02 * r + 0.55 + 0.4 * r, 0.12, 0], 0.045 + 0.03 * r, {
      seg: 10,
      slot: 'metal',
      c: 'mist',
    });
    cup.sphere(0.09 + 0.05 * r, {
      seg: 14,
      slot: 'toon',
      c: 'cyan.dark',
      at: [1.02 * r + 0.6 + 0.4 * r, 0.14, 0],
    });
    cup.anchor('brim', -r, 0, 0);
    return cup;
  });
  const model = b.build();
  const groups = cups.map((_, i) => model.parts[`scoop${i}`]!);
  // time since the pour of each scoop began (≥ POUR = at rest)
  const age = groups.map(() => POUR);
  return {
    model,
    cups: groups,
    tip(i) {
      age[i] = 0;
    },
    update(dt, t) {
      groups.forEach((g, i) => {
        age[i] = Math.min(age[i]! + dt, POUR);
        const k = age[i]! / POUR;
        // tip toward −X (the pan's centre side) and come back; idle: a slow sway on the "hook"
        const pour = Math.sin(Math.PI * Math.min(k * 1.25, 1)) ** 0.8;
        g.rotation.z = 1.75 * pour + 0.05 * Math.sin(t * 1.1 + i * 2.1) * (1 - pour);
        g.position.y = positions[i]![1] + 0.05 * Math.sin(t * 0.9 + i * 1.7);
      });
    },
  };
}
