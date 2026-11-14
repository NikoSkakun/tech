/**
 * Camera shots of the chapter, one per step (plus variants used by controls). Positions are world metres.
 * The journey follows the document: orbit over the valley → wide view with the water cycle and the «water
 * lift» → the stand (dam section, the path of water, three runners, the unit) → the storm over the reservoir
 * and spillway → night at the pumped-storage rig → the hologram of Ukraine over the island.
 *
 * Every shot declares `fit` — the subject sphere that must stay in frame on any aspect ratio (DECISIONS §57 d).
 * Charts and numbers live on the HUD board (top left on wide screens), so subjects are framed for the free
 * area between the board and the step column.
 */
import type { CameraDirector, Shot } from '@/engine/api';
import { STAND } from './layout';

type V = [number, number, number];
const S = (x: number, y: number, z: number): V => [STAND.x + x, STAND.y + y, STAND.z + z];

/** Where the hologram of Ukraine floats (step 9). */
export const HOLO: V = [10, 130, 90];
/** Where the «water lift» of step 2 stands (south bank, beside the dam). */
export const LIFT: V = [-40, 0, 118];

export function defineShots(camera: CameraDirector): void {
  const orbitWide = { azimuth: 0.7, polar: 0.3, zoom: [0.6, 1.4] as [number, number] };
  const shots: Record<string, Shot> = {
    overview: {
      position: [330, 250, 430],
      target: [-10, 30, -10],
      fov: 30,
      orbit: orbitWide,
      fit: { center: [0, 40, -10], radius: 290 },
    },
    'water-energy': {
      position: [-80, 150, 340],
      target: [30, 62, 10],
      fov: 32,
      orbit: orbitWide,
      fit: { center: [20, 60, 10], radius: 230 },
    },
    dams: { position: S(4, 50, 128), target: S(4, 27, 0), fov: 30, fit: { center: S(4, 27, 0), radius: 54 } },
    'water-path': {
      position: S(6, 32, 100),
      target: S(6, 21, 0),
      fov: 30,
      fit: { center: S(6, 22, 0), radius: 48 },
    },
    turbines: {
      position: S(0, 48, 82),
      target: S(0, 13, 0),
      fov: 30,
      fit: { center: S(0, 13, 0), radius: 44 },
    },
    'generator-governor': {
      position: S(6, 74, 80),
      target: S(4, 12, 0),
      fov: 30,
      fit: { center: S(4, 12, 0), radius: 44 },
    },
    'reservoir-environment': {
      position: [262, 158, 120],
      target: [-40, 40, -24],
      fov: 30,
      orbit: { azimuth: 0.5, polar: 0.25, zoom: [0.7, 1.3] },
      fit: { center: [-30, 50, -10], radius: 190 },
    },
    'pumped-storage': {
      position: S(-8, 36, 86),
      target: S(-8, 17, 0),
      fov: 30,
      fit: { center: S(-4, 17, 0), radius: 48 },
    },
    'role-ukraine': {
      position: [24, 175, 330],
      target: [8, 122, 80],
      fov: 30,
      orbit: orbitWide,
      fit: { center: [8, 124, 86], radius: 105 },
    },
  };
  camera.shots(shots);
}
