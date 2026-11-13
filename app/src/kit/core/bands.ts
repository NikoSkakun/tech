/**
 * Crisp colour bands on smooth surfaces.
 *
 * Vertex colours interpolate, so painting "grass / sand / rock" per vertex gives airbrushed, muddy borders.
 * Instead every triangle is *cut along the iso-lines of a scalar field* (height, distance to the shore, a
 * low-frequency noise…) and each piece gets one flat palette colour. The borders are then real mesh edges:
 * perfectly crisp at any zoom, smooth because they follow the iso-line, while normals stay continuous so the
 * shading of the form is untouched. Layers nest (e.g. "shore band, else meadow patches by noise").
 */
import { BufferGeometry, Float32BufferAttribute, type Color } from 'three';

export interface Bands {
  /** Index of the per-vertex scalar field this layer cuts along. */
  field: number;
  /** Ascending thresholds; the colour (or nested layer) applies *below* each threshold. */
  stops: readonly (readonly [number, Color | Bands])[];
  /** Colour (or nested layer) above the last threshold. */
  rest: Color | Bands;
}

export interface BandSource {
  position: ArrayLike<number>;
  normal: ArrayLike<number>;
  /** One array per field, one value per vertex. */
  fields: readonly ArrayLike<number>[];
  index: ArrayLike<number>;
}

type Vtx = number[]; // x y z nx ny nz f0 f1 …

const EMPTY: Vtx[] = [];

function cut(poly: Vtx[], fi: number, t: number): [Vtx[], Vtx[]] {
  let anyBelow = false;
  let anyAbove = false;
  for (const v of poly) {
    if (v[fi]! <= t) anyBelow = true;
    else anyAbove = true;
  }
  if (!anyAbove) return [poly, EMPTY];
  if (!anyBelow) return [EMPTY, poly];
  const below: Vtx[] = [];
  const above: Vtx[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const fa = a[fi]! - t;
    const fb = b[fi]! - t;
    if (fa <= 0) below.push(a);
    else above.push(a);
    if (fa <= 0 !== fb <= 0) {
      const k = fa / (fa - fb);
      const m = a.map((av, j) => av + (b[j]! - av) * k);
      m[fi] = t;
      below.push(m);
      above.push(m);
    }
  }
  return [below, above];
}

/** Cut an indexed surface into flat-coloured bands. Returns a non-indexed geometry with `position`, `normal`, `color`, `uv`. */
export function splitBands(src: BandSource, bands: Bands): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const colr: number[] = [];
  const nf = src.fields.length;

  const emit = (poly: Vtx[], target: Color | Bands): void => {
    if (poly.length < 3) return;
    if ((target as Bands).stops) {
      layer(poly, target as Bands);
      return;
    }
    const c = target as Color;
    for (let i = 1; i < poly.length - 1; i++) {
      for (const v of [poly[0]!, poly[i]!, poly[i + 1]!]) {
        pos.push(v[0]!, v[1]!, v[2]!);
        const len = Math.hypot(v[3]!, v[4]!, v[5]!) || 1;
        nor.push(v[3]! / len, v[4]! / len, v[5]! / len);
        colr.push(c.r, c.g, c.b);
      }
    }
  };
  const layer = (poly: Vtx[], b: Bands): void => {
    let rest = poly;
    const fi = 6 + b.field;
    for (const [t, target] of b.stops) {
      if (rest.length < 3) return;
      const [below, above] = cut(rest, fi, t);
      emit(below, target);
      rest = above;
    }
    emit(rest, b.rest);
  };

  const vertex = (i: number): Vtx => {
    const v: Vtx = [
      src.position[i * 3]!,
      src.position[i * 3 + 1]!,
      src.position[i * 3 + 2]!,
      src.normal[i * 3]!,
      src.normal[i * 3 + 1]!,
      src.normal[i * 3 + 2]!,
    ];
    for (let f = 0; f < nf; f++) v.push(src.fields[f]![i]!);
    return v;
  };
  for (let i = 0; i < src.index.length; i += 3) {
    const a = src.index[i]!;
    const b = src.index[i + 1]!;
    const c = src.index[i + 2]!;
    if (a === b || b === c || a === c) continue;
    layer([vertex(a), vertex(b), vertex(c)], bands);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(colr, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

/**
 * Band any geometry by a scalar function of its vertices (e.g. altitude + angular wobble for a snow line).
 * `stops` are ascending thresholds with the colour below each; `rest` applies above the last.
 */
export function bandGeometry(
  geo: BufferGeometry,
  field: (x: number, y: number, z: number) => number,
  stops: readonly (readonly [number, Color])[],
  rest: Color,
): BufferGeometry {
  const position = geo.getAttribute('position');
  const normal = geo.getAttribute('normal');
  const values = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) values[i] = field(position.getX(i), position.getY(i), position.getZ(i));
  const index = geo.getIndex();
  const idx = index ? Array.from(index.array) : Array.from({ length: position.count }, (_, i) => i);
  return splitBands({ position: position.array, normal: normal.array, fields: [values], index: idx }, { field: 0, stops, rest });
}
