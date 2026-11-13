/** `generator-ac` chapter simulation models (S1-sim). See README.md. */
export * from './ac-basics';
export * from './war-of-currents';
export * from './three-phase';
export * from './machines';
export * from './synchronization';
export * from './rlc-power';
// Г1 time-domain coil (hand crank mode etc.) — shared with magnetism М8
export { createRotatingCoil, rotatingCoilReadouts, type RotatingCoilModel, type RotatingCoilParams } from '../core/S1-sim/rotating-coil';
export { seriesRlc, type SeriesRlcResult } from '../core/S1-sim/phasor';
export { threePhase, rmsToPeak, peakToRms, scopeWindowS } from '../core/S1-sim/waveform';
