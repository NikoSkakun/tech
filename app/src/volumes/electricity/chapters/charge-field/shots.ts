/**
 * Every camera shot of the chapter. Most of the chapter is the 3/4 view over the table (35–50° above it, the
 * user may orbit ±60°); each shot declares its subject bounds (`fit`, DECISIONS §57 d).
 */
import type { CameraDirector, Shot } from '@/engine/api';
import { STATIC } from './layout';

const ORBIT = { azimuth: 1.05, polar: 0.3, zoom: [0.7, 1.45] as [number, number] };
const table = (pitchDeg: number, distance: number, y = 0.4, x = 0): Shot => {
  const a = (pitchDeg * Math.PI) / 180;
  return {
    position: [x, y + distance * Math.sin(a), distance * Math.cos(a)],
    target: [x, y, 0],
    orbit: ORBIT,
    fit: { center: [x, y, 0], radius: 6.6 },
  };
};

export const SHOTS = {
  charge: table(27, 15.5, 1.5),
  coulomb: table(34, 10.8, 0.9),
  gravity: {
    position: [3.6, 7.2, 16.5],
    target: [-1.2, 4.3, -0.6],
    orbit: { azimuth: 0.5, polar: 0.2 },
    fit: { center: [-0.6, 4.1, -0.6], radius: 5.6 },
  },
  gravityTop: {
    position: [-1.4, 9.6, 5.6],
    target: [-3.6, 8.2, -1.2],
    drift: 0.4,
    fit: { center: [-3.6, 8.2, -1.2], radius: 1.6 },
  },
  gravityBottom: {
    position: [-1.4, 1.5, 5.6],
    target: [-3.6, 0.5, -1.2],
    drift: 0.4,
    fit: { center: [-3.6, 0.5, -1.2], radius: 1.6 },
  },
  field: table(50, 16.5, 0.2, -1.1),
  potential: table(36, 17, 0.5, -1.1),
  conductor: table(34, 17, 1.0),
  balloon: table(20, 17, 2.4),
  storm: {
    position: [STATIC.storm.x - 6, STATIC.storm.y + 9.5, STATIC.storm.z + 27],
    target: [STATIC.storm.x, STATIC.storm.y + 6.4, STATIC.storm.z],
    orbit: { azimuth: 0.6, polar: 0.2 },
    fit: { center: [STATIC.storm.x, STATIC.storm.y + 6.4, STATIC.storm.z], radius: 10.5 },
  },
  capacitor: table(15, 12.6, 1.8),
  bridge: table(30, 14.2, 1.2),
  inside: {
    position: [0, 6.3, 6.6],
    target: [0, 5.6, -1.2],
    fov: 30,
    orbit: { azimuth: 0.35, polar: 0.15 },
    fit: { center: [0, 5.6, -1.2], radius: 3.2 },
  },
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof SHOTS;

export function defineShots(camera: CameraDirector): void {
  camera.shots(SHOTS);
}
