/**
 * The stage of the floor «молекули»: one thin layer of 252 molecules in a small box, seen from the front.
 * Below it lies the strip of the pad that warms or cools it (orange = it gives heat, sky = it takes heat), at the
 * sides stand two faint glass walls, to the right the thermometer. Every chapter that looks at molecules mounts
 * this same stage, so the reader meets the same sample again and again (VISUAL.md §6).
 *
 * Model units = world units: the box is `BOX_W` wide, its floor at y = 0 of `frame`; `group` is shifted so that
 * the sample with its thermometer is centred on the world origin.
 */
import { BoxGeometry, Group, Mesh, type Object3D } from 'three';
import type { Shot } from '@/engine/api';
import { K } from '@/style';
import { BOX_W, MOLECULES } from '../sim/setups';
import { R_OXYGEN } from './look';
import { createMolecules, type MoleculeView } from './molecules';
import { createThermometer, type Thermometer } from './thermometer';

/** Height of the frame's subject (floor to the top of the walls) and where the thermometer stands. */
export const SAMPLE_H = 15.5;
const THERMO_X = BOX_W + 2.3;
/** World position of the box's lower-left inner corner. */
export const SAMPLE_ORIGIN = [-(BOX_W + 3.4) / 2, -7.4, 0] as const;

export interface SampleStage {
  readonly group: Group;
  /** Model coordinates: add things that live in the box here. */
  readonly frame: Group;
  readonly molecules: MoleculeView;
  readonly thermometer: Thermometer;
  /** −1 … 1: the pad takes heat (sky) … gives heat (orange); 0 = dark. */
  heat: number;
  /** 0 … 1: the partition in the middle of the box is in place. */
  partition: number;
  /** World point of a model point (x, y) of the box. */
  world(x: number, y: number): [number, number, number];
  update(dt: number): void;
}

/** The main shot of the stage: the whole sample and the thermometer, a little from the right and above. */
export const SAMPLE_SHOT: Shot = {
  position: [2.2, 1.2, 32],
  target: [0, -0.5, 0],
  fov: 30,
  fit: { center: [0, 0, 0], radius: 12.5 },
  orbit: { azimuth: 0.5, polar: 0.3, zoom: [0.7, 1.6] },
  drift: 0.5,
};

export function createSample(): SampleStage {
  const group = new Group();
  group.name = 'water-sample';
  const frame = new Group();
  frame.position.set(...SAMPLE_ORIGIN);
  group.add(frame);
  const molecules = createMolecules(MOLECULES);
  frame.add(molecules.group);

  // the pad: a dark rounded slab with a glowing strip on top
  const slab = new Mesh(new BoxGeometry(BOX_W + 2.2, 0.9, 3.2), K.toon({ color: 'ink', gloss: 0.3, rim: 0.35 }));
  slab.position.set(BOX_W / 2, -R_OXYGEN - 0.62, 0);
  // two strips in one place, one per sign of the heat: a glow keeps the hot core it was made with
  const hot = K.glow({ color: 'orange', intensity: 0, whiten: 0.25, keepHue: true, falloff: 1.1 });
  const cold = K.glow({ color: 'sky', intensity: 0, whiten: 0.25, keepHue: true, falloff: 1.1 });
  const stripGeometry = new BoxGeometry(BOX_W + 1.2, 0.14, 2.2);
  const hotStrip = new Mesh(stripGeometry, hot);
  const coldStrip = new Mesh(stripGeometry, cold);
  for (const m of [hotStrip, coldStrip]) m.position.set(BOX_W / 2, -R_OXYGEN - 0.12, 0);
  // glass walls of the box and the partition
  const glass = K.glass({ color: 'sky', opacity: 0.07, edgeOpacity: 0.32, specular: 0.5 });
  const wall = (x: number): Mesh => {
    const m = new Mesh(new BoxGeometry(0.16, SAMPLE_H, 2.2), glass);
    m.position.set(x, SAMPLE_H / 2 - R_OXYGEN - 0.05, 0);
    m.renderOrder = 4;
    return m;
  };
  const left = wall(-R_OXYGEN - 0.1);
  const right = wall(BOX_W + R_OXYGEN + 0.1);
  const divider = new Mesh(
    new BoxGeometry(0.22, SAMPLE_H * 0.8, 2.2),
    K.glass({ color: 'white', opacity: 0.22, edgeOpacity: 0.7, specular: 0.6 }),
  );
  divider.renderOrder = 4;
  const thermometer = createThermometer(11.5, 0.42);
  thermometer.group.position.set(THERMO_X, 1.4, 0);
  frame.add(slab, hotStrip, coldStrip, left, right, divider, thermometer.group);

  let shownHeat = 0;
  let shownPartition = 0;
  const stage: SampleStage = {
    group,
    frame,
    molecules,
    thermometer,
    heat: 0,
    partition: 0,
    world: (x, y) => [SAMPLE_ORIGIN[0] + x, SAMPLE_ORIGIN[1] + y, 0],
    update(dt) {
      shownHeat += (stage.heat - shownHeat) * Math.min(1, dt * 5);
      hotStrip.visible = shownHeat >= 0;
      coldStrip.visible = !hotStrip.visible;
      hot.intensity = cold.intensity = 0.04 + 1.6 * Math.min(1, Math.abs(shownHeat));
      shownPartition += (stage.partition - shownPartition) * Math.min(1, dt * 5);
      divider.visible = shownPartition > 0.01;
      // the partition is lifted out upward
      divider.position.set(BOX_W / 2, SAMPLE_H * 0.4 - R_OXYGEN + (1 - shownPartition) * SAMPLE_H, 0);
    },
  };
  return stage;
}

/** Objects of the stage a step may list in `show` (the whole stage is one actor). */
export function sampleActors(stage: SampleStage): Object3D[] {
  return [stage.group];
}
