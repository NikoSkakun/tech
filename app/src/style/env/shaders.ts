/** Shaders of the environment backdrop: gradient dome, bokeh discs, drifting motes, studio floor disc. */
import { K_FRAGMENT_COMMON, K_LIGHTING_PARS, kVertexShader } from '../materials/chunks';

const NOISE3 = /* glsl */ `
float eHash( vec3 p ) {
  p = fract( p * 0.3183099 + vec3( 0.1, 0.2, 0.3 ) );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
float eNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( eHash( i ), eHash( i + vec3( 1, 0, 0 ) ), f.x ),
                   mix( eHash( i + vec3( 0, 1, 0 ) ), eHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( eHash( i + vec3( 0, 0, 1 ) ), eHash( i + vec3( 1, 0, 1 ) ), f.x ),
                   mix( eHash( i + vec3( 0, 1, 1 ) ), eHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
float eFbm( vec3 p ) {
  float a = 0.5;
  float s = 0.0;
  for ( int i = 0; i < 4; i ++ ) {
    s += a * eNoise( p );
    p = p * 2.03 + vec3( 17.1, 3.7, 9.2 );
    a *= 0.5;
  }
  return s;
}
`;

export const DOME_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  // rotation only: the dome is infinitely far away and never clipped
  vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * position, 1.0 );
  gl_Position = p.xyww;
}
`;

/**
 * One dome shader for all three backdrop kinds (selected with a define). Output stays ≤ 1 except the sun
 * disc and the brightest stars, which are allowed to bloom slightly.
 */
export const DOME_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBottom;
uniform vec2 uHorizon;         // elevation of the horizon line, width of the mid-colour band
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec2 uSun;            // angular size (rad), glow
uniform float uStars;
uniform float uClouds;
uniform vec3 uCloudColor;
uniform vec3 uCloudColorB;
uniform float uSilhouettes;
uniform vec3 uSilhouetteColor;
uniform vec3 uViewDir;        // camera forward (world)
uniform float uKTime;
${NOISE3}
float starLayer( vec3 d, float scale, float density ) {
  vec3 p = d * scale;
  vec3 cell = floor( p );
  vec3 f = fract( p ) - 0.5;
  float h = eHash( cell );
  if ( h > density ) return 0.0;
  vec3 off = vec3( eHash( cell + 1.7 ), eHash( cell + 5.3 ), eHash( cell + 9.1 ) ) - 0.5;
  float dist = length( f - off * 0.6 );
  float tw = 0.65 + 0.35 * sin( uKTime * ( 0.6 + h * 40.0 ) + h * 100.0 );
  return smoothstep( 0.09, 0.0, dist ) * tw * ( 0.4 + 0.6 * fract( h * 91.7 ) );
}
void main() {
  vec3 d = normalize( vDir );
  float h = d.y;
  float rel = h - uHorizon.x;
  // vertical gradient bottom → top, with the 'mid' colour glowing in a band around the horizon line
  vec3 color = mix( uBottom, uTop, smoothstep( -0.8, 0.8, rel ) );
  float band = exp( -pow( rel / uHorizon.y, 2.0 ) );
  color = mix( color, uMid, band );

  #if defined( ENV_SPACE )
    // nebula: soft cloud masses drifting very slowly, brighter in their cores; a gentle glow behind the subject
    float t = uKTime * 0.006;
    float n = eFbm( d * 1.35 + vec3( t, -t * 0.6, t * 0.4 ) );
    float n2 = eFbm( d * 2.7 - vec3( t * 0.7, t, 0.0 ) + 4.0 );
    float cloud = smoothstep( 0.38, 0.74, n );
    vec3 nebula = mix( uCloudColor, uCloudColorB, smoothstep( 0.3, 0.7, n2 ) );
    color = mix( color, nebula, cloud * uClouds * 0.6 );
    color += nebula * pow( cloud, 3.0 ) * 0.3 * uClouds;
    color += uMid * pow( max( dot( d, uViewDir ), 0.0 ), 4.0 ) * 0.35;
    float st = starLayer( d, 46.0, 0.07 ) + starLayer( d, 23.0, 0.045 ) * 1.4;
    color += vec3( 0.75, 0.82, 1.0 ) * st * uStars * 0.8;
  #elif defined( ENV_STUDIO )
    // backdrop spot behind and slightly below the subject keeps the silhouette readable
    vec3 spotDir = normalize( uViewDir + vec3( 0.0, -0.18, 0.0 ) );
    color += uMid * pow( max( dot( d, spotDir ), 0.0 ), 2.5 ) * 0.5;
  #else
    // sky: sun glow + stylised disc
    float sd = max( dot( d, uSunDir ), 0.0 );
    color += uSunColor * ( pow( sd, 5.0 ) * 0.22 + pow( sd, 40.0 ) * 0.45 ) * uSun.y;
    if ( uSun.x > 0.0 ) {
      float disc = smoothstep( cos( uSun.x ) - 0.0006, cos( uSun.x ) + 0.0006, sd );
      color = mix( color, uSunColor * 1.6, disc );
    }
    // stars (upper sky, fading into the horizon glow)
    if ( uStars > 0.001 ) {
      float st = starLayer( d, 60.0, 0.06 ) + starLayer( d, 28.0, 0.04 ) * 1.5;
      color += vec3( 0.8, 0.86, 1.0 ) * st * uStars * smoothstep( -0.05, 0.4, rel ) * 1.25;
    }
    if ( uClouds > 0.001 ) {
      float t = uKTime * 0.004;
      // painted cloud bands just above the horizon: two flat cel levels
      float n = eFbm( vec3( d.x * 2.4 + t, h * 7.0, d.z * 2.4 - t ) );
      float bandUp = smoothstep( 0.62, 0.0, abs( rel - 0.16 ) * 2.2 );
      color = mix( color, mix( color, uCloudColor, 0.34 ), smoothstep( 0.5, 0.53, n ) * bandUp * uClouds );
      color = mix( color, mix( color, uCloudColor, 0.6 ), smoothstep( 0.6, 0.63, n ) * bandUp * uClouds );
      // "sea of clouds" below the horizon — dioramas are mostly seen from above, so this is their backdrop
      float m = eFbm( vec3( d.x * 1.7 - t, h * 3.4 + 2.0, d.z * 1.7 + t * 0.7 ) );
      float below = smoothstep( 0.02, -0.5, rel );
      color = mix( color, mix( color, uCloudColor, 0.2 ), smoothstep( 0.46, 0.5, m ) * below * uClouds );
      color = mix( color, mix( color, uCloudColor, 0.36 ), smoothstep( 0.57, 0.61, m ) * below * uClouds );
    }
    // distant layered silhouettes: three ridgelines, each closer one darker and more saturated
    if ( uSilhouettes > 0.001 ) {
      vec2 az = normalize( d.xz + 1e-5 );
      for ( int i = 0; i < 3; i ++ ) {
        float fi = float( i );
        float fr = 2.2 + fi * 1.7;
        float ridge = eNoise( vec3( az * fr, fi * 7.3 ) ) * 0.6 + eNoise( vec3( az * fr * 2.7, fi * 3.1 + 2.0 ) ) * 0.25;
        float line = uHorizon.x + 0.035 - fi * 0.055 + ( ridge - 0.42 ) * ( 0.16 - fi * 0.03 );
        float m = smoothstep( line + 0.003, line - 0.003, h ) * smoothstep( line - 0.5, line - 0.12, h );
        vec3 layer = mix( uMid, uSilhouetteColor, 0.3 + 0.27 * fi );
        color = mix( color, layer, m * uSilhouettes * ( 0.55 + 0.2 * fi ) );
      }
    }
  #endif
  gl_FragColor = vec4( color, 1.0 );
}
`;

