/** The 12 steps in manifest order. Each entry is a `StepFactory` (see `../lab.ts`). */
import type { StepFactory } from '../lab';
import { whatIsBattery } from './01-what-is-battery';
import { cellAnatomy } from './02-cell-anatomy';
import { intercalation } from './03-intercalation';
import { whyLithium } from './04-why-lithium';
import { chemistries } from './05-chemistries';
import { voltageCapacity } from './06-voltage-capacity';
import { charging } from './07-charging';
import { pack } from './08-pack';
import { bms } from './09-bms';
import { degradation } from './10-degradation';
import { safety } from './11-safety';
import { scaleAndFuture } from './12-scale-and-future';

export const STEPS: readonly StepFactory[] = [
  whatIsBattery,
  cellAnatomy,
  intercalation,
  whyLithium,
  chemistries,
  voltageCapacity,
  charging,
  pack,
  bms,
  degradation,
  safety,
  scaleAndFuture,
];
