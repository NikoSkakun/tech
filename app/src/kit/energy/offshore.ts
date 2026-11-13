/**
 * Offshore hardware: jacket foundation, semi-submersible floater, substation / HVDC topsides, scour protection,
 * jack-up installation vessel. All functions add into the caller's builder at the current frame; y = 0 is the
 * sea surface. Units: metres.
 *
 * Moved into the kit in M3 from the pilot chapter `plant-wind` (`parts/offshore-models.ts`, which still has its
 * own copy) — plant-ocean and transmission / HVDC chapters use these.
 */
import type { Builder, V3 } from '../core/builder';
import { addRailing } from '../industrial/structures';
import { bladeGeometry } from './wind-blade';

/** Four-legged lattice jacket from the sea bed (`depth` below the surface) up to a deck at `top`. */
export function addJacket(b: Builder, depth: number, top = 7, foot = 5.2, head = 2.3): void {
  const levels = 4;
  const corner = (s: number, i: number, y: number): V3 => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    return [Math.cos(a) * s * Math.SQRT2, y, Math.sin(a) * s * Math.SQRT2];
  };
  const half = (t: number): number => foot + (head - foot) * t;
  for (let i = 0; i < 4; i++) {
    b.rod(corner(foot, i, -depth), corner(head, i, top), 0.42, { c: 'yellow', slot: 'gloss', seg: 10 });
    b.cyl(0.9, 1.6, { c: 'slate', at: corner(foot, i, -depth - 0.4), seg: 10 }); // pile sleeve in the sea bed
    for (let l = 0; l < levels; l++) {
      const t0 = l / levels;
      const t1 = (l + 1) / levels;
      const y0 = -depth + (top + depth) * t0;
      const y1 = -depth + (top + depth) * t1;
      const j = (i + 1) % 4;
      b.rod(corner(half(t0), i, y0), corner(half(t1), j, y1), 0.2, { c: 'amber', slot: 'gloss', seg: 6 });
      b.rod(corner(half(t0), j, y0), corner(half(t1), i, y1), 0.2, { c: 'amber', slot: 'gloss', seg: 6 });
      b.rod(corner(half(t1), i, y1), corner(half(t1), j, y1), 0.2, { c: 'amber', slot: 'gloss', seg: 6 });
    }
  }
  b.box(head * 2 + 2.2, 0.5, head * 2 + 2.2, { r: 0.15, c: 'steel', slot: 'metal', at: [0, top, 0] });
  const e = head + 1;
  const y = top + 0.5;
  const ring: V3[] = [[-e, y, -e], [e, y, -e], [e, y, e], [-e, y, e]];
  ring.forEach((p, i) => addRailing(b, p, ring[(i + 1) % 4]!, { c: 'yellow' }));
}

/** Semi-submersible floater: three buoyancy columns with heave plates around a centre column, braces. */
export function addFloater(b: Builder, radius = 8.5, draft = 6): void {
  b.cyl(1.5, draft + 4.5, { c: ['amber', 'yellow'], slot: 'gloss', at: [0, -draft, 0], seg: 18 });
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    b.cyl(2.0, draft + 3.6, { c: ['amber', 'yellow'], slot: 'gloss', at: [x, -draft, z], seg: 20 });
    b.cyl(3.3, 0.7, { c: 'slate', at: [x, -draft - 0.7, z], seg: 20 }); // heave plate
    b.cyl(2.1, 0.3, { c: 'steel', slot: 'metal', at: [x, 3.6, z], seg: 20 });
    b.rod([0, 2.6, 0], [x, 2.6, z], 0.45, { c: 'yellow', slot: 'gloss' });
    b.rod([0, -draft + 0.8, 0], [x, -draft + 0.8, z], 0.45, { c: 'yellow', slot: 'gloss' });
    b.rod([0, 2.6, 0], [x, -draft + 0.8, z], 0.26, { c: 'amber', slot: 'gloss' });
    b.anchor(`fairlead${i}`, x * 1.22, -draft + 0.6, z * 1.22);
  }
}

/** Ring of dumped rock around a pile at the sea bed (scour protection). */
export function addScour(b: Builder, r: number, rand: () => number): void {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.3;
    const d = r * (1.5 + rand() * 1.5);
    b.dome(0.7 + rand() * 0.9, 0.5 + rand() * 0.5, { c: i % 3 ? 'steel' : 'slate', slot: 'facet', seg: 6, at: [Math.cos(a) * d, 0, Math.sin(a) * d] });
  }
}

/**
 * Platform topside on a jacket deck (origin = deck centre): `ac` = offshore substation 66/220 kV (transformer
 * with radiators, switchgear house, helideck); `hvdc` = converter platform (a large valve hall — power
 * electronics are `violet` in this chapter — with DC wall bushings: + coral, − blue).
 */
