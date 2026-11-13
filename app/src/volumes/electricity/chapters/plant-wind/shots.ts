/**
 * Camera shots of the chapter, one per step (plus variants used by controls). Positions are in world metres.
 * The journey follows the document: wide island → up to the rotor → through the flow → onto the blade → into
 * the nacelle → back to the tower foot → bird's eye over the farm → across the strait → dusk panorama.
 */
import { Vector3 } from 'three';
import type { CameraDirector, Shot } from '@/engine/api';
import { FARM, HERO, SEA } from './layout';
import type { Hero } from './parts/hero';

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

export function defineShots(camera: CameraDirector, hero: Hero): void {
  const hub = hero.hub;
  const base = hero.base;
  // tower top = origin of the nacelle (its rotor axis)
  const top = base.clone().add(v(0, HERO.hubHeight, 0));
  const wide = { azimuth: 0.61, polar: 0.3, zoom: [0.6, 1.5] as [number, number] }; // ±35° (document, step 1)
  const shots: Record<string, Shot> = {
    overview: { position: [-420, 150, 330], target: [-20, 34, -10], fov: 30, orbit: wide },
    'wind-power': { position: hub.clone().add(v(-128, 16, 172)), target: hub.clone().add(v(-24, -6, 0)), fov: 30 },
    betz: { position: hub.clone().add(v(20, 6, 232)), target: hub.clone().add(v(20, -6, 0)), fov: 30 },
    blade: { position: hub.clone().add(v(-34, 9.5, 80)), target: hub.clone().add(v(-37, 8.5, 30)), fov: 30 },
    nacelle: { position: top.clone().add(v(8.5, 6.2, 13.5)), target: top.clone().add(v(1.3, -0.2, 0)), fov: 30 },
    drivetrain: { position: top.clone().add(v(6.5, 6.4, 15)), target: top.clone().add(v(1.5, 1.1, 0)), fov: 30 },
    'power-curve': { position: base.clone().add(v(-28, 30, 196)), target: base.clone().add(v(24, 38, 0)), fov: 30 },
    'wind-farm': {
      position: [FARM.x - 6, 238, FARM.z + 204],
      target: [FARM.x, 2, FARM.z - 8],
      fov: 30,
      orbit: { azimuth: 0.5, polar: 0.2, zoom: [0.7, 1.5] },
    },
    'capacity-factor': { position: [-250, 120, 360], target: [-60, 44, 0], fov: 30 },
    offshore: { position: [SEA.x - 120, 78, SEA.z + 268], target: [SEA.x - 14, -2, SEA.z + 14], fov: 30 },
    // «Глибина»: through the south glass wall, at the level of each foundation
    'off-mono': { position: [SEA.x - 58, -4, SEA.z + 138], target: [SEA.x - 66, -5, SEA.z + 54], fov: 30 },
    'off-jacket': { position: [SEA.x + 10, -9, SEA.z + 150], target: [SEA.x, -9, SEA.z + 52], fov: 30 },
    'off-float': { position: [SEA.x + 100, -16, SEA.z + 158], target: [SEA.x + 88, -15, SEA.z + 44], fov: 30 },
    'off-compare': { position: [SEA.x - 70, 26, SEA.z + 190], target: [SEA.x - 80, 19, SEA.z + 77], fov: 30 },
    role: { position: [360, 190, 600], target: [96, 52, -10], fov: 30, orbit: wide },
  };
  camera.shots(shots);
}
