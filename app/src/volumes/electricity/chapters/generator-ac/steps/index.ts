/** The 11 step factories in manifest order (`scene.ts` builds them one by one). */
import type { StepFactory } from '../chapter';
import { rotatingLoop1 } from './01-rotating-loop';
import { acAnatomy } from './02-ac-anatomy';
import { warOfCurrentsStep } from './03-war-of-currents';
import { threePhaseStep } from './04-three-phase';
import { starDelta } from './05-star-delta';
import { rotatingField } from './06-rotating-field';
import { synchronousGenerator } from './07-synchronous-generator';
import { synchronization } from './08-synchronization';
import { rlc } from './09-rlc';
import { acPower } from './10-ac-power';
import { toTransformer } from './11-to-transformer';

export const STEPS: readonly StepFactory[] = [
  rotatingLoop1,
  acAnatomy,
  warOfCurrentsStep,
  threePhaseStep,
  starDelta,
  rotatingField,
  synchronousGenerator,
  synchronization,
  rlc,
  acPower,
  toTransformer,
];
