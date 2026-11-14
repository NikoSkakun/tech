/**
 * The «inner» sets deep below the island (`layout.ts` → `SETS`): one group per set, positioned at its centre.
 * Step modules build their own content into these groups; this file only creates them and the shared
 * «inner space» dressing (a field of drifting motes around the micro-world sets).
 */
import { Group } from 'three';
import type { ChapterContext } from '@/engine/api';
import { boxEmitter, createParticles } from '@/fx';
import { SETS, type SetId } from '../layout';

export interface Inner {
  sets: Record<SetId, Group>;
}

export function buildInner(ctx: ChapterContext): Inner {
  const sets = {} as Record<SetId, Group>;
  for (const id of Object.keys(SETS) as SetId[]) {
    const g = new Group();
    g.name = `set-${id}`;
    g.position.set(...SETS[id]);
    ctx.root.add(g);
    sets[id] = g;
  }
  // inner space of the micro-world (steps 2–4): slow motes in a box around the three sets
  for (const id of ['fission', 'sandbox', 'control'] as const) {
    const motes = createParticles(ctx, {
      count: 260,
      emitter: boxEmitter([220, 120, 160]),
      sprite: 'soft',
      color: ['violet.light', 'sky.light'],
      life: [6, 10],
      speed: [0.2, 0.8],
      size: [0.15, 0.5, 0.1],
      opacity: 0.5,
      turbulence: { amplitude: 1.5, frequency: 0.2, speed: 0.3 },
    });
    motes.position.set(0, 0, -40);
    sets[id].add(motes);
  }
  return { sets };
}
