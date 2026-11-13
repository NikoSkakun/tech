/**
 * Post-processing shaders (STYLE_GUIDE §4). Stage order is fixed by `RenderPipeline`:
 *   world (MSAA, linear HDR) → AO → [prep: AO composite + circle of confusion] → DOF / tilt-shift
 *   → chapter transition mix → HUD layer on top → bloom → grade + vignette + grain (→ sRGB) → FXAA.
 */
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

/** Full-screen triangle vertex shader (positions are already clip-space). */
export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

const IGN = /* glsl */ `
float ign( vec2 p ) {
  return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) );
}
`;

/* --------------------------------------------------------------------------------------------------- AO */

/**
 * Screen-space ambient obscurance (Alchemy/SAO estimator) from the depth buffer only; normals are
 * reconstructed from depth. Deliberately short-range and subtle: "contact areas only".
 * Output: R = visibility (1 = open), G = packed depth for the bilateral blur.
 */
export const AO_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tDepth;
uniform mat4 uProj;
uniform mat4 uProjInv;
uniform vec2 uTexel;     // 1 / depth texture size
uniform vec3 uAO;        // world radius, bias, 1 / far
varying vec2 vUv;
${IGN}
vec3 viewPos( vec2 uv ) {
  float d = texture2D( tDepth, uv ).r;
  vec4 v = uProjInv * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
  return v.xyz / v.w;
}
void main() {
  float depth = texture2D( tDepth, vUv ).r;
  if ( depth >= 0.99999 ) { gl_FragColor = vec4( 1.0, 1.0, 0.0, 1.0 ); return; }
  vec3 P = viewPos( vUv );
  vec3 Pr = viewPos( vUv + vec2( uTexel.x, 0.0 ) );
  vec3 Pl = viewPos( vUv - vec2( uTexel.x, 0.0 ) );
  vec3 Pu = viewPos( vUv + vec2( 0.0, uTexel.y ) );
  vec3 Pd = viewPos( vUv - vec2( 0.0, uTexel.y ) );
  // pick the smaller depth step on each axis so normals stay clean across silhouettes
  vec3 dx = abs( Pr.z - P.z ) < abs( P.z - Pl.z ) ? Pr - P : P - Pl;
  vec3 dy = abs( Pu.z - P.z ) < abs( P.z - Pd.z ) ? Pu - P : P - Pd;
  vec3 N = normalize( cross( dx, dy ) );
  float radius = uAO.x;
  // world radius → uv radius (projection scale / distance), clamped so close-ups stay cheap and far views stay visible
  float rv = clamp( radius * uProj[ 1 ][ 1 ] * 0.5 / max( -P.z, 1e-3 ), 2.0 * uTexel.y, 0.09 );
  vec2 ruv = vec2( rv * uProj[ 0 ][ 0 ] / uProj[ 1 ][ 1 ], rv );
  float phi = ign( gl_FragCoord.xy ) * 6.2831853;
  float r2 = radius * radius;
  float sum = 0.0;
  for ( int i = 0; i < AO_SAMPLES; i ++ ) {
    float f = ( float( i ) + 0.5 ) / float( AO_SAMPLES );
    float a = float( i ) * 2.39996323 + phi;
    vec3 S = viewPos( vUv + vec2( cos( a ), sin( a ) ) * sqrt( f ) * ruv );
    vec3 v = S - P;
    float vv = dot( v, v );
    float vn = dot( v, N ) - uAO.y * -P.z;
    float fall = max( 1.0 - vv / r2, 0.0 );
    sum += fall * fall * max( vn, 0.0 ) / ( sqrt( vv ) + 1e-4 );
  }
  float ao = clamp( 1.0 - 2.2 * sum / float( AO_SAMPLES ), 0.0, 1.0 );
  gl_FragColor = vec4( ao, clamp( -P.z * uAO.z, 0.0, 1.0 ), 0.0, 1.0 );
}
`;

/** Separable depth-aware blur of the AO buffer. */
export const AO_BLUR_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tAO;
uniform vec2 uStep;      // texel step along the blur axis
varying vec2 vUv;
void main() {
  vec2 c = texture2D( tAO, vUv ).rg;
  float sum = c.r * 0.2;
  float wsum = 0.2;
  for ( int i = 1; i <= 4; i ++ ) {
    float w = 0.2 - 0.04 * float( i );
    for ( int s = -1; s <= 1; s += 2 ) {
      vec2 t = texture2D( tAO, vUv + uStep * float( i * s ) ).rg;
      // reject samples from a different surface (relative depth difference)
      float wd = w * max( 0.0, 1.0 - abs( t.g - c.g ) / max( c.g * 0.04, 1e-5 ) );
      sum += t.r * wd;
      wsum += wd;
    }
  }
  gl_FragColor = vec4( sum / wsum, c.g, 0.0, 1.0 );
}
`;