/** Bokeh discs: camera-facing instanced quads with a soft edge and slightly brighter rim. */
export const BOKEH_VERTEX = /* glsl */ `
attribute vec4 aSeed;   // phase, speed, size, brightness
attribute vec3 aColor;
uniform float uKTime;
uniform float uScale;
uniform float uAmount;
varying vec2 vQuad;
varying vec4 vColor;
void main() {
  vQuad = position.xy * 2.0;
  vec3 center = ( instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  float t = uKTime * aSeed.y;
  center += vec3( sin( t + aSeed.x ), cos( t * 0.8 + aSeed.x * 1.7 ), sin( t * 0.6 + aSeed.x * 2.3 ) ) * uScale * 0.6;
  vec4 mv = modelViewMatrix * vec4( center, 1.0 );
  mv.xy += position.xy * aSeed.z * uScale;
  gl_Position = projectionMatrix * mv;
  float pulse = 0.75 + 0.25 * sin( uKTime * 0.35 + aSeed.x * 5.0 );
  vColor = vec4( aColor, aSeed.w * pulse * uAmount );
}
`;

export const BOKEH_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vQuad;
varying vec4 vColor;
void main() {
  float r = length( vQuad );
  float disc = smoothstep( 1.0, 0.86, r );
  float rim = smoothstep( 0.62, 0.92, r ) * disc;
  gl_FragColor = vec4( vColor.rgb * vColor.a * disc * ( 0.6 + 0.5 * rim ), 1.0 );
}
`;

/** Motes: tiny soft points drifting through a box that follows the camera target (wraps seamlessly). */
export const MOTES_VERTEX = /* glsl */ `
attribute vec4 aSeed;   // phase, speed, size, brightness
uniform float uKTime;
uniform float uScale;
uniform float uAmount;
uniform float uPixelScale;
uniform vec3 uCenter;
varying float vAlpha;
void main() {
  float t = uKTime * ( 0.25 + aSeed.y * 0.5 );
  vec3 box = vec3( uScale * 2.0 );
  vec3 p = position * uScale;
  p += vec3( sin( t + aSeed.x * 6.28 ), t * 0.35 + cos( t * 0.7 + aSeed.x * 3.0 ) * 0.4, cos( t * 0.9 + aSeed.x * 4.0 ) ) * uScale * 0.12;
  // wrap into the box around the centre so motes never run out
  p = mod( p - uCenter + box * 0.5, box ) - box * 0.5 + uCenter;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.55 + 0.45 * sin( uKTime * ( 0.8 + aSeed.y * 2.0 ) + aSeed.x * 40.0 );
  // fade near the box faces (no popping at the wrap) and very close to the camera
  vec3 e = abs( p - uCenter ) / ( box * 0.5 );
  float edge = 1.0 - smoothstep( 0.75, 1.0, max( e.x, max( e.y, e.z ) ) );
  vAlpha = aSeed.w * twinkle * edge * uAmount * smoothstep( 0.2, 1.2, -mv.z / uScale * 4.0 );
  gl_PointSize = max( aSeed.z * 0.4 * uPixelScale * uScale / max( -mv.z, 1e-3 ), 1.0 );
}
`;

export const MOTES_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float r = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = smoothstep( 1.0, 0.0, r );
  gl_FragColor = vec4( uColor * a * a * vAlpha, 1.0 );
}
`;

