/**
 * `lab-battery` simulation models (§M1–§M8). Cell, CC/CV, pack and ageing live in `sim/core/S3-sim/battery.ts`
 * and are re-exported here.
 */
export * from '../core/S3-sim/battery';
export * from './galvanic';
export * from './bms';
export * from './thermal';
export * from './thermal-scenarios';
export * from './calculators';
