/**
 * Step 4 specimen: a slice cut out of the blade at mid span, built the way real blades are — a thin
 * glass-fibre shell, a box spar (two dark spar caps bonded to two shear webs) that carries the bending load,
 * foam-cored sandwich panels behind it, an erosion strip on the leading edge and the lightning down-conductor
 * running along the web (document: «склопластик/вуглепластик з бальзовим або пінним заповнювачем», hotspots
 * «захист передньої кромки», «блискавкоприймач»). The cut face looks toward +Z and its edge glows.
 * Kit `Builder`, one model; section frame of `section.ts` scaled by `CHORD` (chord along +X, suction side +Y).
 */
import { Path, Shape, Vector2, Vector3 } from 'three';
import { Builder, G, type KitModel } from '@/kit';
import { col } from '@/style';
import { CHORD, PITCH_AXIS, sectionAt, sectionOutline } from './section';

/** Thickness of the shell laminate, in chords. */
const SKIN = 0.013;
/** Chord fractions of the hollow cells: nose cell, box spar, aft cell. */
const CELLS = { nose: [0.04, 0.14], spar: [0.18, 0.46], aft: [0.51, 0.86] } as const;

/** Closed polygon of a cell: the shell's inner faces between two chord stations, inset by `inset`. */
function cell([from, to]: readonly [number, number], inset = 0, steps = 10): Vector2[] {
  const xs = Array.from({ length: steps + 1 }, (_, i) => from + inset + ((to - from - 2 * inset) * i) / steps);
  const top = xs.map((x) => new Vector2(sectionAt(x).x, sectionAt(x).upper - SKIN - inset));
  const bottom = xs.map((x) => new Vector2(sectionAt(x).x, sectionAt(x).lower + SKIN + inset));
  return [...bottom, ...top.reverse()];
}

/** A lining of thickness `t` on the walls of a cell (spar caps and webs, foam core). */
function lining(range: readonly [number, number], t: number): Shape {
  const shape = new Shape(cell(range));
  shape.holes.push(new Path(cell(range, t)));
  return shape;
}

export function buildBladeSection(span = 6.5): KitModel {
  const b = new Builder('blade-section');
  const depth = span / CHORD;
  const back = (z = 0): { at: [number, number, number] } => ({ at: [0, 0, -depth / 2 + z] });
  b.frame({ s: CHORD }, () => {
    const outline = sectionOutline(40);
    // the shell with its three cells, cut square at the front
    const shell = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
    for (const range of Object.values(CELLS)) shell.holes.push(new Path(cell(range)));
    b.add(G.extrude(shell, depth, { bevel: 0.003, bevelSeg: 1 }), { ...back(), slot: 'gloss', c: 'white' });
    // box spar: carbon-dark caps and webs line the middle cell
    b.add(G.extrude(lining(CELLS.spar, 0.022), depth * 0.998), { ...back(), slot: 'toon', c: col('slate').lerp(col('ink'), 0.35) });
    // sandwich panels: a pale foam core lines the aft cell
    b.add(G.extrude(lining(CELLS.aft, 0.014), depth * 0.996), { ...back(), slot: 'matte', c: col('amber').lerp(col('white'), 0.62) });
    // erosion strip over the nose: a thin band just proud of the shell
    const nose = outline.filter(([x]) => x < -0.2);
    const band = [...nose.map(([x, y]) => new Vector2(x * 1.03 + 0.003, y * 1.045)), ...nose.map(([x, y]) => new Vector2(x, y)).reverse()];
    b.add(G.extrude(new Shape(band), depth * 0.999), { ...back(), slot: 'gloss', c: col('slate').lerp(col('teal'), 0.35) });
    b.anchor('leadingEdge', -PITCH_AXIS - 0.012, sectionAt(0.004).upper, 0);
    // lightning down-conductor clipped to the rear web, with two cleats
    const web = sectionAt(CELLS.spar[1] + 0.012);
    b.cyl(0.007, depth * 1.02, { axis: 'z', seg: 8, slot: 'metal', c: 'orange', at: [web.x, 0.01, -depth * 0.51] });
    for (const z of [-0.12, -depth + 0.12]) b.box(0.03, 0.022, 0.03, { r: 0.004, slot: 'metal', c: 'steel', at: [web.x, -0.001, z] });
    b.anchor('conductor', web.x, 0.01, 0);
    // the cut glows: rim round the section, chord line, pitch axis
    b.tube([...outline, outline[0]!].map(([x, y]) => new Vector3(x, y, 0.004)), 0.0055, { seg: 6, closed: true, slot: 'glow', c: 'white' });
    b.rod([-PITCH_AXIS, 0, 0.012], [1 - PITCH_AXIS, 0, 0.012], 0.003, { seg: 5, slot: 'glow', c: 'mist' });
    b.ring(0.028, 0.006, { axis: 'z', seg: 24, tubeSeg: 6, slot: 'glow', c: 'cyan', at: [0, 0, 0.014] });
    b.anchor('quarter', 0.25 - PITCH_AXIS, 0, 0.03);
  });
  return b.build();
}