/* ------------------------------------------------------------------------------------------------- prep */

/**
 * Applies AO (tinted toward indigo — never grey) and writes the signed circle of confusion into alpha:
 * negative = in front of the focus plane, positive = behind, magnitude 0…1 of the maximum blur radius.
 */
export const PREP_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tAO;
uniform mat4 uProjInv;
uniform vec3 uAOColor;
uniform float uAOIntensity;
uniform vec4 uDof;   // focus distance, sharp range, aperture, amount
uniform vec4 uTilt;  // amount, centre (uv.y), spread, falloff
uniform float uNearMax; // cap of the foreground circle of confusion (fraction of the max blur)
varying vec2 vUv;
void main() {
  vec4 c = texture2D( tColor, vUv );
  float depth = texture2D( tDepth, vUv ).r;
  #ifdef USE_AO
    float ao = texture2D( tAO, vUv ).r;
    c.rgb *= mix( vec3( 1.0 ), uAOColor, ( 1.0 - ao ) * uAOIntensity );
  #endif
  vec4 v = uProjInv * vec4( vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
  float z = depth >= 0.99999 ? 1e5 : -v.z / v.w;
  float dz = z - uDof.x;
  float sd = sign( dz ) * max( abs( dz ) - uDof.y, 0.0 );
  // Background blur grows with depth relative to its own distance (saturates far away); foreground blur is
  // measured against the focus distance and capped, so near objects soften but never smear over the frame.
  float rel = dz < 0.0 ? sd / max( uDof.x, 1e-3 ) : sd / max( z, 1e-3 );
  float coc = clamp( uDof.z * rel, -uNearMax, 1.0 );
  // tilt-shift: additional screen-space band blur above/below the focus line (miniature look)
  float tilt = smoothstep( uTilt.z, uTilt.z + uTilt.w, abs( vUv.y - uTilt.y ) ) * uTilt.x;
  coc = ( coc < 0.0 ? -1.0 : 1.0 ) * max( abs( coc ), tilt );
  gl_FragColor = vec4( c.rgb, coc * uDof.w );
}
`;

/* -------------------------------------------------------------------------------------------------- DOF */

/**
 * Single-pass scatter-as-gather bokeh blur on a jittered Vogel disc (after D. Gustafsson, "Bokeh depth of
 * field in a single pass"). Reads colour + signed CoC (alpha) from the prep buffer.
 */
export const DOF_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tPrep;
uniform vec2 uTexel;
uniform float uMaxBlur; // px
varying vec2 vUv;
${IGN}
void main() {
  vec4 c0 = texture2D( tPrep, vUv );
  float r0 = abs( c0.a ) * uMaxBlur;
  vec3 acc = c0.rgb;
  float tot = 1.0;
  float phi = ign( gl_FragCoord.xy ) * 6.2831853;
  for ( int i = 0; i < DOF_TAPS; i ++ ) {
    float r = sqrt( ( float( i ) + 0.5 ) / float( DOF_TAPS ) ) * uMaxBlur;
    float a = float( i ) * 2.39996323 + phi;
    vec4 s = texture2D( tPrep, vUv + vec2( cos( a ), sin( a ) ) * r * uTexel );
    float sr = abs( s.a ) * uMaxBlur;
    // a sample behind the centre pixel must not smear over it by more than the centre's own blur
    if ( s.a > c0.a ) sr = min( sr, r0 * 2.0 );
    float m = smoothstep( r - 0.5, r + 0.5, sr );
    acc += mix( acc / tot, s.rgb, m );
    tot += 1.0;
  }
  gl_FragColor = vec4( acc / tot, 1.0 );
}
`;

/** Plain copy (used when DOF is off, and for snapshots). */
export const COPY_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4( texture2D( tMap, vUv ).rgb, 1.0 );
}
`;

/* ------------------------------------------------------------------------------------------- transition */

/**
 * Universal chapter transition: direction-aware scale-zoom between a frozen frame of the outgoing chapter
 * and the live incoming one, through a soft circular iris with a glowing rim.
 *   uDir = +1  zoom in  (going down in scale): we dive into the old image; the new world grows from the centre.
 *   uDir = −1  zoom out (going up in scale): the old image shrinks into the centre; the new world surrounds it.
 */
export const TRANSITION_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tLive;
uniform sampler2D tFrozen;
uniform float uProgress;  // 0…1 (already eased)
uniform float uDir;
uniform vec2 uCenter;     // uv of the focus point
uniform float uAspect;
uniform vec3 uAccent;
uniform float uSimple;    // 1 = plain cross-fade (reduced motion)
varying vec2 vUv;
vec3 radialBlur( sampler2D tex, vec2 uv, vec2 center, float strength ) {
  vec3 acc = vec3( 0.0 );
  for ( int i = 0; i < 8; i ++ ) {
    float t = 1.0 - strength * float( i ) / 8.0;
    acc += texture2D( tex, clamp( center + ( uv - center ) * t, 0.0, 1.0 ) ).rgb;
  }
  return acc / 8.0;
}
void main() {
  float p = uProgress;
  if ( uSimple > 0.5 ) {
    gl_FragColor = vec4( mix( texture2D( tFrozen, vUv ).rgb, texture2D( tLive, vUv ).rgb, smoothstep( 0.0, 1.0, p ) ), 1.0 );
    return;
  }
  vec2 d = vUv - uCenter;
  d.x *= uAspect;
  float dist = length( d );
  vec2 far = max( uCenter, 1.0 - uCenter );
  float maxR = length( vec2( far.x * uAspect, far.y ) ) + 0.05;
  float edge = 0.1 + 0.22 * p;
  vec3 oldC;
  vec3 newC;
  float oldMask;
  float R;
  if ( uDir > 0.0 ) {
    R = mix( -0.02, maxR + edge, p );
    oldMask = smoothstep( R - edge, R, dist );
    float sOld = 1.0 + 2.4 * p * p;
    oldC = radialBlur( tFrozen, uCenter + ( vUv - uCenter ) / sOld, uCenter, 0.35 * p );
    float sNew = mix( 0.62, 1.0, 1.0 - ( 1.0 - p ) * ( 1.0 - p ) );
    newC = texture2D( tLive, clamp( uCenter + ( vUv - uCenter ) / sNew, 0.0, 1.0 ) ).rgb;
  } else {
    float q = 1.0 - p;
    R = mix( -0.02, maxR + edge, q );
    oldMask = 1.0 - smoothstep( R - edge, R, dist );
    float sOld = mix( 1.0, 0.3, p );
    oldC = texture2D( tFrozen, clamp( uCenter + ( vUv - uCenter ) / sOld, 0.0, 1.0 ) ).rgb;
    float sNew = mix( 1.7, 1.0, 1.0 - ( 1.0 - p ) * ( 1.0 - p ) );
    newC = radialBlur( tLive, uCenter + ( vUv - uCenter ) / sNew, uCenter, 0.3 * ( 1.0 - p ) );
  }
  vec3 color = mix( newC, oldC, oldMask );
  // glowing rim of the iris — strongest mid-transition, HDR so it blooms
  float ring = exp( -pow( ( dist - ( R - edge * 0.5 ) ) / ( edge * 0.55 ), 2.0 ) ) * sin( p * 3.14159265 );
  color += uAccent * ring * 0.55;
  gl_FragColor = vec4( color, 1.0 );
}
`;

