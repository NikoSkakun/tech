/**
 * The «рулет» of a cylindrical cell and its unrolling. `amount` 0…1 is a pure function of state (random-access
 * safe): 0 = the roll sits in the can · 0.18 = lifted out · 0.36 = laid on its side at the start of the
 * runway · 1 = fully unrolled into a carpet of four sheets whose free ends are cut back like a staircase.
 *
 * Sheets, bottom → top: separator (white) · cathode coating (violet) on Al foil (bare `mist` edge) ·
 * separator · graphite (ink) on Cu foil (bare copper edge). Unrolled length follows the Archimedean spiral:
 * L = π·(R² − r_i²)/pitch, and the remaining roll shrinks as r(s)² = R² − pitch·s/π.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Group,
  Mesh,
  Object3D,
  RingGeometry,
  type Vector3,
} from 'three';
import { Builder } from '@/kit';
import { K, col, type ColorLike } from '@/style';
import type { Mats } from '../world';
import { group } from '../world';

const R0 = 0.31; // outer radius of the roll
const RI = 0.06; // mandrel radius
const PITCH = 0.047; // radial growth per turn (four sheets), toy-thick
const HEIGHT = 2.0; // roll height = sheet width
export const ROLL_LENGTH = (Math.PI * (R0 * R0 - RI * RI)) / PITCH; // ≈ 6.2 units
const NSEG = 120;
const GAP = 0.15; // vertical spread of the unrolled sheets
const CUT = 0.46; // staircase step at the free end

/** z-extent and colours of each sheet: [coated from, coated to, bare to] across the width. */
const SHEETS: readonly { z: [number, number, number]; coat: ColorLike; bare: ColorLike }[] = [
  { z: [-1.0, 1.0, 1.0], coat: 'white', bare: 'white' },
  { z: [0.84, -0.7, -0.94], coat: 'violet', bare: 'mist' },
  { z: [-1.0, 1.0, 1.0], coat: 'white', bare: 'white' },
  { z: [-0.86, 0.68, 0.92], coat: 'ink', bare: 'orange' },
];

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export interface JellyRoll {
  group: Group;
  /** The remaining roll (a solid with spiral end faces). */
  roll: Group;
  /** Points on the exposed "stairs" of the four sheets (callout / hotspot anchors), bottom → top. */
  layers: Object3D[];
  /** Anchor in the gap between the sheets (electrolyte). */
  mist: Object3D;
  amount: number;
}

/**
 * `rest` — centre of the roll inside the can; `start` — where the unrolled carpet begins (floor level).
 * The carpet runs along +X from `start`, its width along Z.
 */
