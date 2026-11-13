/** One factory per manifest step, in order. */
import type { StepFactory } from '../chapter';
import { latticeStep } from './01-lattice';
import { seaStep } from './02-electron-sea';
import { bandsStep } from './03-bands';
import { insulatorsStep } from './04-insulators';
import { resistanceStep } from './05-resistance';
import { siliconStep } from './06-silicon';
import { dopingStep } from './07-doping';
import { pnStep } from './08-pn-junction';
import { devicesStep } from './09-devices';

export const STEPS: readonly StepFactory[] = [
  latticeStep,
  seaStep,
  bandsStep,
  insulatorsStep,
  resistanceStep,
  siliconStep,
  dopingStep,
  pnStep,
  devicesStep,
];
