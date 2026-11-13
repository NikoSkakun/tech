import type { StepFactory } from '../chapter';
import { sunlight } from './01-sunlight';
import { pvEffect } from './02-pv-effect';
import { cell } from './03-cell';
import { moduleStep } from './04-module';
import { ivCurve } from './05-iv-curve';
import { lightAndHeat } from './06-light-and-heat';
import { shading } from './07-shading';
import { orientation } from './08-orientation';
import { arrayStep } from './09-array';
import { mppt } from './10-mppt';
import { lifecycle } from './11-lifecycle';

/** The 11 steps in manifest order (ids must equal the generated manifest; `stage.validate` checks it). */
export const STEPS: readonly StepFactory[] = [
  sunlight,
  pvEffect,
  cell,
  moduleStep,
  ivCurve,
  lightAndHeat,
  shading,
  orientation,
  arrayStep,
  mppt,
  lifecycle,
];
