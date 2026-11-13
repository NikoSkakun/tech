/**
 * GLSL building blocks shared by fx shaders. All fx shaders output linear HDR colour (values > 1 bloom) and
 * read time from the shared `uKTime` uniform (`kGlobals.uKTime`), exactly like the K materials.
 */

/** Tiny helpers every fx shader may rely on (three's own chunks define `saturate` only inside <common>). */
export const FX_COMMON = /* glsl */ `
#ifndef saturate
  #define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#ifndef PI
  #define PI 3.141592653589793
#endif
#ifndef FX_KEEP_HUE_FN
#define FX_KEEP_HUE_FN
// Same pre-compensation as K.glow({ keepHue }) (M1): the display transform bleeds a pixel of peak p > 1 toward
// white by w = 1 − exp(−0.7·(p − 1)); writing c' = (c/p − p·w) / (1 − w) makes it land on the palette hue at full
// brightness. The dominant channel keeps the peak (bloom). The peak is capped at maxPeak (≤ 1.8, above which no hue
// survives). Thin lines need a low cap (≈ 1.3): strongly negative channels of a 2-px line get mixed with its
// neighbours by bloom / FXAA and the compensation then overshoots (amber turned red-orange at 1.8).
vec3 fxKeepHue( vec3 c, float maxPeak ) {
  float p = max( c.r, max( c.g, c.b ) );
  if ( p <= 1.0 ) return c;
  c *= min( p, maxPeak ) / p;
  p = min( p, maxPeak );
  float w = 1.0 - exp( -0.7 * ( p - 1.0 ) );
  vec3 t = c / p;
  vec3 k = max( ( t - p * w ) / max( 1.0 - w, 1e-3 ), -p );
  return mix( k, vec3( p ), step( 0.999, t ) );
}
#endif
`;

/** Hashes and value noise (cheap, stable across GPUs; no textures). */
export const FX_NOISE = /* glsl */ `
float fxHash11( float p ) {
  p = fract( p * 0.1031 );
  p *= p + 33.33;
  p *= p + p;
  return fract( p );
}
float fxHash21( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
vec3 fxHash33( vec3 p3 ) {
  p3 = fract( p3 * vec3( 0.1031, 0.1030, 0.0973 ) );
  p3 += dot( p3, p3.yxz + 33.33 );
  return fract( ( p3.xxy + p3.yxx ) * p3.zyx );
}
float fxNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( fxHash21( i ), fxHash21( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( fxHash21( i + vec2( 0.0, 1.0 ) ), fxHash21( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
float fxFbm( vec2 p ) {
  float a = 0.5;
  float s = 0.0;
  for ( int i = 0; i < 3; i++ ) {
    s += a * fxNoise( p );
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return s;
}
`;

/** Fog support for unlit fx fragment shaders (matches three's fog chunks; enabled by `material.fog`). */
export const FX_FOG_PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
#endif
`;
export const FX_FOG_VERTEX = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
#endif
`;
export const FX_FOG_PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  float fxFogFactor() {
    #ifdef FOG_EXP2
      return 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      return smoothstep( fogNear, fogFar, vFogDepth );
    #endif
  }
#else
  float fxFogFactor() { return 0.0; }
#endif
`;

/** Uniform scale of the model matrix (effects assume uniform scaling of their object). */
export const FX_OBJECT_SCALE = /* glsl */ `
float fxObjectScale() {
  return length( modelMatrix[ 0 ].xyz );
}
`;
