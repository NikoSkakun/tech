import type { StepFactory } from '../chapter';
import { magnetFieldStep } from './01-magnet-field';
import { domainsStep } from './02-domains';
import { oerstedStep } from './03-oersted';
import { solenoidStep } from './04-solenoid';
import { lorentzStep } from './05-lorentz';
import { dcMotorStep } from './06-dc-motor';
import { inductionStep } from './07-induction';
import { lenzStep } from './08-lenz';
import { inductanceStep } from './09-inductance';
import { maxwellStep } from './10-maxwell';
import { toGeneratorStep } from './11-to-generator';

/** The eleven steps in manifest order. */
export const STEPS: readonly StepFactory[] = [
  magnetFieldStep,
  domainsStep,
  oerstedStep,
  solenoidStep,
  lorentzStep,
  dcMotorStep,
  inductionStep,
  lenzStep,
  inductanceStep,
  maxwellStep,
  toGeneratorStep,
];