/** Studio floor: soft disc that receives the tinted key-light shadow and fades into the backdrop. */
export const FLOOR_VERTEX = kVertexShader({ uv: true });

export const FLOOR_FRAGMENT = /* glsl */ `
${K_FRAGMENT_COMMON}
varying vec2 vKUv;
uniform vec3 uFloorColor;
uniform float uFloor;
uniform vec3 uContact; // footprint radius / floor radius, strength, _
${K_LIGHTING_PARS}
void main() {
  float r = length( vKUv - 0.5 ) * 2.0;
  #include <normal_fragment_begin>
  vec3 color = kShade( uFloorColor, normal );
  // brighter pool of light in the middle, soft falloff to nothing at the rim
  color *= mix( 1.25, 0.82, smoothstep( 0.0, 0.75, r ) );
  // grounding: a soft, tinted contact shadow hugging the subject's footprint (independent of the shadow map,
  // so low, wide objects such as turntables or machine bases still sit firmly on the floor)
  float contact = ( 1.0 - smoothstep( uContact.x * 0.8, uContact.x * 1.45, r ) ) * uContact.y;
  color *= mix( vec3( 1.0 ), vec3( 0.42, 0.36, 0.7 ), contact );
  float alpha = ( 1.0 - smoothstep( 0.45, 1.0, r ) ) * uFloor;
  if ( alpha < 0.004 ) discard;
  gl_FragColor = vec4( color, alpha );
  #include <fog_fragment>
}
`;
