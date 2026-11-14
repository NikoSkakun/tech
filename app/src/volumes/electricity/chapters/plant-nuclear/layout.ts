/**
 * World layout of the nuclear chapter. World units are **metres** (kit convention); the environment is told
 * so with `env.setScale(ISLAND.radius, { adaptFrom: LOOK_SCALE.diorama })`.
 *
 * Axes: +X east, +Z south (toward the overview camera), Y up. The island carries one VVER-1000 unit: the
 * containment at the centre-west, the turbine hall east of it (steam lines run straight through the wall),
 * cooling towers to the north, spray ponds to the south, the 750 kV switchyard in the east.
 *
 * The buildings are compressed toy-like (chip «не в масштабі»); what stands inside the containment — vessel,
 * loops, steam generators, pressurizer — keeps its real size in metres, so the vessel reads «as big as a room».
 *
 * The «inner» sets (micro-world, fuel, control room, safety exhibit, reactor gallery, fuel-cycle belt) float
 * deep below the island (`DEEP`): the camera dives down to them — the document's journey «inward and down» —
 * and no island shot looks that far down, no set shot looks up at the island.
 */
type V3 = readonly [number, number, number];

export const ISLAND = { radius: 250, seed: 11 } as const;

/** Containment: cylinder + dome (toy: real ≈ 45 m × 66 m). Centre of the floor = the reactor axis. */
export const CONTAINMENT = { x: -24, z: 0, radius: 22, wall: 40, dome: 16, base: 2 } as const;

/** Reactor vessel inside the containment (real size): bottom, height, outer radius. */
export const RPV = { y: 3, height: 11, radius: 2.27, coreBottom: 4.2, coreHeight: 3.5, coreRadius: 1.6 } as const;

/** Four primary loops around the vessel: azimuth of each loop (radians) and the steam-generator radius. */
export const LOOPS = { azimuths: [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75], sgRadius: 13.5, y: 6.5 } as const;

export const TURBINE_HALL = { x: 62, z: 0, length: 96, width: 36, height: 28 } as const;
export const TOWERS: readonly V3[] = [[-90, 0, -138], [44, 0, -150]];
export const TOWER_HEIGHT = 104;
export const PONDS: readonly V3[] = [[-92, 0, 98], [-12, 0, 112]];
export const POND_SIZE = { x: 64, z: 34 } as const;
export const SWITCHYARD = { x: 170, z: 34, ry: Math.PI / 2 } as const;
export const BLOCK_TRANSFORMER: V3 = [124, 0, 30];
export const DIESELS: readonly V3[] = [[-92, 0, 30], [-92, 0, 48], [-92, 0, 12]];
export const DRY_STORAGE = { x: -150, z: -30, rows: 2, perRow: 7, spacing: 7.5 } as const;
export const VENT_STACK: V3 = [-24, 0, -44];
export const LINE_TOWERS: readonly (readonly [number, number])[] = [[214, 60], [236, 120]];

/** Depth of the inner sets below the island and the centre of each set (all at y = DEEP). */
export const DEEP = -2600;
const deep = (x: number): V3 => [x, DEEP, 0];
export const SETS = {
  fission: deep(0),
  sandbox: deep(420),
  control: deep(840),
  fuel: deep(1320),
  console: deep(1900),
  safety: deep(2500),
  types: deep(3100),
  cycle: deep(3800),
} as const;
export type SetId = keyof typeof SETS;
