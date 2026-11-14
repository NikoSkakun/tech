/**
 * Camera shots of the chapter, one per step plus the stops of scripted moves. Positions are in world metres;
 * the camera mostly stands in the south and looks north, so the technology reads left → right.
 * Every shot declares `fit` — the sphere that must stay in frame on any aspect ratio (DECISIONS §57 d): the
 * subject of the step, not the whole world. Charts and numbers live on the HUD board (top left on wide
 * screens), so subjects are framed for the free area between the board and the step column.
 */
import type { CameraDirector, Shot } from '@/engine/api';
import { BOILER, CITY, DUMPER, GAS, HALL, ISLAND, RIGS, YARD } from './layout';

type V = [number, number, number];
const g = ISLAND.ground;

export function defineShots(camera: CameraDirector): void {
  const wide = { azimuth: 0.6, polar: 0.3, zoom: [0.6, 1.5] as [number, number] };
  const near = { azimuth: 0.45, polar: 0.25, zoom: [0.7, 1.4] as [number, number] };
  const shot = (position: V, target: V, fitR: number, extra: Partial<Shot> = {}, center: V = target): Shot => ({
    position,
    target,
    fov: 30,
    orbit: near,
    fit: { center, radius: fitR },
    ...extra,
  });
  const c = RIGS.capsule;
  const m = RIGS.mill;
  const p = RIGS.phase;
  const f = RIGS.feed;
  const shots: Record<string, Shot> = {
    overview: shot([-190, 250, 560], [-6, 18, -10], 300, { orbit: wide }),
    'overview-low': shot([-300, 40, 210], [-170, 12, 100], 70),
    coal: shot([c.x - 8, c.y + 96, c.z + 150], [c.x - 18, c.y - 16, c.z + 36], 74),
    // «Від грудки до пилу»: along the flow, then the mill
    'dust-dumper': shot([DUMPER.x - 30, g + 30, DUMPER.z + 76], [DUMPER.x, g + 6, DUMPER.z + 16], 26),
    'dust-yard': shot([YARD.x + 30, g + 70, YARD.z + 120], [YARD.x + 10, g + 6, YARD.z], 70),
    'dust-gallery': shot([-40, g + 60, 110], [-60, g + 30, 10], 50),
    'coal-to-dust': shot([m.x + 40, g + 40, m.z + 84], [m.x - 2, g + 16, m.z], 36),
    // seen from the north: the shell opens on that side (the turbine hall stands south of it)
    boiler: shot([BOILER.x - 6, g + 58, BOILER.z - 146], [BOILER.x - 2, g + 36, BOILER.z], 46, { frameAspect: 1.1 }),
    'steam-params': shot([p.x + 10, p.y - 8, p.z + 62], [p.x, p.y + 3, p.z], 20),
    turbine: shot([HALL.x + 8, g + 84, HALL.z + 78], [HALL.x + 6, g + 4, HALL.z - 4], 48),
    feedwater: shot([f.x + 76, g + 50, f.z + 214], [f.x + 76, g + 12, f.z - 4], 84),
    // from the south-east, past the end of the turbine hall: the gas path from the catalyst to the stack
    'flue-gas': shot([GAS.esp.x + 60, g + 74, GAS.z + 170], [GAS.esp.x + 22, g + 44, GAS.z], 84),
    'ash-co2': shot([0, 64, 430], [4, 26, 120], 120),
    'chp-flex': shot([300, 150, 330], [(CITY.x + 150) / 2 + 10, 4, (CITY.z + 60) / 2], 190),
    'role-ukraine': shot([-20, 150, 470], [8, 100, 40], 220, { orbit: wide }, [8, 110, 100]),
  };
  camera.shots(shots);
}
