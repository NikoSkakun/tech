/**
 * Coal handling: the rotary car dumper on its siding (a drum that turns one gondola over ≈ 160°), the coal yard
 * (two long ridges either side of the stacker-reclaimer rail), the reversible yard belt, the crusher house and
 * the covered gallery climbing to the bunker bay. Kit `conveyor`s carry the lumps; the chapter builds the dumper,
 * the stacker-reclaimer and the ridges with the kit `Builder`.
 */
import { Vector3 } from 'three';
import { Builder, conveyor, type Conveyor, type KitModel } from '@/kit';
import { col } from '@/style';
import { BUNKER, CRUSHER, DUMPER, ISLAND, YARD } from '../layout';
import { noShadow } from './shadows';

export interface Yard {
  models: KitModel[];
  dumper: KitModel;
  stacker: KitModel;
  belts: Conveyor[];
  /** Where the dumper's wagon empties (top of the receiving hopper), the head of the gallery (bunker top). */
  hopper: Vector3;
  bunkerTop: Vector3;
  /** Drum angle of the dumper (rad, 0 = upright … ≈ 2.8 = upside down) and the stacker position (−1 … 1). */
  setDrum(angle: number): void;
  setStacker(along: number): void;
  update(dt: number, t: number): void;
}

const g = ISLAND.ground;
/** Siding of the dumper, 16 m south of the loop. */
export const SIDING_Z = DUMPER.z + 16;

function buildDumper(): KitModel {
  const b = new Builder('car-dumper');
  const wall = [col('steel'), col('mist')] as const;
  // shed: back wall, roof on columns, receiving hopper pit below the drum
  b.box(36, 18, 1, { r: 0.2, c: wall, at: [0, 0, -9] });
  b.box(38, 1.2, 20, { r: 0.3, slot: 'gloss', c: 'amber', at: [0, 18, 0] });
  for (const x of [-17, -6, 6, 17]) b.box(1, 18, 1, { r: 0.1, c: 'steel', at: [x, 0, 9] });
  b.box(14, 1, 12, { r: 0.2, slot: 'matte', c: 'ink', at: [0, -0.4, 0] });
  // siding through the shed
  for (const s of [-0.76, 0.76]) b.box(44, 0.2, 0.14, { r: 0, slot: 'metal', c: 'steel.light', at: [0, 0.3, s] });
  const drum = b.part('drum', { at: [0, 5.2, 0] });
  for (const x of [-7, 7]) drum.ring(5.6, 0.45, { axis: 'x', seg: 48, slot: 'gloss', c: 'coral', at: [x, 0, 0] });
  for (const k of [0, 1, 2, 3]) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    drum.box(14, 0.5, 0.5, { r: 0, slot: 'metal', c: 'slate', at: [0, 5.5 * Math.sin(a) - 0.25, 5.5 * Math.cos(a)] });
  }
  // cradle and the gondola it clamps (11 m pitch like the kit train)
  drum.box(12, 0.5, 3.4, { r: 0.1, slot: 'metal', c: 'slate', at: [0, -4.9, 0] });
  drum.box(10.4, 2.6, 3.0, { r: 0.25, slot: 'gloss', c: ['ink', 'slate'], at: [0, -4.4, 0] });
  drum.dome(1.5, 0.9, { s: [3.2, 1, 0.9], slot: 'facet', c: 'ink', at: [0, -1.8, 0] });
  b.anchor('hopper', 0, 0.6, 0);
  return b.build();
}

function buildStacker(): KitModel {
  const b = new Builder('stacker-reclaimer');
  for (const s of [-3, 3]) b.box(YARD.length + 10, 0.4, 0.5, { r: 0, slot: 'metal', c: 'steel', at: [0, 0.2, s] });
  const m = b.part('machine');
  m.box(10, 3, 8, { r: 0.4, slot: 'gloss', c: ['amber.dark', 'amber'], at: [0, 0.6, 0] });
  m.cyl(2.8, 3, { seg: 28, slot: 'gloss', c: 'amber', at: [0, 3.6, 0] });
  m.box(3, 3, 3, { r: 0.3, slot: 'gloss', c: 'white', at: [0, 6.6, 0] });
  // boom toward −Z over the north ridge, counterweight arm toward +Z
  m.beam([0, 7.5, 0], [0, 4.5, -26], 1.6, { h: 1.8, r: 0.2, slot: 'gloss', c: 'amber' });
  m.beam([0, 7.5, 0], [0, 9, 10], 1.2, { h: 1.2, r: 0.2, slot: 'gloss', c: 'amber' });
  m.box(3.4, 3, 3.4, { r: 0.3, slot: 'matte', c: 'slate', at: [0, 7, 11] });
  m.rod([0, 13, 0], [0, 4.5, -26], 0.12, { slot: 'metal', c: 'steel' });
  m.rod([0, 13, 0], [0, 9.5, 10], 0.12, { slot: 'metal', c: 'steel' });
  m.box(0.6, 6, 0.6, { r: 0, slot: 'metal', c: 'steel', at: [0, 7.5, 0] });
  const wheel = m.part('wheel', { at: [1.6, 4.5, -26] });
  wheel.ring(3.4, 0.35, { axis: 'x', seg: 36, slot: 'gloss', c: 'coral' });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    wheel.box(0.9, 1.2, 1.2, { r: 0.2, slot: 'metal', c: 'slate', at: [0, 3.6 * Math.sin(a) - 0.6, 3.6 * Math.cos(a)] });
  }
  m.anchor('bucket', 1.6, 4.5, -26);
  return b.build();
}

