/**
 * PathSet — several baked paths in one float texture (one row per path) plus a per-path parameter texture
 * (phase, density, AC offset, closed flag). Flow shaders read both with `texelFetch`, so no float-filtering
 * extension is needed and positions keep full 32-bit precision.
 */
import { DataTexture, FloatType, NearestFilter, RGBAFormat } from 'three';
import { bakePath, type BakedPath, type PathInput } from './paths';

export interface PathSpec {
  path: PathInput;
  /** Closed loop (circuits, rings). Default false. */
  closed?: boolean;
  /** Share of the flow's particles on this path. Default: proportional to the path length. */
  weight?: number;
}

export class PathSet {
  readonly paths: BakedPath[];
  readonly samples: number;
  /** RGBA32F, `samples` × `paths`: xyz = position. */
  readonly texture: DataTexture;
  /** RGBA32F, 1 × `paths`: x = phase (cycles), y = density 0…1, z = AC offset (fraction), w = closed. */
  readonly params: DataTexture;
  private readonly paramData: Float32Array;

  constructor(specs: readonly PathSpec[], samples = 256) {
    if (specs.length === 0) throw new Error('PathSet: at least one path is required');
    this.samples = samples;
    this.paths = specs.map((s) => bakePath(s.path, samples, s.closed ?? false));
    const n = this.paths.length;
    const data = new Float32Array(samples * n * 4);
    this.paths.forEach((p, row) => {
      for (let i = 0; i < samples; i++) {
        const o = (row * samples + i) * 4;
        data[o] = p.points[i * 3]!;
        data[o + 1] = p.points[i * 3 + 1]!;
        data[o + 2] = p.points[i * 3 + 2]!;
        data[o + 3] = 1;
      }
    });
    this.texture = makeTexture(data, samples, n);
    this.paramData = new Float32Array(n * 4);
    this.paths.forEach((p, row) => {
      this.paramData[row * 4 + 1] = 1;
      this.paramData[row * 4 + 3] = p.closed ? 1 : 0;
    });
    this.params = makeTexture(this.paramData, 1, n);
  }

  get count(): number {
    return this.paths.length;
  }

  /**
   * Replace path `row` (M3): re-bakes it into its texture row. Cheap enough per frame for a few paths (a slider
   * reshaping a stream tube or an aerofoil). `closed` defaults to the row's current flag.
   */
  setPath(row: number, path: PathInput, closed = this.paths[row]!.closed): void {
    if (row < 0 || row >= this.paths.length) throw new Error(`PathSet: no path row ${row}`);
    const p = bakePath(path, this.samples, closed);
    this.paths[row] = p;
    const data = this.texture.image.data as Float32Array;
    for (let i = 0; i < this.samples; i++) {
      const o = (row * this.samples + i) * 4;
      data[o] = p.points[i * 3]!;
      data[o + 1] = p.points[i * 3 + 1]!;
      data[o + 2] = p.points[i * 3 + 2]!;
    }
    this.texture.needsUpdate = true;
    this.paramData[row * 4 + 3] = p.closed ? 1 : 0;
    this.params.needsUpdate = true;
  }

  /** Phase of path `row` in cycles (1 = one full trip along the path). */
  getPhase(row: number): number {
    return this.paramData[row * 4]!;
  }

  setPhase(row: number, cycles: number): void {
    // wrapping keeps float precision; particles are offset by fractions, so whole cycles are invisible
    this.paramData[row * 4] = cycles - Math.floor(cycles / 64) * 64;
    this.params.needsUpdate = true;
  }

  setDensity(row: number, density: number): void {
    this.paramData[row * 4 + 1] = density;
    this.params.needsUpdate = true;
  }

  getDensity(row: number): number {
    return this.paramData[row * 4 + 1]!;
  }

  /** AC displacement of path `row` as a fraction of its length. */
  setOffset(row: number, fraction: number): void {
    this.paramData[row * 4 + 2] = fraction;
    this.params.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.params.dispose();
  }
}

function makeTexture(data: Float32Array, width: number, height: number): DataTexture {
  const t = new DataTexture(data, width, height, RGBAFormat, FloatType);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** GLSL: point on a path row at `u` (wraps on closed paths, clamps on open ones). */
export const PATH_GLSL = /* glsl */ `
uniform sampler2D tPath;
uniform sampler2D tPathParams;
uniform float uPathSamples;
vec3 fxPathPoint( float row, float u, float closed ) {
  float n = uPathSamples;
  float x = closed > 0.5 ? fract( u ) * n : clamp( u, 0.0, 1.0 ) * ( n - 1.0 );
  float i0 = min( floor( x ), n - 1.0 );
  float i1 = closed > 0.5 ? mod( i0 + 1.0, n ) : min( i0 + 1.0, n - 1.0 );
  vec3 a = texelFetch( tPath, ivec2( int( i0 ), int( row ) ), 0 ).xyz;
  vec3 b = texelFetch( tPath, ivec2( int( i1 ), int( row ) ), 0 ).xyz;
  return mix( a, b, x - i0 );
}
`;
