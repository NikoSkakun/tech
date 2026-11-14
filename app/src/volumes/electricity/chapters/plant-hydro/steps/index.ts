/** The chapter's steps in document order. */
import { dams } from './dams';
import { generatorGovernor } from './generator-governor';
import { overview } from './overview';
import { pumpedStorage } from './pumped-storage';
import { reservoirEnvironment } from './reservoir-environment';
import { roleUkraine } from './role-ukraine';
import { turbines } from './turbines';
import type { StepFactory } from './types';
import { waterEnergy } from './water-energy';
import { waterPath } from './water-path';

export const STEPS: readonly StepFactory[] = [
  overview,
  waterEnergy,
  dams,
  waterPath,
  turbines,
  generatorGovernor,
  reservoirEnvironment,
  pumpedStorage,
  roleUkraine,
];