export function createJellyRoll(mats: Mats, rest: Vector3, start: Vector3): JellyRoll {
  const g = group('jelly-roll');
  /* --------------------------------------------------------------------------------- the solid roll */
  const b = new Builder('roll');
  b.cyl(R0, HEIGHT, { at: [0, -HEIGHT / 2, 0], seg: 48, c: 'white', bevel: 0 });
  const bands: ColorLike[] = ['ink', 'white', 'violet', 'white'];
  for (let i = 0; i < 12; i++) {
    const r1 = R0 - (i * (R0 - RI)) / 12;
    const ring = new RingGeometry(r1 - (R0 - RI) / 12 + 0.002, r1, 48);
    b.add(ring, {
      at: [0, HEIGHT / 2 + 0.002, 0],
      rot: [-Math.PI / 2, 0, 0],
      c: bands[i % 4]!,
      slot: 'double',
    });
    b.add(ring, {
      at: [0, -HEIGHT / 2 - 0.002, 0],
      rot: [Math.PI / 2, 0, 0],
      c: bands[i % 4]!,
      slot: 'double',
    });
  }
  b.cyl(RI, HEIGHT + 0.08, { at: [0, -HEIGHT / 2 - 0.04, 0], seg: 16, slot: 'metal', c: 'steel' });
  const roll = group('roll', 0, 0, 0, [b.build().group]);
  g.add(roll);

  /* ------------------------------------------------------------------------------- unrolled sheets */
  const rows = NSEG + 1;
  const perSheet = rows * 4; // two strips (coated + bare edge), two vertices per row each
  const position = new Float32Array(SHEETS.length * perSheet * 3);
  const color = new Float32Array(position.length);
  const normal = new Float32Array(position.length);
  const index: number[] = [];
  SHEETS.forEach((sheet, k) => {
    const cCoat = col(sheet.coat);
    const cBare = col(sheet.bare);
    for (let i = 0; i < rows; i++) {
      for (let v = 0; v < 4; v++) {
        const o = (k * perSheet + i * 4 + v) * 3;
        (v < 2 ? cCoat : cBare).toArray(color, o);
        normal[o + 1] = 1;
      }
      if (i === NSEG) continue;
      const a = k * perSheet + i * 4;
      index.push(a, a + 1, a + 4, a + 1, a + 5, a + 4, a + 2, a + 3, a + 6, a + 3, a + 7, a + 6);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  geometry.setAttribute('color', new BufferAttribute(color, 3));
  geometry.setIndex(index);
  const sheets = new Mesh(
    geometry,
    K.toon({ color: 'white', vertexColors: true, side: DoubleSide, highlight: 0.3 }),
  );
  sheets.frustumCulled = false;
  sheets.castShadow = true;
  sheets.receiveShadow = true;
  // electrolyte: a faint blue haze soaking the gaps between the sheets
  const haze = new Mesh(new BoxGeometry(1, GAP * 3, HEIGHT * 0.96), mats.electrolyte);
  haze.renderOrder = 3;
  const layers = SHEETS.map(() => new Object3D());
  const mist = new Object3D();
  g.add(sheets, haze, mist, ...layers);

  /* ---------------------------------------------------------------------------------- amount → pose */
  const LIFT = 2.9;
  const lifted = rest.clone().setY(rest.y + LIFT);
  const lying = start.clone().setY(start.y + R0 + 0.02);
  let amount = -1;
  const apply = (u: number): void => {
    const a = smooth(0, 0.18, u);
    const tilt = smooth(0.18, 0.36, u);
    const s = Math.min(Math.max((u - 0.36) / 0.64, 0), 1) * ROLL_LENGTH;
    const r = Math.sqrt(Math.max(R0 * R0 - (PITCH * s) / Math.PI, RI * RI));
    // lift out of the can → fly over and lie down → roll along +X while shrinking
    roll.position.lerpVectors(rest, lifted, a).lerp(lying, tilt);
    roll.position.y += Math.sin(tilt * Math.PI) * 0.5;
    if (s > 0) roll.position.set(start.x + s, start.y + r + 0.02, start.z);
    roll.rotation.set((tilt * Math.PI) / 2, -((2 * Math.PI) / PITCH) * (R0 - r), 0);
    roll.scale.set(r / R0, 1, r / R0);

    const spread = smooth(0.3, 1.4, s);
    const xEnd = start.x + s;
    const half = HEIGHT / 2;
    SHEETS.forEach((sheet, k) => {
      const x0 = Math.min(start.x + k * CUT, xEnd);
      for (let i = 0; i < rows; i++) {
        const x = x0 + ((xEnd - x0) * i) / NSEG;
        const y = start.y + 0.012 * (k + 1) + k * GAP * spread * smooth(0, 0.9, xEnd - x);
        const zs = [sheet.z[0], sheet.z[1], sheet.z[1], sheet.z[2]];
        for (let v = 0; v < 4; v++) {
          const o = (k * perSheet + i * 4 + v) * 3;
          position[o] = x;
          position[o + 1] = y;
          position[o + 2] = start.z + zs[v]! * half;
        }
      }
      layers[k]!.position.set(
        start.x + k * CUT + 0.23,
        start.y + k * GAP * spread,
        start.z + (k % 2 ? 0.5 : 0.85),
      );
    });
    geometry.attributes.position!.needsUpdate = true;
    sheets.visible = s > 0.01;
    const hazeLength = s - 3 * CUT - 0.7;
    haze.visible = hazeLength > 0.2;
    haze.scale.x = Math.max(hazeLength, 0.01);
    haze.position.set(start.x + 3 * CUT + hazeLength / 2, start.y + 1.5 * GAP * spread, start.z);
    mist.position.set(haze.position.x, haze.position.y, start.z + half);
  };

  const jelly: JellyRoll = {
    group: g,
    roll,
    layers,
    mist,
    get amount() {
      return amount;
    },
    set amount(u: number) {
      const v = Math.min(Math.max(u, 0), 1);
      if (v === amount) return;
      amount = v;
      apply(v);
    },
  };
  jelly.amount = 0;
  return jelly;
}
