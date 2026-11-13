/**
 * Bridges: a straight deck between two points with railings, on piers (`beam`), a stone arch (`arch`) or with
 * a steel through-truss (`truss`, the classic railway bridge). Units: metres.
 */
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel, type V3 } from '../core/builder';
import * as G from '../core/geo';

const mix = (a: ColorLike, b: ColorLike, t: number) => col(a).lerp(col(b), t);

export interface BridgeOptions {
  /** Deck end points (top of the deck). */
  from: V3;
  to: V3;
  /** Deck width. Default 7. */
  width?: number;
  kind?: 'beam' | 'arch' | 'truss';
  /** Height of the piers / arch below the deck (to the water or valley floor). Default 8. */
  clearance?: number;
  /** Number of spans (piers = spans − 1). Default: one per ~22 m. */
  spans?: number;
  color?: ColorLike;
}

/** Add a bridge. Anchors: `start`, `end`, `mid`. The deck's top surface runs exactly from `from` to `to`. */
export function addBridge(b: Builder, o: BridgeOptions): void {
  const kind = o.kind ?? 'beam';
  const width = o.width ?? 7;
  const clearance = o.clearance ?? 8;
  const dx = o.to[0] - o.from[0];
  const dy = o.to[1] - o.from[1];
  const dz = o.to[2] - o.from[2];
  const flat = Math.hypot(dx, dz);
  const length = Math.hypot(flat, dy);
  const spans = o.spans ?? Math.max(1, Math.round(length / 22));
  const concrete = mix('mist', 'steel.light', 0.35);
  const steel = col(o.color ?? (kind === 'truss' ? 'teal.dark' : 'slate'));
  // local frame: +Z along the deck, origin at `from`
  b.frame({ at: o.from, rot: [-Math.atan2(dy, flat), Math.atan2(dx, dz), 0] }, () => {
    b.box(width, 0.7, length, { r: 0.12, slot: 'matte', c: [concrete.clone().multiplyScalar(0.82), concrete], at: [0, -0.7, length / 2] });
    b.box(width - 1.4, 0.06, length - 0.4, { r: 0, slot: 'matte', c: mix('slate', 'steel', 0.28), at: [0, -0.02, length / 2] });
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - 0.18);
      b.box(0.36, 0.25, length, { r: 0.06, slot: 'matte', c: concrete, at: [x, 0, length / 2] });
      if (kind === 'truss') continue;
      for (let i = 0; i <= Math.round(length / 2.5); i++) {
        b.cyl(0.06, 1.05, { seg: 5, slot: 'metal', c: steel, at: [x, 0.2, (i / Math.round(length / 2.5)) * (length - 0.3) + 0.15], bevel: 0 });
      }
      b.beam([x, 1.25, 0.1], [x, 1.25, length - 0.1], 0.1, { slot: 'metal', c: steel });
      b.beam([x, 0.75, 0.1], [x, 0.75, length - 0.1], 0.06, { slot: 'metal', c: steel });
    }
    if (kind === 'truss') {
      const h = Math.min(7, length * 0.2);
      const panels = Math.max(4, Math.round(length / 6));
      const step = length / panels;
      for (const side of [-1, 1]) {
        const x = side * (width / 2 - 0.25);
        b.beam([x, h, step], [x, h, length - step], 0.36, { slot: 'metal', c: steel });
        for (let i = 0; i < panels; i++) {
          const z0 = i * step;
          const up = i % 2 === 0;
          // Warren truss: alternating diagonals, verticals at the upper nodes
          b.beam([x, up ? 0.2 : h, z0], [x, up ? h : 0.2, z0 + step], 0.28, { slot: 'metal', c: steel });
          if (i > 0 && i < panels) b.beam([x, 0.2, z0], [x, h, z0], 0.18, { slot: 'metal', c: steel });
        }
      }
      for (let i = 1; i < panels; i++) b.beam([-(width / 2 - 0.25), h, i * step], [width / 2 - 0.25, h, i * step], 0.2, { slot: 'metal', c: steel });
    }
    if (kind === 'arch') {
      const span = length / spans;
      const rise = Math.min(clearance * 0.75, span * 0.42);
      for (let s = 0; s < spans; s++) {
        // arch ring: an extruded crescent standing under the deck
        const outline: G.Pt[] = [];
        for (let i = 0; i <= 14; i++) outline.push([(i / 14) * span, -0.7 - (1 - Math.sin((i / 14) * Math.PI)) * rise]);
        outline.push([span, -0.6], [0, -0.6]);
        b.add(G.extrude(outline.reverse(), width - 1.2, { bevel: 0.1 }), { slot: 'matte', c: concrete.clone().multiplyScalar(0.92), at: [0, 0, s * span], rot: [0, -Math.PI / 2, 0] });
      }
    }
    for (let i = kind === 'arch' ? 0 : 1; i < spans + (kind === 'arch' ? 1 : 0); i++) {
      const z = (i / spans) * length;
      const pierW = kind === 'arch' ? width - 0.8 : width * 0.55;
      b.box(pierW, clearance + 0.5, kind === 'arch' ? 2.2 : 1.4, { r: 0.3, slot: 'matte', c: [mix('steel', 'violet', 0.2), concrete], at: [0, -0.7 - clearance - 0.5, z] });
      if (kind !== 'arch') b.box(width * 0.8, 0.7, 1.8, { r: 0.2, slot: 'matte', c: concrete, at: [0, -1.4, z] });
    }
    b.anchor('start', 0, 0, 0);
    b.anchor('mid', 0, 0, length / 2);
    b.anchor('end', 0, 0, length);
  });
}

export function bridge(o: BridgeOptions): KitModel {
  const b = new Builder('bridge');
  addBridge(b, o);
  return b.build();
}
