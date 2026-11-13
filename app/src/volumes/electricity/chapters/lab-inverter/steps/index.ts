/** The 12 step factories in manifest order (`scene.ts` builds them one by one). */
import type { StepFactory } from '../chapter';
import { whyInverter } from './01-why-inverter';
import { switches } from './02-switches';
import { hBridge } from './03-h-bridge';
import { pwm } from './04-pwm';
import { lcFilter } from './05-lc-filter';
import { dcLink } from './06-dc-link';
import { mpptController } from './07-mppt-controller';
import { gridTie } from './08-grid-tie';
import { inverterTypes } from './09-inverter-types';
import { ups } from './10-ups';
import { threePhaseStep } from './11-three-phase-and-scale';
import { choosing } from './12-choosing';

export const STEPS: readonly StepFactory[] = [
  whyInverter,
  switches,
  hBridge,
  pwm,
  lcFilter,
  dcLink,
  mpptController,
  gridTie,
  inverterTypes,
  ups,
  threePhaseStep,
  choosing,
];
