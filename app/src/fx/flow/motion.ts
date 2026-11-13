/**
 * Orb motion "along paths": the vertex shader places every orb on its path from the per-path phase, so
 * thousands of electrons cost nothing on the CPU. Layout of the per-instance attribute `aInst`:
 * x = path row, y = offset along the path (0…1), z/w = lateral position inside the unit disc.
 */
import { Vector4 } from 'three';
import type { Rng } from '@/engine/api';
import { instanced } from '../core/quad';
import type { OrbMotion } from '../characters/orb';
import { PATH_GLSL, type PathSet } from './pathset';

export interface PathMotionOptions {
  /** Radius of the tube the particles fill around the path (0 = single file). */
  spread: number;
  /** Amplitude of the per-particle thermal wobble, units. */
  wobble: number;
  /** Half of the particles travel the other way. */
  bidirectional: boolean;
  /** Fraction of an open path over which particles grow in / shrink out at its ends. */
  endFade: number;
  /** Share of particles per path (sums to 1). */
  weights: readonly number[];
}

export function pathMotion(set: PathSet, rng: Rng, o: PathMotionOptions): OrbMotion {
  return {
    pars: /* glsl */ `
      attribute vec4 aInst;
      attribute float aSeed;
      uniform vec4 uFlow; // spread radius, wobble amplitude, bidirectional, end fade
      ${PATH_GLSL}
    `,
    main: /* glsl */ `
      vec4 pp = texelFetch( tPathParams, ivec2( 0, int( aInst.x ) ), 0 );
      float closed = pp.w;
      float dirSign = ( uFlow.z > 0.5 && aSeed > 0.5 ) ? -1.0 : 1.0;
      float u = fract( aInst.y + dirSign * pp.x ) + pp.z;
      float ends = 1.0;
      if ( closed < 0.5 ) {
        // an AC swing must not carry a particle out of an open path: wrap, then fade at both ends
        u = fract( u );
        ends = smoothstep( 0.0, uFlow.w, u ) * smoothstep( 1.0, 1.0 - uFlow.w, u );
      }
      vec3 p = fxPathPoint( aInst.x, u, closed );
      vec3 tangent = fxPathPoint( aInst.x, u + 1.0 / uPathSamples, closed ) - fxPathPoint( aInst.x, u - 1.0 / uPathSamples, closed );
      tangent = length( tangent ) > 1e-6 ? normalize( tangent ) : vec3( 1.0, 0.0, 0.0 );
      // a fixed skew reference avoids a frame flip on axis-aligned paths
      vec3 nrm = normalize( cross( tangent, vec3( 0.31, 0.89, 0.33 ) ) );
      vec3 bin = cross( tangent, nrm );
      float tw = uKTime * ( 1.6 + aSeed * 2.4 ) + aSeed * 40.0;
      vec2 lat = aInst.zw * uFlow.x + vec2( sin( tw ), cos( tw * 1.31 ) ) * uFlow.y;
      center = p + nrm * lat.x + bin * lat.y + tangent * ( sin( tw * 0.77 ) * uFlow.y );
      float dens = smoothstep( aSeed - 0.03, aSeed + 0.03, pp.y * 1.06 - 0.03 );
      scale = ends * dens;
      seed = aSeed;
    `,
    uniforms: {
      tPath: { value: set.texture },
      tPathParams: { value: set.params },
      uPathSamples: { value: set.samples },
      uFlow: { value: new Vector4(o.spread, o.wobble, o.bidirectional ? 1 : 0, o.endFade) },
    },
    attributes(geometry, capacity) {
      const inst = new Float32Array(capacity * 4);
      const seed = new Float32Array(capacity);
      // cumulative weights → path row; within a row offsets are stratified so spacing stays even
      const cdf: number[] = [];
      let total = 0;
      for (const w of o.weights) cdf.push((total += w));
      const perRow = new Array<number>(o.weights.length).fill(0);
      for (let i = 0; i < capacity; i++) {
        const r = ((i + 0.5) / capacity) * total;
        let row = cdf.findIndex((c) => r <= c);
        if (row < 0) row = cdf.length - 1;
        const k = perRow[row]!++;
        const expected = Math.max(1, Math.round((capacity * o.weights[row]!) / total));
        const a = rng.next() * Math.PI * 2;
        const rad = Math.sqrt(rng.next());
        // golden-ratio stride spreads consecutive indices along the path, so thinning by seed stays even
        const offset = ((k * 0.61803398875) % 1) + rng.signed(0.25 / expected);
        inst.set([row, (offset + 1) % 1, Math.cos(a) * rad, Math.sin(a) * rad], i * 4);
        seed[i] = rng.next();
      }
      instanced(geometry, 'aInst', inst, 4);
      instanced(geometry, 'aSeed', seed, 1);
    },
  };
}
