/**
 * Every position and size of the archipelago, in metres. Origin = centre of the machine-hall floor on the hub
 * island (y = 0 is the hall floor), +X right, +Z toward the default viewer.
 */
import { PLANT_IDS, type PlantId } from './plants-data';

/** The hub island (the «машинний зал» island). */
export const HUB = { radius: 50, depth: 46, seed: 23 } as const;

/** The open machine hall (kit `machineHall`, roof and front wall taken off) and the turbine-generator set in it. */
export const HALL = { length: 46, width: 22, height: 13, x: 0, z: -2 } as const;

/** Where step rigs stand: the free floor in front of / inside the hall. */
export const FLOOR_Y = 0;

/** The world ring (shared bus): a glowing hoop above the hub. */
export const RING = { radius: 74, y: 40, tube: 0.6 } as const;

/** Plant islands on a circle around the hub (archipelago layout, steps 1–10). */
export const SAT = { radius: 18, orbit: 132 } as const;

/** Lift of each plant island above / below the hub (a gentle wave around the circle). */
const LIFT: Record<PlantId, number> = { coal: -4, gas: 6, nuclear: -2, hydro: 9, wind: 2, solar: -6, geoBio: 5, ocean: -8, future: 3 };

/** Polar angle of island i: the circle starts behind-left and runs clockwise when seen from above. */
export function satAngle(i: number): number {
  return Math.PI * 0.5 + 0.35 + (i * 2 * Math.PI) / PLANT_IDS.length;
}

/** Island centre in the archipelago layout. */
export function satPosition(id: PlantId): [number, number, number] {
  const i = PLANT_IDS.indexOf(id);
  const a = satAngle(i);
  return [Math.cos(a) * SAT.orbit, LIFT[id], Math.sin(a) * SAT.orbit];
}

/**
 * Gallery layout (step 11): the nine islands on three tiers of a shallow arc that opens toward the camera (three
 * per tier, each tier higher and further back, like seats of a theatre), raised above the hub. Three per row
 * instead of nine lets every island be ≈ 1,7× larger on screen. Arc centre (0, 0, GALLERY.cz), front radius
 * GALLERY.r; tier k adds `dr` to the radius and `dy` to the height.
 */
export const GALLERY = { cz: 420, r: 300, step: 0.32, y: 44, dy: 74, dr: 40, scale: 2.25 } as const;

export function galleryPosition(id: PlantId): [number, number, number] {
  const i = PLANT_IDS.indexOf(id);
  const k = Math.floor(i / 3);
  const phi = ((i % 3) - 1) * GALLERY.step;
  const r = GALLERY.r + k * GALLERY.dr;
  return [Math.sin(phi) * r, GALLERY.y + k * GALLERY.dy, GALLERY.cz - Math.cos(phi) * r];
}

/** Rotation (about Y) that turns an island's front (+Z) toward a point. */
export function facing(from: readonly number[], to: readonly number[]): number {
  return Math.atan2((to[0] ?? 0) - (from[0] ?? 0), (to[2] ?? 0) - (from[2] ?? 0));
}
