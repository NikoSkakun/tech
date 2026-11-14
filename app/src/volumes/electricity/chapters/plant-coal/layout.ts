/**
 * World layout of the coal chapter. World units are **metres of a toy diorama** (kit convention); the
 * environment is told so with `env.setScale(…, { adaptFrom: LOOK_SCALE.diorama })`.
 *
 * Axes: +X east, +Z south, Y up. The camera mostly looks north from the south, so the technology reads left →
 * right in its real order (document, «Наскрізна візуальна ідея»): rail loop and car dumper → coal yard →
 * conveyor galleries → main building (boiler house + turbine hall) → gas path (catalyst, air heater,
 * electrostatic precipitator, induced-draft fans, desulphurisation absorber) → stack → cooling towers and
 * switchyard; ash pond and gypsum in the north-east; the city on its own islet further east.
 *
 * Nothing is to real scale (chip «не в масштабі»): the boiler house is «higher than everything but the stack».
 */

/** Main island: an ellipse stretched west–east. */
export const ISLAND = { semiX: 270, semiZ: 165, ground: 2 } as const;

/** Balloon loop of the railway around the coal yard; the car dumper straddles its south leg. */
export const RAIL = { x0: -238, x1: -96, z0: -66, z1: 96, corner: 30 } as const;
export const DUMPER = { x: -170, z: 96 } as const;

/** Coal yard: two long ridges either side of the stacker-reclaimer rail. */
export const YARD = { x: -168, z: 14, length: 104, ridgeGap: 30 } as const;

/** Crusher house where the yard belts meet; the inclined gallery climbs from it to the bunker bay. */
export const CRUSHER = { x: -82, z: 20, h: 18 } as const;

/** Main building: boiler house (tall) with the bunker bay on its west side and the turbine hall south of it. */
export const BOILER = { x: 0, z: -14, w: 44, d: 40, h: 76 } as const;
export const BUNKER = { x: -32, z: -14, w: 20, d: 36, h: 52 } as const;
export const HALL = { x: 4, z: 34, length: 86, width: 30, height: 24 } as const;

/** Gas path east of the boiler house (centre lines at `z`), in flow order. */
export const GAS = {
  z: -14,
  scr: { x: 34, y: 24 },
  airHeater: { x: 48 },
  esp: { x: 74, w: 34 },
  fan: { x: 102 },
  fgd: { x: 124, r: 10, h: 42 },
  stack: { x: 150, h: 118 },
} as const;

/** Cooling towers, switchyard, ash pond, gypsum pile, CCS plant. */
export const TOWERS: readonly (readonly [number, number])[] = [
  [196, 42],
  [214, -64],
] as const;
export const TOWER_H = 62;
export const SWITCHYARD = { x: 112, z: 104 } as const;
export const ASH_POND = { x: 70, z: -116, r: 40 } as const;
export const GYPSUM = { x: 132, z: 30 } as const;
/** Carbon capture plant by the south rim: its well goes down into the strata block hanging under the rim. */
export const CCS = { x: 66, z: 128 } as const;

/** Floating set pieces of single steps (each hangs where its step's camera looks). */
export const RIGS = {
  /** step 2: the time capsule over the hero wagon, the rank ladder beside it, the wagon field west of the island */
  capsule: { x: -130, y: 34, z: 112 },
  ladder: { x: -194, y: 8, z: 126 },
  wagonField: { x: -228, y: -6, z: 158 },
  /** step 3: the mill house (enlarged ×3) south of the bunker bay */
  mill: { x: -54, z: 66 },
  /** step 5: the pipe capsule floats south of the boiler house */
  phase: { x: -10, y: 70, z: 92 },
  /** step 7: the feed-water train laid out in a line in front of the turbine hall */
  feed: { x: -56, z: 76, length: 150 },
  /** step 9: the balance floating in front of the main building; the strata block under the south rim */
  scales: { x: -50, y: 84, z: 150 },
  strata: { x: 66, z: 168 },
  /** step 11: the map of Ukraine */
  map: { x: 6, y: 160, z: 170 },
} as const;

/** The city islet in the east and the heat mains that reach it. */
export const CITY = { x: 470, z: -150, r: 110 } as const;
