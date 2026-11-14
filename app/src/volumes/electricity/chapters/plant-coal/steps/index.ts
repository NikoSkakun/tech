/** The eleven steps in manifest order. */
import { ashCo2 } from './ash-co2';
import { boiler } from './boiler';
import { chpFlex } from './chp-flex';
import { coal } from './coal';
import { coalToDust } from './coal-to-dust';
import { feedwater } from './feedwater';
import { flueGas } from './flue-gas';
import { overview } from './overview';
import { roleUkraine } from './role-ukraine';
import { steamParams } from './steam-params';
import { turbine } from './turbine';
import type { StepFactory } from './types';

export const STEPS: readonly StepFactory[] = [
  overview,
  coal,
  coalToDust,
  boiler,
  steamParams,
  turbine,
  feedwater,
  flueGas,
  ashCo2,
  chpFlex,
  roleUkraine,
];
