import type { StepFactory } from '../chapter';
import { currentStep } from './01-current';
import { driftStep } from './02-drift';
import { sourceEmfStep } from './03-source-emf';
import { ohmStep } from './04-ohm';
import { circuitStep } from './05-circuit';
import { powerStep } from './06-power';
import { seriesParallelStep } from './07-series-parallel';
import { lossesStep } from './08-losses';
import { measureStep } from './09-measure';
import { dcAcStep } from './10-dc-ac';

/** The ten steps in manifest order. */
export const STEPS: readonly StepFactory[] = [
  currentStep,
  driftStep,
  sourceEmfStep,
  ohmStep,
  circuitStep,
  powerStep,
  seriesParallelStep,
  lossesStep,
  measureStep,
  dcAcStep,
];
