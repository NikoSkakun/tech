/**
 * Camera shots of the chapter, one per step (plus variants used by controls). Positions are in world metres.
 * The journey follows the document: wide island → up to the rotor → through the flow → onto the blade → into
 * the nacelle → back to the tower foot → bird's eye over the farm → across the strait → dusk panorama.
 *
 * Every shot declares `fit` — the sphere that must stay in frame on any aspect ratio (DECISIONS §57 d): the
 * subject of the step, not the whole world. Charts and numbers live on the HUD board (top left on wide
 * screens), so subjects are framed for the free area between the board and the step column.
 */
import { Vector3 } from 'three';
import type { CameraDirector, Shot } from '@/engine/api';
import { FARM, HERO, SEA } from './layout';
import type { Hero } from './parts/hero';

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
const at = (p: Vector3): [number, number, number] => [p.x, p.y, p.z];

/** `position` turned by `deg` about the vertical axis through `target` (camera arcs of the fly-around). */
function swing(position: Vector3, target: Vector3, deg: number): Vector3 {
  return position.clone().sub(target).applyAxisAngle(v(0, 1, 0), (deg * Math.PI) / 180).add(target);
}

export function defineShots(camera: CameraDirector, hero: Hero): void {
  const hub = hero.hub;
  const base = hero.base;
  // tower top = origin of the nacelle (its rotor axis)
  const top = base.clone().add(v(0, HERO.hubHeight, 0));
  const mid = base.clone().add(v(0, HERO.hubHeight * 0.8, 0));
  const wide = { azimuth: 0.61, polar: 0.3, zoom: [0.6, 1.5] as [number, number] }; // ±35° (document, step 1)
  const island = { center: [-10, 20, -10] as [number, number, number], radius: 250 };
  const overviewFrom = v(-420, 150, 330);
  const overviewAt = v(-20, 34, -10);
  const sea = (x: number, y: number, z: number): [number, number, number] => [SEA.x + x, y, SEA.z + z];
  const shots: Record<string, Shot> = {
    overview: { position: at(overviewFrom), target: at(overviewAt), fov: 30, orbit: wide, fit: island },
    // the scripted fly-around: start 20° further round the island, arc to `overview`, then approach the hero
    'overview-arc': { position: at(swing(overviewFrom, overviewAt, 20)), target: at(overviewAt), fov: 30, orbit: wide, fit: island },
    'overview-hero': { position: at(base.clone().add(v(-96, 76, 218))), target: at(base.clone().add(v(4, 58, 0))), fov: 30, orbit: wide, fit: { center: at(base.clone().add(v(0, 58, 0))), radius: 64 } },
    'wind-power': { position: hub.clone().add(v(-128, 16, 172)), target: hub.clone().add(v(-24, -6, 0)), fov: 30, fit: { center: at(hub.clone().add(v(-24, -4, 0))), radius: 58 } },
    betz: { position: hub.clone().add(v(20, 6, 232)), target: hub.clone().add(v(20, -6, 0)), fov: 30, fit: { center: at(hub.clone().add(v(20, -4, 0))), radius: 78 } },
    // the diagram of step 4 (steps/blade.ts) hangs at hub + BLADE; seen a little from the side, so the slice has depth
    blade: { position: hub.clone().add(v(-28.5, 6, 86)), target: hub.clone().add(v(-38.2, 4.6, 31)), fov: 30, frameAspect: 1.02, fit: { center: at(hub.clone().add(v(-38.2, 4.6, 30))), radius: 20 } },
    nacelle: { position: top.clone().add(v(8.5, 6.2, 13.5)), target: top.clone().add(v(1.3, -0.2, 0)), fov: 30, fit: { center: at(top.clone().add(v(0.5, 0, -1))), radius: 6.5 } },
    drivetrain: { position: top.clone().add(v(6.5, 6.4, 15)), target: top.clone().add(v(1.5, 1.1, 0)), fov: 30, fit: { center: at(top.clone().add(v(0.5, 1.6, -1))), radius: 7.5 } },
    // a tall subject beside the board: a portrait frame lets the turbine fill the height
    'power-curve': { position: base.clone().add(v(-40, 30, 196)), target: at(mid), fov: 30, frameAspect: 0.8, fit: { center: at(mid), radius: 56 } },
    'wind-farm': {
      position: [FARM.x + 12, 250, FARM.z + 214],
      target: [FARM.x + 18, 2, FARM.z - 4],
      fov: 30,
      orbit: { azimuth: 0.5, polar: 0.2, zoom: [0.7, 1.5] },
      fit: { center: [FARM.x + 20, 4, FARM.z], radius: 150 },
    },
    'capacity-factor': { position: [-250, 120, 360], target: [-60, 44, 0], fov: 30, fit: { center: [-40, 30, 0], radius: 230 } },
    offshore: { position: sea(-120, 78, 268), target: sea(-14, -2, 14), fov: 30, fit: { center: sea(0, 6, 0), radius: 150 } },
    // «Глибина»: through the south glass wall, at the level of each foundation
    'off-mono': { position: sea(-58, -4, 138), target: sea(-66, -5, 54), fov: 30, fit: { center: sea(-66, 0, 54), radius: 26 } },
    'off-jacket': { position: sea(10, -9, 150), target: sea(0, -9, 52), fov: 30, fit: { center: sea(0, -4, 52), radius: 30 } },
    'off-float': { position: sea(100, -16, 158), target: sea(88, -15, 44), fov: 30, fit: { center: sea(88, -10, 44), radius: 36 } },
    'off-compare': { position: sea(-70, 26, 190), target: sea(-80, 19, 77), fov: 30, fit: { center: sea(-80, 19, 77), radius: 34 } },
    // dusk panorama along the island, the sea farm and its lights in the distance
    role: { position: [-322, 140, 362], target: [24, 44, -6], fov: 30, orbit: wide, fit: { center: [20, 40, -10], radius: 250 } },
  };
  camera.shots(shots);
}
