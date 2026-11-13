/**
 * Step 5 «Шлях енергії»: energy motes run the drive train from the hub to the cable in the tower, and above
 * every unit its efficiency pops up; the last badge is the product («разом ≈ 90–93 %»).
 * Efficiencies are the simulation's `DRIVETRAIN_EFFICIENCY` (η_dt = 0.93 of the power-curve model M4).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext, TweenScope } from '@/engine/api';
import { fmtPercent } from '@/content';
import { createFlow, type Flow } from '@/fx';
import { DRIVETRAIN_EFFICIENCY } from '@electricity/sim/plant-wind';
import type { Text3D } from '@/text';
import { createBadge } from './badge';
import type { Nacelle } from './nacelle';

export interface EnergyPath {
  group: Group;
  flow: Flow;
  /** Play the walk-through: motes appear, badges pop up unit by unit. `instant` shows the final picture. */
  play(scope: TweenScope, instant?: boolean): void;
  reset(): void;
}

export function buildEnergyPath(ctx: ChapterContext, room: Nacelle, k: number, total: string): EnergyPath {
  const group = new Group();
  group.name = 'energy-path';
  const p = (x: number, y: number, z: number): Vector3 => new Vector3(x * k, y * k, z * k);
  // through the shafts, into the generator, across to the converter, the transformer, down the tower
  const path = [p(0, 0, 5.4), p(0, 0, 2.8), p(0, 0, 0.3), p(0, 0, -1.6), p(0.2, 0.3, -3.4), p(0.2, 0.3, -5.6), p(1.0, 0.9, -7.0), p(1.5, 0.6, -7.9), p(0, 0.9, -8.5), p(-1.25, 0.9, -8.2), p(-1.25, -1.7, -8.2), p(-0.4, -2.3, -4), p(0, -2.6, 0), p(0, -9, 0)];
  const flow = createFlow(ctx, { kind: 'pulse', paths: path, count: 30, radius: 0.16 * k, speed: 2.2 * k, spread: 0, endFade: 0.06 });
  flow.density = 0;
  group.add(flow);
  const eta = DRIVETRAIN_EFFICIENCY;
  const spots: [string, string][] = [
    ['gearboxA', `η ≈ ${fmtPercent(eta.gearbox)}`],
    ['generatorA', `η ≈ ${fmtPercent(eta.generator)}`],
    ['converter', `η ≈ ${fmtPercent(eta.converter)}`],
    ['transformer', `η ≈ ${fmtPercent(eta.transformer)}`],
  ];
  const badges: Text3D[] = spots.map(([anchor, text]) => {
    const badge = createBadge(text, 'yellow');
    badge.position.y = 0.55;
    room.at(anchor).add(badge);
    return badge;
  });
  const sum = createBadge(total, 'green', 24);
  sum.position.copy(p(0, 4.4, -3.4));
  group.add(sum);
  badges.push(sum);
  const hide = (): void => {
    flow.density = 0;
    for (const b of badges) b.fade = 0;
  };
  hide();
  return {
    group,
    flow,
    reset: hide,
    play(scope, instant = false) {
      hide();
      if (instant) {
        flow.density = 1;
        for (const b of badges) b.fade = 1;
        return;
      }
      scope.to(flow, { density: 1 }, { duration: 0.8 });
      badges.forEach((b, i) => scope.to(b, { fade: 1 }, { duration: 0.35, delay: 1.0 + i * 0.9, ease: 'back.out' }));
    },
  };
}
