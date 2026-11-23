/**
 * The samples and processes the chapters use: a block of ice in a small box, the water it melts into, the roads
 * «ice at −20 °C → water at +20 °C» and «water at +20 °C → all of it steam».
 */
import { addAll, CELL_H, CELL_W, iceSheet, type Placed } from './lattice';
import { mulberry, WaterMd } from './md';
import { Process } from './process';
import { fromCelsius, heated, heatTo, T_BOIL } from './scale';

/** Cells of the ice block (two molecules each). */
export const COLS = 14;
export const ROWS = 9;
export const MOLECULES = 2 * COLS * ROWS;
/** Inner width of the box: the block with half a bond of room at each wall. */
export const BOX_W = (COLS - 0.5) * CELL_W + 1.1;
/** Height of the block and of the box above it. */
export const BLOCK_H = ROWS * CELL_H;
export const BOX_H = 30;
/** Pull toward the floor: keeps the water on the bottom of the box (see `md.ts`). */
export const GRAVITY = 0.004;
/** Pull of the floor and the side walls on a molecule, in bond energies (`MdConfig.adhesion`). */
export const ADHESION = 0;
/** Relaxation time of the heat bath, time units. */
const TAU = 1.5;

/** An empty box with the volume's standard molecule. */
export function box(height = BOX_H): WaterMd {
  return new WaterMd({ capacity: MOLECULES, width: BOX_W, height, gravity: GRAVITY, adhesion: ADHESION });
}

/** A block of ice on the floor of the box, trembling at `celsius` (< 0). */
export function iceSample(celsius = -20, seed = 7): WaterMd {
  const md = box();
  // half a bond of room at the floor and at each wall
  addAll(md, iceSheet(COLS, ROWS, mulberry(seed), [0.55, 0.55]));
  md.thermalise(fromCelsius(celsius) / 2, seed + 1); // half goes into the springs of the lattice at once
  md.heating = { mode: 'bath', temperature: fromCelsius(celsius), tau: TAU };
  return md;
}

/** Water from a kept state (`fixtures/liquid.json`: the end of the melting road, +20 °C). */
export function liquidSample(state: readonly Placed[], celsius = 20, seed = 11, height = BOX_H): WaterMd {
  const md = box(height);
  addAll(md, state);
  md.thermalise(fromCelsius(celsius), seed);
  md.heating = { mode: 'bath', temperature: fromCelsius(celsius), tau: TAU };
  return md;
}

/** Joules per gram along the melting road: ice at −20 °C … water at +20 °C. */
export const MELT_HEAT = heatTo(20);
/** Simulated time the whole melting road takes. */
const MELT_PACE = 280;

/** Model temperature on the melting road at s: the thermometer's reading, spread over the model's melting range. */
export function meltTemperature(s: number): number {
  const state = heated(s * MELT_HEAT);
  return fromCelsius(state.celsius, state.liquid);
}

/** The road «ice at −20 °C → water at +20 °C» (s = share of the heat `MELT_HEAT` received). */
export function meltProcess(seed = 7): Process {
  return new Process({
    md: iceSample(-20, seed),
    conditions: (md, s) => (md.heating = { mode: 'bath', temperature: meltTemperature(s), tau: TAU }),
    temperature: meltTemperature,
    pace: () => MELT_PACE,
  });
}

/** Joules per gram along the boiling road: water at +20 °C … the last of it gone as steam at 100 °C. */
export const BOIL_HEAT = heatTo(100, 1) - heatTo(20);
const BOIL_PACE = 340;
/** Height of the open box on the boiling road: a molecule that rises above it has left as steam. */
const BOIL_H = 19;
/** Height above the floor up to which the hot plate heats the sample. */
const PLATE = 3;

/** The thermometer on the boiling road at s. */
export function boilState(s: number): ReturnType<typeof heated> {
  return heated(heatTo(20) + s * BOIL_HEAT);
}

/**
 * The road «water at +20 °C → steam». Up to 100 °C the whole sample warms; then the plate under it is held hotter
 * than the boiling point, by as much as the sample lags behind the share of steam the thermometer's model expects —
 * molecules leave through the open top, and the road ends when the box is empty.
 */
export function boilProcess(state: readonly Placed[], seed = 11): Process {
  const md = liquidSample(state, 20, seed, BOIL_H);
  md.lid = { mode: 'open' };
  const temperature = (s: number): number => {
    const st = boilState(s);
    return st.celsius < 100 ? fromCelsius(st.celsius) : T_BOIL;
  };
  return new Process({
    md,
    conditions: (m, s) => {
      const st = boilState(s);
      if (st.celsius < 100) {
        m.heating = { mode: 'bath', temperature: fromCelsius(st.celsius), tau: TAU };
        return;
      }
      const gone = 1 - m.living / MOLECULES;
      const lag = Math.max(0, st.steam - gone);
      m.heating = { mode: 'bath', temperature: T_BOIL * (1.25 + 6 * lag), tau: TAU, below: PLATE };
    },
    temperature,
    pace: () => BOIL_PACE,
  });
}
