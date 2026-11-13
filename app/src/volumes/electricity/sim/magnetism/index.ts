/** `magnetism` chapter simulation models (S1-sim). See README.md. */
export * from './magnets';
export * from './domains';
export * from './wire-solenoid';
export * from './dc-motor';
export * from './induction';
export * from './eddy';
export * from './rl-circuit';
export * from './maxwell';
// М8 (step `to-generator`) — shared with generator-ac Г1
export { createRotatingCoil, rotatingCoilReadouts, ROTATING_COIL_DEFAULTS, type RotatingCoilModel, type RotatingCoilParams, type RotatingCoilState } from '../core/S1-sim/rotating-coil';
