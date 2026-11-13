/** The eleven steps in manifest order. */
import { betz } from './betz';
import { blade } from './blade';
import { capacityFactor } from './capacity-factor';
import { drivetrain } from './drivetrain';
import { nacelle } from './nacelle';
import { offshore } from './offshore';
import { overview } from './overview';
import { powerCurve } from './power-curve';
import { role } from './role';
import type { StepFactory } from './types';
import { windFarm } from './wind-farm';
import { windPower } from './wind-power';

export const STEPS: readonly StepFactory[] = [
  overview,
  windPower,
  betz,
  blade,
  nacelle,
  drivetrain,
  powerCurve,
  windFarm,
  capacityFactor,
  offshore,
  role,
];
