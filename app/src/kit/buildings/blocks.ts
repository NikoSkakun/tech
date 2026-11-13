/**
 * Multi-storey buildings: the prefabricated apartment block («панелька») with coloured balconies, stairwell
 * windows and entrance canopies, and a glazed office block with roof plant. Windows are plain panes (cheap),
 * a seeded share of them lit at night. Front faces +Z. Units: metres.
 */
import { Rng } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';

const glass = () => col('blue.dark').lerp(col('sky'), 0.3);

export interface ApartmentOptions {
  /** Storeys (typically 5, 9 or 16). Default 9. */
  floors?: number;
  /** Entrance sections side by side. Default 2. */
  sections?: number;
  color?: ColorLike;
  /** Balcony panel colours, cycled by floor. */
  accents?: readonly ColorLike[];
  lit?: number;
  seed?: number;
}

/** Anchors: `roof`, `entranceN` (door of section N), `service` (cable entry at the end wall). */
export function addApartmentBlock(b: Builder, o: ApartmentOptions = {}): void {
  const rng = new Rng((o.seed ?? 1) * 104729 + 7);
  const floors = o.floors ?? 9;
  const sections = o.sections ?? 2;
  const wall = col(o.color ?? col('mist').lerp(col('white'), 0.45));
  const accents = o.accents ?? ['sky', 'coral', 'lime', 'yellow'];
  const lit = o.lit ?? 0.6;
  const fh = 2.8;
  const bay = 3.1;
  const W = sections * 4 * bay;
  const D = 11;
  const H = floors * fh;
  const seam = wall.clone().multiplyScalar(0.8);
  b.box(W + 0.3, 1.0, D + 0.3, { r: 0.08, slot: 'matte', c: col('steel').lerp(col('violet'), 0.2), at: [0, -0.1, 0] });
  b.box(W, H, D, { r: 0.1, c: [wall.clone().multiplyScalar(0.86), wall], at: [0, 0.9, 0] });
  // panel seams: one line per floor, one per bay
  for (let f = 1; f < floors; f++) b.box(W + 0.04, 0.07, D + 0.04, { r: 0, c: seam, at: [0, 0.9 + f * fh, 0] });
  for (let i = 1; i < sections * 4; i++) b.box(0.07, H, D + 0.04, { r: 0, c: seam, at: [-W / 2 + i * bay, 0.9, 0] });
  const pane = (x: number, y: number, z: number, w: number, h: number, back: boolean): void => {
    const s = back ? -1 : 1;
    b.box(w + 0.2, h + 0.2, 0.08, { r: 0, c: 'white', at: [x, y - 0.1, z + s * 0.01] });
    b.box(w, h, 0.08, { r: 0, slot: rng.next() < lit ? 'window' : 'gloss', c: glass(), at: [x, y, z + s * 0.04] });
  };
  for (let s = 0; s < sections; s++) {
    const x0 = -W / 2 + s * 4 * bay;
    for (let f = 0; f < floors; f++) {
      const y = 0.9 + f * fh + 0.95;
      for (let i = 0; i < 4; i++) {
        const x = x0 + (i + 0.5) * bay;
        pane(x, y, -D / 2, 1.5, 1.4, true);
        const stair = i === 1;
        if (stair) {
          // stairwell: narrow window between floors
          if (f > 0) pane(x, y - fh * 0.5, D / 2, 0.9, 1.1, false);
          continue;
        }
        pane(x, y, D / 2, i === 2 ? 1.5 : 2.0, 1.4, false);
        if (i !== 2 && f > 0) {
          // balcony: slab + coloured parapet panel; every third one glazed in
          const c = col(accents[(f + s) % accents.length]!);
          b.box(2.7, 0.14, 1.1, { r: 0.03, c: seam, at: [x, y - 1.0, D / 2 + 0.5] });
          b.box(2.7, 1.0, 0.1, { r: 0.03, c: [c.clone().multiplyScalar(0.85), c], at: [x, y - 0.9, D / 2 + 1.0] });
          for (const sx of [-1, 1]) b.box(0.08, 1.0, 1.0, { r: 0, c: seam, at: [x + sx * 1.31, y - 0.9, D / 2 + 0.5] });
          if (rng.next() < 0.35) b.box(2.6, 1.3, 0.08, { r: 0, slot: rng.next() < lit ? 'window' : 'gloss', c: glass(), at: [x, y + 0.1, D / 2 + 1.0] });
        }
      }
    }
    // entrance: canopy on posts, door, steps, lamp
    const ex = x0 + 1.5 * bay;
    b.box(3.0, 0.2, 2.2, { r: 0.06, c: seam, at: [ex, 3.3, D / 2 + 1.1] });
    for (const sx of [-1, 1]) b.cyl(0.09, 2.6, { seg: 6, slot: 'metal', c: 'slate', at: [ex + sx * 1.3, 0.7, D / 2 + 2.0] });
    b.box(1.5, 2.2, 0.12, { r: 0.04, c: 'slate', at: [ex, 0.9, D / 2 + 0.04] });
    b.box(3.2, 0.3, 2.4, { r: 0.05, slot: 'matte', c: 'steel.light', at: [ex, 0.6, D / 2 + 1.2] });
    b.sphere(0.14, { seg: 8, slot: 'lamp', c: col('yellow').lerp(col('white'), 0.3), at: [ex, 3.2, D / 2 + 1.6] });
    b.anchor(`entrance${s + 1}`, ex, 1.6, D / 2 + 2.4);
    // roof: lift machine room and vent stack per section
    b.box(4.2, 2.4, 3.6, { r: 0.08, c: wall.clone().multiplyScalar(0.92), at: [ex, 0.9 + H + 0.3, -1] });
    b.cyl(0.3, 1.1, { seg: 8, slot: 'metal', c: 'steel', at: [x0 + 3.2 * bay, 0.9 + H + 0.3, 2] });
  }
  b.box(W + 0.2, 0.5, D + 0.2, { r: 0.06, c: seam, at: [0, 0.9 + H - 0.1, 0] });
  b.box(W - 0.3, 0.1, D - 0.3, { r: 0, slot: 'matte', c: col('slate').lerp(col('steel'), 0.3), at: [0, 0.9 + H + 0.32, 0] });
  b.cyl(0.04, 3.2, { seg: 5, slot: 'metal', c: 'slate', at: [W * 0.3, 0.9 + H + 0.3, -2], bevel: 0 });
  b.anchor('roof', 0, 0.9 + H + 0.4, 0);
  b.anchor('service', -W / 2, 2.5, 0);
}

