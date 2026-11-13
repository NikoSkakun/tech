/**
 * Step 2's world «усередині ґратки»: the copper ions as a hall of columns around the camera and the 600
 * electrons of the sim's Drude gas (`@electricity/sim/matter` §2) racing through it with short fading tails.
 *
 * Coordinates: the sim box (7,2 nm) is folded to `FOLD` cells so that all 600 electrons share the 12-cell window
 * the camera looks into (the gas is periodic anyway). `centre` (nm, sim space) is the point shown at the group's
 * origin; following an electron moves `centre` with it — ions are re-anchored by whole cells (the lattice is
 * periodic, so nothing jumps) and every electron is drawn at its image nearest to `centre`.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createOrbs, createParticles, RibbonLines, sphereEmitter } from '@/fx';
import { ELECTRON_GAS, type ElectronGas } from '@electricity/sim/matter';
import { fccSites } from './fcc-block';

/** Cells of the visible window; 1 cell = 0,3615 nm. */
export const FOLD = 12;
export const CELL_NM = 0.3615;
export const FOLD_NM = FOLD * CELL_NM;
/** World units per nm (a = 0,5 units). */
export const UNITS_PER_NM = 0.5 / CELL_NM;
const TAIL_S = 0.11;

export interface ElectronHall {
  group: Group;
  /** Shown point, nm (sim space, unwrapped). */
  centre: Vector3;
  /** Ion trembling amplitude, world units. */
  jitter: number;
  /** Camera position in the group's local space (near objects are hidden). */
  eye: Vector3;
  /** Index of the highlighted electron. */
  readonly hero: number;
  /** Display position of electron i (group-local). */
  electronAt(i: number, out: Vector3): Vector3;
  /** Last scattering flash (group-local), for the hotspot. */
  lastFlash: Vector3;
  update(t: number): void;
}

const ramp = (d: number, a: number, b: number): number => Math.min(Math.max((d - a) / (b - a), 0), 1);
const wrap = (x: number, c: number, L: number): number => x - L * Math.round((x - c) / L);

export function createElectronHall(ctx: ChapterContext, gas: ElectronGas): ElectronHall {
  const group = new Group();
  group.name = 'electron-hall';
  const a = CELL_NM * UNITS_PER_NM;
  const sites = fccSites(FOLD, a);
  const ions = createOrbs({
    kind: 'ion',
    color: 'coral.dark',
    glyph: 'none',
    count: sites.length,
    radius: 0.048,
  });
  const ionGroup = new Group();
  ionGroup.add(ions);
  const n = ELECTRON_GAS.count;
  const electrons = createOrbs({ kind: 'electron', count: n, radius: 0.046 });
  const tails = new RibbonLines({
    capacity: n * 2 + 8,
    color: 'cyan',
    width: 0.024,
    intensity: 1.2,
    endFade: [1, 0],
  });
  const lines = Array.from({ length: n }, () => ({
    points: [new Vector3(), new Vector3()],
    brightness: [0, 1],
  }));
  const flashes = createParticles(ctx, {
    loop: false,
    count: 120,
    emitter: sphereEmitter(0.01),
    sprite: 'soft',
    color: ['white', 'cyan'],
    size: [0.5, 0.1],
    life: [0.3, 0.45],
    speed: 0,
  });
  group.add(ionGroup, electrons, tails, flashes);
  const prevDir = new Float32Array(n * 3);
  let primed = false;
  const p = new Vector3();
  const hall: ElectronHall = {
    group,
    centre: new Vector3(FOLD_NM / 2, FOLD_NM / 2, FOLD_NM / 2),
    jitter: 0.01,
    eye: new Vector3(0, 0, 3),
    hero: 17,
    lastFlash: new Vector3(0.6, 0.2, -0.8),
    electronAt(i, out) {
      const pos = gas.positions;
      const c = hall.centre;
      return out.set(
        (wrap(pos[3 * i]! % FOLD_NM, c.x, FOLD_NM) - c.x) * UNITS_PER_NM,
        (wrap(pos[3 * i + 1]! % FOLD_NM, c.y, FOLD_NM) - c.y) * UNITS_PER_NM,
        (wrap(pos[3 * i + 2]! % FOLD_NM, c.z, FOLD_NM) - c.z) * UNITS_PER_NM,
      );
    },
    update(t) {
      const c = hall.centre;
      // ions: anchored by whole cells around the centre (seamless: the lattice repeats every cell)
      const sx = Math.floor(c.x / CELL_NM) * CELL_NM;
      const sy = Math.floor(c.y / CELL_NM) * CELL_NM;
      const sz = Math.floor(c.z / CELL_NM) * CELL_NM;
      ionGroup.position.set((sx - c.x) * UNITS_PER_NM, (sy - c.y) * UNITS_PER_NM, (sz - c.z) * UNITS_PER_NM);
      const j = hall.jitter;
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i]!;
        p.copy(s).add(ionGroup.position);
        const d = p.distanceTo(hall.eye);
        const near = ramp(d, 0.9, 1.7) * (1 - ramp(d, 2.5, 3.6));
        ions.setPosition(
          i,
          s.x + j * Math.sin(t * 11.3 + i * 1.7),
          s.y + j * Math.sin(t * 12.7 + i * 2.3),
          s.z + j * Math.sin(t * 10.1 + i * 0.9),
          near,
        );
      }
      ions.commit();
      const dir = gas.directions;
      const tailLen = ELECTRON_GAS.fermiSpeedMPerS * ELECTRON_GAS.realSecondsPerSceneSecond * 1e9 * TAIL_S;
      for (let i = 0; i < n; i++) {
        hall.electronAt(i, p);
        const near = ramp(p.distanceTo(hall.eye), 0.5, 1.1);
        electrons.setPosition(i, p.x, p.y, p.z, near);
        const ln = lines[i]!;
        ln.points[1]!.copy(p);
        ln.points[0]!.set(
          p.x - dir[3 * i]! * tailLen * UNITS_PER_NM,
          p.y - dir[3 * i + 1]! * tailLen * UNITS_PER_NM,
          p.z - dir[3 * i + 2]! * tailLen * UNITS_PER_NM,
        );
        ln.brightness[1] = near;
        const turned =
          primed &&
          (prevDir[3 * i] !== dir[3 * i] ||
            prevDir[3 * i + 1] !== dir[3 * i + 1] ||
            prevDir[3 * i + 2] !== dir[3 * i + 2]);
        if (turned) {
          flashes.emit(1, { position: [p.x, p.y, p.z] });
          hall.lastFlash.copy(p);
          ln.points[0]!.copy(p); // a fresh direction: the tail starts again
        }
        prevDir[3 * i] = dir[3 * i]!;
        prevDir[3 * i + 1] = dir[3 * i + 1]!;
        prevDir[3 * i + 2] = dir[3 * i + 2]!;
      }
      primed = true;
      electrons.commit();
      tails.setLines(lines);
    },
  };
  return hall;
}
