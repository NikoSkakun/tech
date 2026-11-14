/**
 * Camera shots of the chapter, one per step (plus variants used by controls). Positions are in world metres.
 * The journey follows the document: the island → down through the dome into the fuel and one nucleus (the
 * inner sets lie deep below the island) → back up into the opened containment → along the loops → the control
 * room, the safety exhibit, the reactor gallery and the fuel-cycle belt → up over the island again.
 *
 * Every shot declares `fit` — the sphere that must stay in frame on any aspect ratio (DECISIONS §57 d).
 */
import type { CameraDirector, Shot } from '@/engine/api';
import { CONTAINMENT, SETS, type SetId } from './layout';

type V3 = [number, number, number];
const add = (a: readonly number[], x: number, y: number, z: number): V3 => [a[0]! + x, a[1]! + y, a[2]! + z];

/** A frontal shot of an inner set: camera `dist` in front (+Z), `up` above, looking at `look` (set-relative). */
function setShot(id: SetId, dist: number, up: number, look: V3, radius: number, extra: Partial<Shot> = {}): Shot {
  const c = SETS[id];
  return {
    position: add(c, look[0], look[1] + up, look[2] + dist),
    target: add(c, ...look),
    fov: 30,
    orbit: { azimuth: 0.45, polar: 0.25, zoom: [0.7, 1.4] },
    fit: { center: add(c, ...look), radius },
    ...extra,
  };
}

export function defineShots(camera: CameraDirector, ground: number): void {
  const rx = CONTAINMENT.x;
  const g = ground;
  const shots: Record<string, Shot> = {
    overview: {
      position: [-360, 200, 440],
      target: [6, 26, -6],
      fov: 30,
      orbit: { azimuth: 0.6, polar: 0.3, zoom: [0.6, 1.4] },
      fit: { center: [10, 30, -10], radius: 220 },
    },
    // «Зазирнути всередину»: down onto the dome before the dive into the fuel
    'overview-dive': { position: [rx + 18, g + 120, 70], target: [rx, g + 50, 0], fov: 30, fit: { center: [rx, g + 40, 0], radius: 34 } },
    fission: setShot('fission', 46, 5, [0, -1.5, 0], 17),
    'chain-reaction': setShot('sandbox', 92, 18, [0, 0, 0], 34),
    control: setShot('control', 58, 6, [4, 0, 0], 21),
    fuel: setShot('fuel', 40, 9, [0, 0, 0], 10),
    // straight from the south, low: the line of sight runs between the two front steam generators
    reactor: {
      position: [rx + 2, g + 11, 30],
      target: [rx, g + 8.5, 0],
      fov: 30,
      frameAspect: 0.9,
      orbit: { azimuth: 0.3, polar: 0.2, zoom: [0.75, 1.3] },
      fit: { center: [rx, g + 9, 0], radius: 9 },
    },
    'primary-loop': {
      position: [rx + 10, g + 58, 50],
      target: [rx + 8, g + 6, -2],
      fov: 30,
      orbit: { azimuth: 0.5, polar: 0.25, zoom: [0.7, 1.4] },
      fit: { center: [rx + 8, g + 10, 0], radius: 27 },
    },
    'reactor-sim': setShot('console', 10.5, 2.4, [0.6, 2.4, -2], 6.8),
    safety: setShot('safety', 36, 10, [1, 4.5, 0], 14),
    'reactor-types': setShot('types', 30, 9, [0, 3, -4], 15),
    'fuel-cycle': setShot('cycle', 62, 58, [6, -4, 4], 48, { frameAspect: 1.9 }),
    'role-ukraine': {
      position: [10, 200, 300],
      target: [0, 160, 30],
      fov: 30,
      orbit: { azimuth: 0.45, polar: 0.25, zoom: [0.7, 1.3] },
      fit: { center: [0, 162, 30], radius: 105 },
    },
  };
  camera.shots(shots);
}