export function apartmentBlock(o: ApartmentOptions = {}): KitModel {
  const b = new Builder('apartment-block');
  addApartmentBlock(b, o);
  return b.build();
}

export interface OfficeOptions {
  floors?: number;
  width?: number;
  depth?: number;
  color?: ColorLike;
  lit?: number;
  seed?: number;
}

/** Glazed office block: window bands with mullion fins, lobby, roof plant with a red beacon. Anchors: `roof`, `entrance`, `beacon`. */
export function addOfficeBlock(b: Builder, o: OfficeOptions = {}): void {
  const rng = new Rng((o.seed ?? 1) * 15485863 + 3);
  const floors = o.floors ?? 8;
  const W = o.width ?? 22;
  const D = o.depth ?? 16;
  const fh = 3.4;
  const H = floors * fh + 1.2;
  const frame = col(o.color ?? 'white');
  const lit = o.lit ?? 0.5;
  b.box(W + 0.6, 0.5, D + 0.6, { r: 0.1, slot: 'matte', c: 'steel', at: [0, -0.1, 0] });
  b.box(W - 0.3, H, D - 0.3, { r: 0.1, slot: 'gloss', c: glass().multiplyScalar(0.8), at: [0, 0.4, 0] });
  const bays = Math.round(W / 2.8);
  const sideBays = Math.round(D / 2.8);
  for (let f = 0; f < floors; f++) {
    const y = 0.4 + 1.2 + f * fh;
    // spandrel band between floors, then one pane per bay on all four sides
    b.box(W, 0.9, D, { r: 0.06, c: [frame.clone().multiplyScalar(0.86), frame], at: [0, y + fh - 0.9, 0] });
    for (let i = 0; i < bays; i++) {
      const x = ((i + 0.5) / bays - 0.5) * (W - 0.6);
      for (const s of [-1, 1]) b.box(W / bays - 0.5, fh - 1.1, 0.1, { r: 0, slot: rng.next() < lit ? 'window' : 'gloss', c: glass(), at: [x, y + 0.1, s * (D / 2 - 0.12)] });
    }
    for (let i = 0; i < sideBays; i++) {
      const z = ((i + 0.5) / sideBays - 0.5) * (D - 0.6);
      for (const s of [-1, 1]) b.box(0.1, fh - 1.1, D / sideBays - 0.5, { r: 0, slot: rng.next() < lit ? 'window' : 'gloss', c: glass(), at: [s * (W / 2 - 0.12), y + 0.1, z] });
    }
  }
  for (let i = 0; i <= bays; i++) {
    const x = (i / bays - 0.5) * (W - 0.3);
    for (const s of [-1, 1]) b.box(0.16, H - 1.2, 0.3, { r: 0.04, c: frame, at: [x, 1.6, s * (D / 2 - 0.02)] });
  }
  // lobby and entrance canopy
  b.box(5, 0.25, 3, { r: 0.08, c: frame, at: [0, 3.3, D / 2 + 1.3] });
  b.box(3.4, 2.6, 0.12, { r: 0.04, slot: 'window', c: glass(), at: [0, 0.5, D / 2 - 0.05] });
  b.anchor('entrance', 0, 1.5, D / 2 + 2.5);
  // roof: parapet, plant room, two chillers, mast with beacon
  const top = 0.4 + H;
  b.box(W + 0.2, 0.6, D + 0.2, { r: 0.08, c: frame, at: [0, top - 0.2, 0] });
  b.box(W * 0.4, 2.6, D * 0.4, { r: 0.1, c: frame.clone().multiplyScalar(0.9), at: [-W * 0.15, top + 0.3, 0] });
  for (const z of [-D * 0.25, D * 0.25]) {
    b.box(3, 1.4, 2, { r: 0.08, slot: 'metal', c: 'steel.light', at: [W * 0.28, top + 0.3, z] });
    b.cyl(0.7, 0.12, { seg: 12, slot: 'metal', c: 'slate', at: [W * 0.28, top + 1.7, z] });
  }
  b.cyl(0.07, 5, { seg: 6, slot: 'metal', c: 'slate', at: [-W * 0.15, top + 2.9, 0], bevel: 0 });
  b.sphere(0.2, { seg: 8, slot: 'glow', c: 'red', at: [-W * 0.15, top + 8, 0] });
  b.anchor('beacon', -W * 0.15, top + 8, 0);
  b.anchor('roof', 0, top + 0.4, 0);
}

export function officeBlock(o: OfficeOptions = {}): KitModel {
  const b = new Builder('office-block');
  addOfficeBlock(b, o);
  return b.build();
}
