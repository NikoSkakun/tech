/** One factory per manifest step, in order. */
import type { StepFactory } from '../chapter';
import { chargeStep } from './01-charge';
import { coulombStep } from './02-coulomb';
import { fieldStep } from './03-field';
import { potentialStep } from './04-potential';
import { conductorStep } from './05-conductor';
import { staticStep } from './06-static';
import { capacitorStep } from './07-capacitor';
import { bridgeStep } from './08-bridge';

export const STEPS: readonly StepFactory[] = [
  chargeStep,
  coulombStep,
  fieldStep,
  potentialStep,
  conductorStep,
  staticStep,
  capacitorStep,
  bridgeStep,
];