/** A coal ridge: an elongated faceted mound. */
function addRidge(b: Builder, z: number, length: number, width: number, h: number): void {
  b.dome(width / 2, h, { s: [length / width, 1, 1], seg: 18, slot: 'facet', c: ['ink', 'steel'], at: [0, 0, z] });
}

/** Covered gallery around an inclined belt: roof, side trusses, end towers. */
function buildGallery(from: Vector3, to: Vector3): KitModel {
  const b = new Builder('gallery');
  const dir = to.clone().sub(from);
  const len = dir.length();
  const yaw = Math.atan2(-dir.z, dir.x);
  const pitch = Math.asin(dir.y / len);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  b.frame({ at: [mid.x, mid.y, mid.z], rot: [0, yaw, pitch] }, () => {
    b.box(len, 0.5, 4.2, { r: 0.15, slot: 'gloss', c: 'amber', at: [0, 2.6, 0] });
    for (const s of [-1, 1]) {
      b.box(len, 0.3, 0.3, { r: 0, slot: 'metal', c: 'steel', at: [0, -0.6, s * 2] });
      b.box(len, 0.3, 0.3, { r: 0, slot: 'metal', c: 'steel', at: [0, 2.4, s * 2] });
      const n = Math.max(2, Math.round(len / 6));
      for (let i = 0; i <= n; i++) b.box(0.25, 3, 0.25, { r: 0, slot: 'metal', c: 'steel', at: [-len / 2 + (i / n) * len, -0.6, s * 2] });
    }
  });
  // trestles down to the ground
  const n = Math.max(1, Math.round(len / 24));
  for (let i = 1; i < n + 1; i++) {
    const p = from.clone().lerp(to, i / (n + 1));
    b.box(1.2, p.y - g - 1, 1.2, { r: 0.1, c: 'steel', at: [p.x, g, p.z] });
  }
  return b.build();
}

export function buildYard(): Yard {
  const models: KitModel[] = [];
  const dumper = buildDumper();
  dumper.group.position.set(DUMPER.x, g, SIDING_Z);
  const stacker = buildStacker();
  stacker.group.position.set(YARD.x, g, YARD.z);
  const ridges = new Builder('coal-ridges');
  addRidge(ridges, -YARD.ridgeGap / 2 - 6, YARD.length, 26, 15);
  addRidge(ridges, YARD.ridgeGap / 2 + 6, YARD.length * 0.82, 24, 12);
  const piles = ridges.build();
  piles.group.position.set(YARD.x, g - 0.5, YARD.z);
  // belts: dumper → junction tower J1 → (yard belt west / crusher) → gallery to the bunker bay
  const j1 = new Vector3(-104, g + 16, 58);
  const hopper = new Vector3(DUMPER.x + 10, g + 2.5, SIDING_Z - 4);
  const crusherIn = new Vector3(CRUSHER.x - 4, g + CRUSHER.h - 2, CRUSHER.z + 6);
  const bunkerTop = new Vector3(BUNKER.x - BUNKER.w / 2 + 2, g + BUNKER.h - 2, BUNKER.z + 6);
  const belts = [
    conveyor({ from: [hopper.x, hopper.y, hopper.z], to: [j1.x - 3, j1.y, j1.z + 2], load: 'ink' }),
    conveyor({ from: [YARD.x + YARD.length / 2 + 4, g + 2.6, YARD.z], to: [YARD.x - YARD.length / 2, g + 2.6, YARD.z], load: 'ink', density: 1 }),
    conveyor({ from: [j1.x + 2, j1.y, j1.z - 3], to: [crusherIn.x, crusherIn.y, crusherIn.z + 4], load: 'ink' }),
  ];
  const galleryFrom = new Vector3(CRUSHER.x + 4, g + CRUSHER.h - 2, CRUSHER.z - 4);
  const gallery = buildGallery(galleryFrom, bunkerTop);
  belts.push(conveyor({ from: [galleryFrom.x, galleryFrom.y, galleryFrom.z], to: [bunkerTop.x, bunkerTop.y, bunkerTop.z], load: 'ink' }));
  for (const c of belts) c.speed = 3;
  noShadow(...belts.map((c) => c.group));
  // junction tower and crusher house
  const houses = new Builder('transfer-houses');
  houses.box(9, j1.y - g + 4, 9, { r: 0.3, c: ['steel', 'mist'], at: [j1.x, g, j1.z] });
  houses.box(10, 1, 10, { r: 0.2, slot: 'gloss', c: 'amber', at: [j1.x, j1.y + 4, j1.z] });
  houses.box(16, CRUSHER.h, 14, { r: 0.4, c: ['steel', 'mist'], at: [CRUSHER.x, g, CRUSHER.z] });
  houses.box(17, 1.2, 15, { r: 0.2, slot: 'gloss', c: 'amber', at: [CRUSHER.x, g + CRUSHER.h, CRUSHER.z] });
  for (const k of [0, 1, 2]) houses.box(3, 2.2, 0.3, { r: 0, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.3), at: [CRUSHER.x - 4 + k * 4, g + 10, CRUSHER.z + 7.1] });
  models.push(dumper, stacker, piles, gallery, houses.build(), ...belts);
  return {
    models,
    dumper,
    stacker,
    belts,
    hopper: hopper.clone(),
    bunkerTop,
    setDrum(angle) {
      dumper.part('drum').rotation.x = angle;
    },
    setStacker(along) {
      stacker.part('machine').position.x = along * (YARD.length / 2 - 8);
    },
    update(dt, t) {
      for (const c of belts) c.update(dt, t);
      stacker.part('wheel').rotation.x -= dt * 0.8;
    },
  };
}
