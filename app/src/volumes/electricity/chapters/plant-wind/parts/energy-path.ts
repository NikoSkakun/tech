/**
 * Step 5 «Шлях енергії»: energy motes run the drive train from the hub to the cable in the tower while the
 * units are revealed one after another (`revealed` counts them — the step shows an efficiency callout per
 * revealed unit and, after the last one, the product «разом ≈ 90–93 %»).
 * Efficiencies are the simulation's `DRIVETRAIN_EFFICIENCY` (η_dt = 0.93 of the power-curve model M4).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext, TweenScope } from '@/engine/api';
import { fmtPercent } from '@/content';
import { createFlow, type Flow } from '@/fx';
import { DRIVETRAIN_EFFICIENCY } from '@electricity/sim/plant-wind';

/** Units on the path, in the order the energy passes them: anchor name in the machine room and its label. */
export const PATH_UNITS: readonly { anchor: string; label: string }[] = (
  [
    ['gearboxA', DRIVETRAIN_EFFICIENCY.gearbox],
    ['generatorA', DRIVETRAIN_EFFICIENCY.generator],
    ['converter', DRIVETRAIN_EFFICIENCY.converter],
    ['transformer', DRIVETRAIN_EFFICIENCY.transformer],
  ] as const
).map(([anchor, eta]) => ({ anchor, label: `η ≈ ${fmtPercent(eta)}` }));

export interface EnergyPath {
  group: Group;
  flow: Flow;
  /** How many units of `PATH_UNITS` have been reached (`PATH_UNITS.length + 1` = the total is shown too). */
  readonly revealed: number;
  /** Play the walk-through on `scope` (the step's scope: leaving the step cancels what is still pending). */
  play(scope: TweenScope): void;
  reset(): void;
}

export function buildEnergyPath(ctx: ChapterContext, k: number): EnergyPath {
  const group = new Group();
  group.name = 'energy-path';
  const p = (x: number, y: number, z: number): Vector3 => new Vector3(x * k, y * k, z * k);
  // through the shafts, into the generator, across to the converter, the transformer, down the tower
  const path = [p(0, 0, 5.4), p(0, 0, 2.8), p(0, 0, 0.3), p(0, 0, -1.6), p(0.2, 0.3, -3.4), p(0.2, 0.3, -5.6), p(1.0, 0.9, -7.0), p(1.5, 0.6, -7.9), p(0, 0.9, -8.5), p(-1.25, 0.9, -8.2), p(-1.25, -1.7, -8.2), p(-0.4, -2.3, -4), p(0, -2.6, 0), p(0, -9, 0)];
  const flow = createFlow(ctx, { kind: 'pulse', paths: path, count: 30, radius: 0.16 * k, speed: 2.2 * k, spread: 0, endFade: 0.06 });
  flow.density = 0;
  group.add(flow);
  let revealed = 0;
  let run = 0; // a newer play / reset turns the callbacks of an older walk-through into no-ops
  return {
    group,
    flow,
    get revealed() {
      return revealed;
    },
    reset() {
      run++;
      flow.density = 0;
      revealed = 0;
    },
    play(scope) {
      const mine = ++run;
      flow.density = 0;
      revealed = 0;
      scope.value(0, 1, { duration: 0.8 }, (x) => {
        if (mine === run) flow.density = x;
      });
      for (let i = 0; i <= PATH_UNITS.length; i++)
        scope.delay(1.0 + i * 0.9, () => {
          if (mine === run) revealed = i + 1;
        });
    },
  };
}