/* ------------------------------------------------------------------------------------------------ bloom */

/** Bright-pass + 13-tap downsample (Jimenez, "Next generation post processing in Call of Duty: AW"). */
export const BLOOM_DOWN_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform vec2 uTexel;       // texel size of the source
uniform vec3 uThreshold;   // threshold, knee, 1 when the bright-pass is active
varying vec2 vUv;
vec3 bright( vec3 c ) {
  // Threshold on the brightest channel with a soft knee that lies entirely ABOVE the threshold:
  // nothing ≤ threshold (i.e. no lit surface, no palette colour) contributes — only emissive pixels do.
  float over = max( c.r, max( c.g, c.b ) ) - uThreshold.x;
  float knee = 2.0 * uThreshold.y;
  float soft = clamp( over, 0.0, knee );
  float amount = max( soft * soft / ( 2.0 * knee + 1e-4 ), over - 0.5 * knee );
  return c * max( amount, 0.0 ) / max( over + uThreshold.x, 1e-4 );
}
vec3 tap( vec2 o ) {
  vec3 c = texture2D( tMap, vUv + o * uTexel ).rgb;
  return uThreshold.z > 0.5 ? bright( min( c, vec3( 64.0 ) ) ) : c;
}
void main() {
  vec3 a = tap( vec2( -2.0, 2.0 ) );
  vec3 b = tap( vec2( 0.0, 2.0 ) );
  vec3 c = tap( vec2( 2.0, 2.0 ) );
  vec3 d = tap( vec2( -2.0, 0.0 ) );
  vec3 e = tap( vec2( 0.0, 0.0 ) );
  vec3 f = tap( vec2( 2.0, 0.0 ) );
  vec3 g = tap( vec2( -2.0, -2.0 ) );
  vec3 h = tap( vec2( 0.0, -2.0 ) );
  vec3 i = tap( vec2( 2.0, -2.0 ) );
  vec3 j = tap( vec2( -1.0, 1.0 ) );
  vec3 k = tap( vec2( 1.0, 1.0 ) );
  vec3 l = tap( vec2( -1.0, -1.0 ) );
  vec3 m = tap( vec2( 1.0, -1.0 ) );
  vec3 color = e * 0.125 + ( a + c + g + i ) * 0.03125 + ( b + d + f + h ) * 0.0625 + ( j + k + l + m ) * 0.125;
  gl_FragColor = vec4( color, 1.0 );
}
`;

/** 3×3 tent upsample of the lower mip, added to the current one. */
export const BLOOM_UP_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tLow;    // smaller mip (being upsampled)
uniform sampler2D tHigh;   // current mip
uniform vec2 uTexel;       // texel size of tLow
uniform float uRadius;     // weight of the wider (lower) mip
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 s = texture2D( tLow, vUv ).rgb * 4.0;
  s += ( texture2D( tLow, vUv + vec2( -o.x, 0.0 ) ).rgb + texture2D( tLow, vUv + vec2( o.x, 0.0 ) ).rgb
       + texture2D( tLow, vUv + vec2( 0.0, -o.y ) ).rgb + texture2D( tLow, vUv + vec2( 0.0, o.y ) ).rgb ) * 2.0;
  s += texture2D( tLow, vUv + vec2( -o.x, -o.y ) ).rgb + texture2D( tLow, vUv + vec2( o.x, -o.y ) ).rgb
     + texture2D( tLow, vUv + vec2( -o.x, o.y ) ).rgb + texture2D( tLow, vUv + vec2( o.x, o.y ) ).rgb;
  gl_FragColor = vec4( texture2D( tHigh, vUv ).rgb + s * ( uRadius / 16.0 ), 1.0 );
}
`;

