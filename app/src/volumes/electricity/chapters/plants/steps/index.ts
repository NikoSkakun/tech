/** The 11 step factories in manifest order (`scene.ts` builds them one by one). */
import type { StepFactory } from '../chapter';
import { intro } from './01-intro';
import { turbineGenerator } from './02-turbine-generator';
import { energyChains } from './03-energy-chains';
import { heatEngine } from './04-heat-engine';
import { rankineStep } from './05-rankine';
import { brayton } from './06-brayton';
import { steamIsland } from './07-steam-island';
import { metrics } from './08-metrics';
import { flexibility } from './09-flexibility';
import { mix } from './10-mix';
import { gallery } from './11-gallery';

export const STEPS: readonly StepFactory[] = [
  intro,
  turbineGenerator,
  energyChains,
  heatEngine,
  rankineStep,
  brayton,
  steamIsland,
  metrics,
  flexibility,
  mix,
  gallery,
];
