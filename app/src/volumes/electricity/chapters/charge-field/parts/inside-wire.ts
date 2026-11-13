/**
 * Step 8, «Зазирнути в дріт»: two windows side by side — copper, where every atom has given one electron to
 * a common "sea" that drifts when the circuit is closed, and glass, where every electron stays tied to its
 * atom. A preview of the next chapter (`matter/lattice`), deliberately schematic.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createGas, createOrbs } from '@/fx';
import { Builder } from '@/kit';
import { BRIDGE } from '../layout';

const W = 2.5;
const H = 2.0;
const COLS = 4;
const ROWS = 3;

export interface InsideWire {
  group: Group;
  /** Centres of the two windows (callout anchors, world space). */
  copper: Vector3;
  glass: Vector3;
  /** −1…1: drift of the electron sea (sign = direction, 0 = open circuit). */
  drift: number;
  update(dt: number, t: number): void;
}

export function createInsideWire(ctx: ChapterContext): InsideWire {
  const group = new Group();
  group.name = 'inside-wire';
  group.position.copy(BRIDGE.inside);
  const b = new Builder('inside-frames');
  for (const [x, tone] of [
    [-1.5, 'orange'],
    [1.5, 'sky'],
  ] as const) {
    b.box(W + 0.3, H + 0.3, 0.12, { r: 0.1, c: 'bg.deep', at: [x, 0, -0.45], mid: true });
    for (const y of [-1, 1])
      b.box(W + 0.5, 0.14, 1.0, {
        r: 0.06,
        slot: 'gloss',
        c: tone,
        at: [x, (y * (H + 0.3)) / 2, 0],
        mid: true,
      });
    for (const k of [-1, 1])
      b.box(0.14, H + 0.3, 1.0, {
        r: 0.06,
        slot: 'gloss',
        c: tone,
        at: [x + (k * (W + 0.4)) / 2, 0, 0],
        mid: true,
      });
  }
  group.add(b.build().group);
  const n = COLS * ROWS;
  const site = (i: number, out: Vector3): Vector3 =>
    out.set(
      (((i % COLS) + 0.5) / COLS - 0.5) * W * 0.86,
      ((Math.floor(i / COLS) + 0.5) / ROWS - 0.5) * H * 0.82,
      0,
    );
  const p = new Vector3();
  // copper: ions on the lattice + the free electron sea
  const ions = createOrbs({ kind: 'ion', color: 'orange', glyph: 'plus', count: n, radius: 0.17 });
  for (let i = 0; i < n; i++) ions.setPosition(i, site(i, p).x - 1.5, p.y, 0);
  ions.commit();
  const sea = createGas(ctx, {
    kind: 'electron',
    count: 34,
    radius: 0.06,
    box: [W * 0.92, H * 0.88, 0.5],
    drift: [0, 0, 0],
  });
  sea.position.x = -1.5;
  // glass: atoms with their electrons circling close by
  const atoms = createOrbs({ kind: 'neutron', count: n, radius: 0.17 });
  for (let i = 0; i < n; i++) atoms.setPosition(i, site(i, p).x + 1.5, p.y, 0);
  atoms.commit();
  const bound = createOrbs({ kind: 'electron', count: n * 2, radius: 0.055 });
  group.add(ions, sea, atoms, bound);
  const inside: InsideWire = {
    group,
    copper: new Vector3(BRIDGE.inside.x - 1.5, BRIDGE.inside.y + H / 2 + 0.3, BRIDGE.inside.z),
    glass: new Vector3(BRIDGE.inside.x + 1.5, BRIDGE.inside.y + H / 2 + 0.3, BRIDGE.inside.z),
    drift: 0,
    update(_dt, t) {
      sea.drift.x = 0.9 * inside.drift;
      for (let i = 0; i < n * 2; i++) {
        site(i >> 1, p);
        const a = t * 3.1 + i * 2.2;
        bound.setPosition(
          i,
          p.x + 1.5 + Math.cos(a) * 0.27,
          p.y + Math.sin(a) * 0.27,
          0.1 * Math.sin(a * 0.7),
        );
      }
      bound.commit();
    },
  };
  return inside;
}