export function addTopside(b: Builder, kind: 'ac' | 'hvdc'): void {
  const hv = kind === 'hvdc';
  const w = hv ? 17 : 11;
  const d = hv ? 11 : 8;
  const h = hv ? 9.5 : 5.5;
  b.box(w + 2, 0.7, d + 2, { r: 0.2, c: 'steel', slot: 'metal' });
  b.box(w, h, d, { r: 0.5, c: hv ? ['violet.dark', 'violet'] : ['mist', 'white'], slot: 'gloss', at: [0, 0.7, 0] });
  for (let i = 0; i < (hv ? 5 : 3); i++) b.box(1.5, 0.9, 0.12, { r: 0.05, c: 'blue.dark', slot: 'window', at: [-w / 2 + 2 + i * 3, 0.7 + h * 0.55, d / 2] });
  b.box(w * 0.5, 0.4, d * 0.6, { r: 0.1, c: 'slate', slot: 'gloss', at: [-w * 0.2, 0.7 + h, 0] });
  // helideck on a corner, crane pedestal, antenna with a beacon
  b.cyl(3.2, 0.3, { c: 'teal.dark', slot: 'gloss', seg: 8, at: [w * 0.34, h + 1.6, -d * 0.2] });
  b.ring(2.1, 0.12, { c: 'yellow', slot: 'gloss', seg: 24, tubeSeg: 4, at: [w * 0.34, h + 1.93, -d * 0.2] });
  b.cyl(0.35, 1.2, { c: 'steel', slot: 'metal', seg: 8, at: [w * 0.34, h + 0.7, -d * 0.2] });
  b.cyl(0.12, 3.4, { c: 'slate', seg: 6, at: [-w * 0.42, h + 0.7, d * 0.3], bevel: 0 });
  b.sphere(0.3, { c: 'red', slot: 'glow', seg: 8, at: [-w * 0.42, h + 4.3, d * 0.3] });
  if (hv) {
    // DC side: two wall bushings toward the export cables
    ([['coral', -1.6], ['blue', 1.6]] as const).forEach(([c, z]) => {
      b.cyl(0.32, 3.2, { axis: 'x', c: 'mist', slot: 'gloss', seg: 10, at: [-w / 2 - 3.2, 0.7 + h * 0.5, z], rTop: 0.2 });
      b.sphere(0.42, { c, slot: 'gloss', seg: 10, at: [-w / 2 - 3.3, 0.7 + h * 0.5, z] });
    });
    b.anchor('dcPlus', -w / 2 - 3.3, 0.7 + h * 0.5, -1.6);
    b.anchor('dcMinus', -w / 2 - 3.3, 0.7 + h * 0.5, 1.6);
  } else {
    // transformer with radiator banks on the open deck end
    b.box(3.2, 3.0, 2.4, { r: 0.25, c: ['steel', 'mist'], slot: 'gloss', at: [-w / 2 - 2.4, 0.7, 0] });
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) b.box(0.16, 2.2, 1.0, { r: 0.04, c: 'slate', at: [-w / 2 - 3.5 + i * 0.7, 0.9, s * 1.9] });
    for (let k = 0; k < 3; k++) b.cyl(0.16, 1.5, { c: 'coral', slot: 'gloss', seg: 8, at: [-w / 2 - 3.2 + k * 0.8, 3.7, 0], rTop: 0.1 });
  }
  b.anchor('cable', -w / 2 - 2.4, 0, 0);
  b.anchor('top', 0, h + 1.2, 0);
}

/** Jack-up installation vessel: hull raised on four lattice legs, crane with a blade on the hook. */
export function addJackUp(b: Builder, depth: number): void {
  const air = 4.5; // hull lifted above the waves
  b.box(22, 3.4, 10, { r: 0.9, c: ['coral.dark', 'coral'], slot: 'gloss', at: [0, air, 0] });
  b.box(5.5, 4.2, 7, { r: 0.4, c: ['mist', 'white'], slot: 'gloss', at: [7.4, air + 3.4, 0] });
  for (let i = 0; i < 4; i++) b.box(0.9, 0.7, 0.1, { r: 0.04, c: 'blue.dark', slot: 'window', at: [4.6, air + 6, -2.4 + i * 1.6], rot: [0, Math.PI / 2, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.cyl(0.55, depth + air + 13, { c: ['slate', 'steel'], seg: 10, at: [sx * 9, -depth, sz * 4.1] });
    b.cyl(1.5, 0.6, { c: 'slate', seg: 10, at: [sx * 9, -depth, sz * 4.1] });
    b.box(1.8, 1.4, 1.8, { r: 0.2, c: 'yellow', slot: 'gloss', at: [sx * 9, air + 3.4, sz * 4.1] });
  }
  // crane: pedestal, boom, hook line, a blade hanging level
  b.cyl(1.1, 3.2, { c: 'yellow', slot: 'gloss', seg: 14, at: [-4.5, air + 3.4, 0] });
  b.beam([-4.5, air + 6.4, 0], [-15, air + 24, 0], 0.8, { c: 'yellow' });
  b.rod([-15, air + 24, 0], [-15, air + 13, 0], 0.08, { c: 'slate', seg: 5 });
  b.add(bladeGeometry({ tipRadius: 8, rootRadius: 0.6, chunk: 2.4, sections: 10 }), { c: 'white', slot: 'gloss', at: [-15, air + 12.4, -4.3], rot: [Math.PI / 2, 0, 0] });
  b.anchor('hook', -15, air + 13, 0);
}
