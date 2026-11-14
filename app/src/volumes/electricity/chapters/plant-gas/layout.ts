/**
 * World layout of the gas chapter — «Острів газової генерації». World units are **metres of a toy diorama**
 * (kit convention); the environment is told so with `env.setScale(…, { adaptFrom: LOOK_SCALE.diorama })`.
 *
 * Axes: +X east (right in the establishing shot, camera in the south), +Z south, Y up. The story runs left →
 * right like the document: gas comes in from the west (pipeline → gas receiving station), the combined-cycle
 * unit stands in the centre (steam turbine · generator · gas turbine on one shaft, the gas turbine's exhaust
 * blowing east into the heat-recovery boiler and its stack), then the peaker, the engine hall, the town it
 * heats and the switchyard in the east. Nothing is to real scale (the chapter carries «не в масштабі»).
 */

/** Main island: a wobbly ellipse. */
export const ISLAND = { semiX: 320, semiZ: 210, y: 2.2 } as const;

/** Ground pads (centre x, z; size w × d) — concrete yards and the town. */
export const PADS = {
  gas: { x: -210, z: -16, w: 86, d: 54 },
  plant: { x: -36, z: -8, w: 230, d: 112 },
  east: { x: 190, z: -26, w: 150, d: 110 },
  town: { x: 196, z: 92, w: 128, d: 96 },
} as const;

/** The single-shaft line, axis along X at height `axisY` above the hall floor. */
export const SHAFT = {
  z: 0,
  axisY: 3.6,
  /** Steam turbine: centre x, length. */
  st: { x: -86, length: 18 },
  /** Generator: centre x. */
  gen: { x: -64 },
  /** Gas turbine: x of the cold end (coupling, compressor inlet side) — air flows toward +X. */
  gtX: -54,
  gtLength: 13.2,
} as const;

/** Where the macro blade of step 5 floats: high over the hall, against the sky (world, platform of the blade). */
export const MACRO = { x: -60, y: 70, z: 70 } as const;

/** Main building (machine hall) around the shaft line. */
export const HALL = { x: -64, z: 0, length: 76, width: 26, height: 21 } as const;

/** Air-intake filter house on the hall roof above the compressor inlet. */
export const INTAKE = { x: -50, z: -5, y: 27 } as const;

/** Heat-recovery boiler: the hot gas runs along +X from `x0` to `x1`; three drums on the roof. */
export const HRSG = { x0: -20, x1: 34, z: 0, width: 16, height: 24 } as const;

/** Main stack at the cold end of the boiler, bypass stack between the turbine exhaust and the boiler. */
export const STACK = { x: 44, z: 0, height: 78, radius: 3.6 } as const;
export const BYPASS = { x: -24, z: 13, height: 40, radius: 2.4 } as const;

/** Air-cooled condenser behind (north of) the boiler: 2 × 3 cells with fans. */
export const ACC = { x: 14, z: -44, cols: 3, rows: 2, cell: 12, height: 15 } as const;

/** Gas receiving station in the west and the pipeline that feeds it. */
export const GAS = {
  station: { x: -206, z: -14 },
  pipeIn: [-318, -30] as const,
  /** Height of the pipeline's axis above the ground (on low supports). */
  pipeY: 1.6,
} as const;

/** Hydrogen mixer of step 9 next to the gas station. */
export const H2 = { x: -170, z: 44 } as const;

/** Gas well with a flare and the leak points on the way to the station (step 9). */
export const WELL = { x: -150, z: 44 } as const;

/** Peaker gas turbine (aeroderivative, in an enclosure) east of the stack. */
export const PEAKER = { x: 92, z: 42 } as const;

/**
 * Engine hall: 8 engines in two rows of 4, crank axes along X (so the south row is seen side-on once the south
 * wall is lifted); a stack and a radiator per engine on the roof. Engine 0 (south row, west) is the hero.
 */
export const ENGINES = { x: 166, z: -40, count: 8, pitch: 16, rowZ: 8, length: 70, width: 32, height: 12 } as const;

/** Position (x, z) of engine i: 0…3 south row west → east, 4…7 north row. */
export function enginePos(i: number): [number, number] {
  const k = i % 4;
  return [ENGINES.x + (k - 1.5) * ENGINES.pitch, ENGINES.z + (i < 4 ? ENGINES.rowZ : -ENGINES.rowZ)];
}

/** Town of step 8: 5 × 4 quarters with a container unit each; the «one big station» sits at its edge. */
export const TOWN = { x: 196, z: 92, cols: 5, rows: 4, quarter: 22 } as const;
export const BIG_STATION = { x: 278, z: 60 } as const;

/** Switchyard and the outgoing line in the east. */
export const YARD = { x: 262, z: -50 } as const;

/** Map of Ukraine floating over the island in step 10 (centre, width in metres). */
export const MAP = { x: -40, y: 100, z: 70, width: 260 } as const;
