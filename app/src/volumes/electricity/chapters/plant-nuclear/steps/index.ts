/** The twelve steps in manifest order. */
import { chainReaction } from './chain-reaction';
import { control } from './control';
import { fission } from './fission';
import { fuelCycle } from './fuel-cycle';
import { fuel } from './fuel';
import { overview } from './overview';
import { primaryLoop } from './primary-loop';
import { reactor } from './reactor';
import { reactorSim } from './reactor-sim';
import { reactorTypes } from './reactor-types';
import { roleUkraine } from './role-ukraine';
import { safety } from './safety';
import type { StepFactory } from './types';

export const STEPS: readonly StepFactory[] = [
  overview,
  fission,
  chainReaction,
  control,
  fuel,
  reactor,
  primaryLoop,
  reactorSim,
  safety,
  reactorTypes,
  fuelCycle,
  roleUkraine,
];
