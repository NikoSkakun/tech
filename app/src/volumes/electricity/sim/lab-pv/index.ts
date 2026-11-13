/**
 * `lab-pv` simulation models (§M1–§M5). The PV I-V model, MPPT and sun geometry live in `sim/core/S3-sim`
 * and are re-exported here so the chapter imports a single module.
 */
export {
  LM440,
  type PvModuleSpec,
  PvString,
  type PvStringConfig,
  type IvPoint,
  type IvAnalysis,
  analyseString,
  uniformString,
  cellTemperatureC,
  sectionParams,
  sectionVoltageV,
  sectionIrradianceFromShade,
  shadeFromShapes,
  type ShadowShape,
  halfCellLocation,
  halfCellRectMm,
  HALF_CELLS,
  HALF_CELL_COLS,
  HALF_CELL_ROWS,
  MODULE_SIZE_MM,
  hotSpots,
  type HotSpot,
  optimiserPowerW,
} from '../core/S3-sim/pv';
export {
  SampledCurve,
  poInit,
  poIterate,
  globalScan,
  type PoState,
  type ScanResult,
} from '../core/S3-sim/mppt';
export * from './light';
export * from './orientation';
export * from './array';
export * from './mppt-sim';

/** Step 6 presets: irradiance, ambient and how the cell temperature is obtained. */
export const LIGHT_HEAT_PRESETS = {
  stc: { gWm2: 1000, cellTempC: 25 },
  julyNoon: { gWm2: 1000, ambientC: 33 },
  overcast: { gWm2: 150, ambientC: 10 },
  frostyMorning: { gWm2: 700, ambientC: -15 },
} as const;
