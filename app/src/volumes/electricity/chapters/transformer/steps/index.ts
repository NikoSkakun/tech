/** The 9 step factories in manifest order (`scene.ts` builds them one by one). */
import type { StepFactory } from '../chapter';
import { mutualInduction } from './01-mutual-induction';
import { turnsRatio } from './02-turns-ratio';
import { whyHighVoltage } from './03-why-high-voltage';
import { anatomy } from './04-anatomy';
import { tapChanger } from './05-tap-changer';
import { lossesEfficiency } from './06-losses-efficiency';
import { threePhaseGroups } from './07-three-phase-groups';
import { types } from './08-types';
import { voltageLadder } from './09-voltage-ladder';

export const STEPS: readonly StepFactory[] = [
  mutualInduction,
  turnsRatio,
  whyHighVoltage,
  anatomy,
  tapChanger,
  lossesEfficiency,
  threePhaseGroups,
  types,
  voltageLadder,
];