/* ------------------------------------------------------------------------------------------------ final */

/**
 * Bloom composite → display transform → grade → vignette → grain → sRGB encode.
 *
 * Display transform: values ≤ 1 pass through untouched, so palette colours land on screen exactly as
 * specified (no filmic desaturation). Only overflow above 1 (emissive + bloom) is handled: it bleeds toward
 * white, which gives glows a white-hot core inside a saturated halo, then clips.
 */
export const FINAL_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec4 uBloom;        // intensity, _, _, _
uniform float uExposure;
uniform vec4 uGrade;        // lift, contrast, vibrance, saturation
uniform vec3 uLiftColor;
uniform vec4 uVignette;     // intensity, radius, softness, aspect
uniform vec3 uVignetteColor;
uniform vec3 uGrain;        // intensity, time, _
uniform vec2 uChroma;       // amount (uv units at the corner), _
uniform vec4 uMoodTint;     // rgb multiplier, amount
uniform vec4 uMoodHarmony;  // rgb dominant colour (display space), strength
uniform vec3 uMoodAccent;   // rgb accent colour that is exempt from the harmony pull
varying vec2 vUv;
float luma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
vec3 toSRGB( vec3 c ) {
  return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( vec3( 0.0031308 ), c ) );
}
float hash( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
vec3 sampleHDR( vec2 uv ) {
  return texture2D( tScene, uv ).rgb + texture2D( tBloom, uv ).rgb * uBloom.x;
}
void main() {
  vec2 fromCenter = vUv - 0.5;
  vec3 color;
  if ( uChroma.x > 0.0 ) {
    // chromatic aberration — transitions only (STYLE_GUIDE §4)
    vec2 off = fromCenter * dot( fromCenter, fromCenter ) * uChroma.x * 4.0;
    color = vec3( sampleHDR( vUv + off ).r, sampleHDR( vUv ).g, sampleHDR( vUv - off ).b );
  } else {
    color = sampleHDR( vUv );
  }
  color *= uExposure;
  // overflow → white bleed, then clip (identity for colours ≤ 1)
  float peak = max( color.r, max( color.g, color.b ) );
  color = mix( color, vec3( peak ), 1.0 - exp( -max( peak - 1.0, 0.0 ) * 0.7 ) );
  color = clamp( color, 0.0, 1.0 );
  // grade in display (gamma) space
  vec3 g = toSRGB( color );
  float l = luma( g );
  g += uLiftColor * ( uGrade.x * pow( 1.0 - l, 4.0 ) );                       // shadows lifted toward violet
  g = mix( g, g * g * ( 3.0 - 2.0 * g ), uGrade.y );                           // gentle S-curve
  float sat = max( g.r, max( g.g, g.b ) ) - min( g.r, min( g.g, g.b ) );
  l = luma( g );
  g = mix( vec3( l ), g, 1.0 + uGrade.z * ( 1.0 - sat ) );                     // vibrance: lifts muted colours only
  g = mix( vec3( l ), g, uGrade.w );                                           // global saturation
  // Mood grade (set by the environment preset; zero for day / studio / micro, where palette tokens must
  // land exactly). Warm presets pull the whole frame into an analogous palette: a light tint, then hues that
  // are not analogous to the dominant colour are desaturated and partly redirected onto its axis (greens go
  // olive, blues go slate) while luma is preserved. One accent hue is exempt.
  if ( uMoodTint.a > 0.0 ) {
    g = mix( g, g * uMoodTint.rgb, uMoodTint.a );
  }
  if ( uMoodHarmony.a > 0.0 ) {
    float lum = luma( g );
    vec3 chroma = g - lum;
    vec3 axis = uMoodHarmony.rgb - luma( uMoodHarmony.rgb );
    axis /= max( length( axis ), 1e-4 );
    vec3 accent = uMoodAccent - luma( uMoodAccent );
    float keep = smoothstep( 0.75, 0.95, dot( chroma, accent ) / max( length( chroma ) * length( accent ), 1e-4 ) );
    float h = uMoodHarmony.a * ( 1.0 - keep );
    float along = dot( chroma, axis );
    vec3 across = chroma - axis * along;
    along = along >= 0.0 ? along : along * ( 1.0 - h );
    along += length( across ) * 0.35 * h;
    g = lum + axis * along + across * ( 1.0 - 0.8 * h );
  }
  // vignette: toward deep indigo, never black
  vec2 vd = fromCenter * vec2( mix( 1.0, uVignette.w, 0.5 ), 1.0 );
  float vig = smoothstep( uVignette.y, uVignette.y + uVignette.z, length( vd ) * 1.4142 ) * uVignette.x;
  g = mix( g, g * uVignetteColor, vig );
  // animated film grain (also dithers gradients against banding)
  float n = hash( gl_FragCoord.xy + fract( uGrain.y * 7.123 ) * 311.7 ) - 0.5;
  g += n * uGrain.x * mix( 1.0, 0.45, l );
  gl_FragColor = vec4( clamp( g, 0.0, 1.0 ), 1.0 );
}
`;

/* ------------------------------------------------------------------------------------------------- FXAA */

/** three.js' FXAA (NVIDIA / J. Flick / D. Hoskins) with sub-pixel blending toned down to keep SDF text crisp. */
export const FXAA_FRAGMENT = FXAAShader.fragmentShader.replace(
  'float _SubpixelBlending = 1.0;',
  'float _SubpixelBlending = 0.55;',
);
