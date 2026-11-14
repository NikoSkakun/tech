/**
 * Camera shots of the chapter, one per step (plus variants used by controls). Positions are in world metres.
 * The journey follows the document: orbit over the island → low along the gas pipeline → into the main hall,
 * the gas turbine in section (from the south, 30° above) → macro on a first-stage blade → along the boiler →
 * medium plan of all three plant types at dawn → the engine hall and the town on a winter night → above the
 * stack → the island again.
 *
 * Every shot declares `fit` — the subject that must stay in frame on any aspect ratio (DECISIONS §57 d).
 */
import type { CameraDirector, Shot } from '@/engine/api';
import { GAS, HRSG, MACRO, SHAFT, TOWN, enginePos } from './layout';
import type { Island } from './parts/island';
import { GT_X } from './parts/gt-model';

type V3 = [number, number, number];

export function defineShots(camera: CameraDirector, isl: Island): void {
  const ay = isl.ccgt.axisY;
  // centre of the gas turbine on its axis
  const gt: V3 = [SHAFT.gtX + GT_X.end / 2, ay, SHAFT.z];
  const hot: V3 = [MACRO.x + 0.2, MACRO.y + 1.7, MACRO.z];
  const wide = { azimuth: 0.6, polar: 0.3, zoom: [0.6, 1.4] as [number, number] };
  const hrsgMid = (HRSG.x0 + HRSG.x1) / 2;
  const hero = enginePos(0);
  const shots: Record<string, Shot> = {
    overview: { position: [-335, 160, 330], target: [-28, 14, 0], fov: 30, orbit: wide, fit: { center: [10, 14, 0], radius: 280 } },
    'natural-gas': { position: [GAS.station.x - 40, 13, GAS.station.z + 34], target: [GAS.station.x - 8, 6, GAS.station.z + 2], fov: 30, orbit: { azimuth: 0.5, polar: 0.2 }, fit: { center: [GAS.station.x - 18, 6, GAS.station.z], radius: 17 } },
    'gas-turbine': { position: [gt[0] + 0.5, ay + 8.6, 16], target: [gt[0] + 0.5, ay + 0.4, 0], fov: 30, orbit: { azimuth: 0.5, polar: 0.25 }, fit: { center: gt, radius: 7.5 } },
    'gas-turbine-jet': { position: [gt[0] + 2, ay + 12, 24], target: [gt[0] + 2, ay - 0.6, 3], fov: 30, fit: { center: [gt[0] + 2, ay, 3], radius: 10 } },
    'brayton-sim': { position: [gt[0] + 0.5, ay + 9, 17], target: [gt[0] + 0.5, ay + 0.4, 0], fov: 30, orbit: { azimuth: 0.4, polar: 0.2 }, fit: { center: gt, radius: 7.5 } },
    'hot-section': { position: [hot[0] + 2.4, hot[1] + 4.0, hot[2] + 6.0], target: [hot[0] + 0.5, hot[1] - 0.2, hot[2]], fov: 30, orbit: { azimuth: 0.6, polar: 0.3 }, fit: { center: hot, radius: 3 } },
    'combined-cycle': { position: [hrsgMid - 22, 34, 72], target: [hrsgMid - 13, 14, -6], fov: 30, orbit: { azimuth: 0.4, polar: 0.2 }, fit: { center: [hrsgMid - 6, 14, -6], radius: 40 } },
    flexibility: { position: [60, 105, 215], target: [70, 8, -8], fov: 30, orbit: wide, fit: { center: [70, 10, -8], radius: 120 } },
    'gas-engines': { position: [hero[0] - 0.4, 9.5, hero[1] + 17.5], target: [hero[0] - 0.4, 3.4, hero[1]], fov: 30, orbit: { azimuth: 0.4, polar: 0.2 }, fit: { center: [hero[0], 3.5, hero[1]], radius: 8 } },
    'gas-engines-map': { position: [TOWN.x - 10, 150, TOWN.z + 150], target: [TOWN.x + 20, 0, TOWN.z - 4], fov: 30, fit: { center: [TOWN.x + 20, 4, TOWN.z], radius: 80 } },
    'emissions-hydrogen': { position: [-170, 150, 300], target: [-60, 62, 0], fov: 30, orbit: wide, fit: { center: [-50, 64, 0], radius: 170 } },
    role: { position: [-260, 200, 420], target: [-10, 70, -20], fov: 30, orbit: wide, fit: { center: [-10, 60, -20], radius: 260 } },
  };
  camera.shots(shots);
}
