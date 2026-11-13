/**
 * Roads and railway tracks laid along a route on the ground. Both register `paths.centre` (and lane / rail
 * paths) so vehicles and trains from the life set can follow them. Units: metres.
 */
import { type Vector3 } from 'three';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import type { Pt } from '../core/geo';
import { addRibbon, drape, offsetPath, stations, type DrapeOptions } from './ribbon';

const mix = (a: ColorLike, b: ColorLike, t: number) => col(a).lerp(col(b), t);

export interface RoadOptions extends DrapeOptions {
  /** Route as [x, z] points. */
  route: readonly Pt[];
  /** Carriageway width. Default 6 m (two lanes). */
  width?: number;
  /** `asphalt` with markings, `dirt` or `gravel` without. */
  surface?: 'asphalt' | 'dirt' | 'gravel';
  /** Centre dashes and edge lines (asphalt only). Default true. */
  markings?: boolean;
  /** Light kerb / shoulder strip on both sides. Default true for asphalt. */
  shoulder?: boolean;
}

/** Add a road to a builder; returns the draped centre line. */
export function addRoad(b: Builder, o: RoadOptions): Vector3[] {
  const width = o.width ?? 6;
  const surface = o.surface ?? 'asphalt';
  const pts = drape(o.route, { lift: 0.12, step: 1.5, ...o });
  const colour =
    surface === 'asphalt' ? mix('slate', 'steel', 0.28) : surface === 'gravel' ? mix('mist', 'steel.light', 0.45) : mix('wireBrown', 'yellow.light', 0.45);
  if (o.shoulder ?? surface === 'asphalt') {
    addRibbon(b, offsetPath(pts, 0, -0.04), width + 1.1, { c: mix('mist', 'yellow.light', 0.3), thickness: 0.35 });
  }
  addRibbon(b, pts, width, { c: colour, thickness: 0.4 });
  if (surface === 'asphalt' && (o.markings ?? true)) {
    const paint = mix('white', 'mist', 0.2);
    for (const side of [-1, 1]) addRibbon(b, offsetPath(pts, side * (width / 2 - 0.35), 0.025), 0.16, { c: paint, thickness: 0.03 });
    stations(pts, 5, (p, heading, i) => {
      if (i % 2 === 0) b.box(0.18, 0.03, 2.2, { r: 0, mid: true, slot: 'matte', c: paint, at: [p.x, p.y + 0.03, p.z], rot: [0, heading, 0] });
    }, 1.5);
  }
  b.path('centre', pts);
  b.path('laneRight', offsetPath(pts, -width / 4, 0.02));
  b.path('laneLeft', offsetPath(pts, width / 4, 0.02));
  return pts;
}

export function road(o: RoadOptions): KitModel {
  const b = new Builder('road');
  addRoad(b, o);
  return b.build();
}

export interface RailsOptions extends DrapeOptions {
  route: readonly Pt[];
  /** Track gauge. Default 1.52 m (the 1520 mm gauge used in Ukraine). */
  gauge?: number;
  /** Second track beside the first. */
  double?: boolean;
  /** Catenary masts and contact wire (electrified line, 3 kV DC / 25 kV AC). */
  electrified?: boolean;
}

/** Add a railway track: ballast bed, sleepers, two rails. Returns the centre line of the (first) track. */
export function addRails(b: Builder, o: RailsOptions): Vector3[] {
  const gauge = o.gauge ?? 1.52;
  const base = drape(o.route, { lift: 0.3, step: 1.2, bend: 25, ...o });
  const tracks = o.double ? [offsetPath(base, 2.3), offsetPath(base, -2.3)] : [base];
  addRibbon(b, offsetPath(base, 0, -0.08), (o.double ? 8.6 : 4) + 1, { c: mix('steel', 'violet.light', 0.3), thickness: 0.5 });
  addRibbon(b, base, o.double ? 8.2 : 3.6, { c: mix('mist', 'steel.light', 0.5), thickness: 0.3 });
  const sleeper = mix('wireBrown', 'ink', 0.5);
  tracks.forEach((pts, ti) => {
    stations(pts, 1.3, (p, heading) => {
      b.box(2.7, 0.16, 0.34, { r: 0.04, slot: 'matte', c: sleeper, at: [p.x, p.y - 0.02, p.z], rot: [0, heading, 0] });
    });
    for (const side of [-1, 1]) {
      b.tube(offsetPath(pts, (side * gauge) / 2, 0.22), 0.075, { seg: 4, slot: 'metal', c: 'steel.light' });
    }
    b.path(ti === 0 ? 'centre' : 'centre2', offsetPath(pts, 0, 0.3));
  });
  if (o.electrified) {
    const mast = mix('steel', 'slate', 0.4);
    const span = o.double ? 4.6 : 2.5;
    stations(base, 28, (p, heading) => {
      b.frame({ at: [p.x, p.y, p.z], rot: [0, heading, 0] }, () => {
        b.box(0.5, 0.5, 0.5, { c: 'mist', slot: 'matte', at: [-span - 0.6, -0.2, 0] });
        b.beam([-span - 0.6, 0.2, 0], [-span - 0.6, 7.6, 0], 0.26, { c: mast });
        b.beam([-span - 0.6, 6.9, 0], [span * (o.double ? 1 : 0.2), 6.9, 0], 0.14, { c: mast });
        b.beam([-span - 0.6, 5.6, 0], [0, 6.9, 0], 0.09, { c: mast });
        b.cyl(0.09, 0.4, { c: 'coral.dark', slot: 'gloss', seg: 8, at: [-span + 0.5, 6.5, 0] });
      });
    });
    tracks.forEach((pts) => {
      b.tube(offsetPath(pts, 0, 6.05), 0.035, { seg: 4, slot: 'metal', c: 'orange.dark', caps: false });
      b.tube(offsetPath(pts, 0, 6.75), 0.03, { seg: 4, slot: 'metal', c: 'slate', caps: false });
    });
    b.path('contactWire', offsetPath(tracks[0]!, 0, 6.05));
  }
  return tracks[0]!;
}

export function rails(o: RailsOptions): KitModel {
  const b = new Builder('rails');
  addRails(b, o);
  return b.build();
}
