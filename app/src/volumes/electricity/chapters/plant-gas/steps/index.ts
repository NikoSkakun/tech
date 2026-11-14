/** The step modules in document order. */
import { braytonSim } from './brayton-sim';
import { combinedCycle } from './combined-cycle';
import { emissionsHydrogen } from './emissions-hydrogen';
import { flexibility } from './flexibility';
import { gasEngines } from './gas-engines';
import { gasTurbine } from './gas-turbine';
import { hotSection } from './hot-section';
import { naturalGas } from './natural-gas';
import { overview } from './overview';
import { role } from './role';
import type { StepFactory, StepId } from './types';

export const STEPS: readonly StepFactory[] = [overview, naturalGas, gasTurbine, braytonSim, hotSection, combinedCycle, flexibility, gasEngines, emissionsHydrogen, role];

/** Ids in the same order as `STEPS` (the scene tells `hot()` which step a factory's hotspots belong to). */
export const STEP_IDS: readonly StepId[] = ['overview', 'natural-gas', 'gas-turbine', 'brayton-sim', 'hot-section', 'combined-cycle', 'flexibility', 'gas-engines', 'emissions-hydrogen', 'role'];
