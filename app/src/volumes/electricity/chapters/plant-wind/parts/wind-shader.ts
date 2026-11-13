/** GLSL of `windField` (see wind-field.ts). `MAX_WAKES` must match the uniform arrays there. */
export const WIND_VERTEX = /* glsl */ `
#define MAX_WAKES 20
attribute vec4 aSeed;
uniform float uOffset;
uniform vec2 uDir;
uniform vec3 uCentre;
uniform vec3 uSize;
uniform vec4 uShape;
uniform vec4 uWakes[ MAX_WAKES ];
uniform float uWakeStrength[ MAX_WAKES ];
uniform int uWakeCount;
varying vec2 vUv;
varying float vFade;
varying float vWake;

void main() {
  vec3 dir = vec3( uDir.x, 0.0, uDir.y );
  vec3 side = vec3( - uDir.y, 0.0, uDir.x );
  // where this streak is in the box: it travels with the wind and wraps around
  float along = fract( aSeed.x + uOffset / uSize.x );
  float lat = ( aSeed.z - 0.5 ) * uSize.z;
  float height = uCentre.y + aSeed.y * uSize.y;
  vec3 head = vec3( uCentre.x, height, uCentre.z ) + dir * ( ( along - 0.5 ) * uSize.x ) + side * lat;

  // wake of every rotor upstream of the streak: Jensen expansion with a Gaussian cross profile
  float deficit = 0.0;
  for ( int i = 0; i < MAX_WAKES; i ++ ) {
    if ( i >= uWakeCount ) break;
    vec3 d = head - uWakes[ i ].xyz;
    float x = dot( d, dir );
    float R = uWakes[ i ].w;
    if ( x > - R * 0.2 && x < R * 30.0 ) {
      float xx = max( x, 0.0 );
      float rw = R + 0.075 * xx;
      float sigma = rw * 0.5;
      float r2 = dot( d, d ) - x * x;
      float d0 = 0.553 * pow( R / rw, 2.0 ); // 1 − √(1 − C_T), C_T = 0.8
      float w = d0 * exp( - r2 / ( 2.0 * sigma * sigma ) ) * smoothstep( - R * 0.2, R * 0.3, x );
      deficit = sqrt( deficit * deficit + w * w * uWakeStrength[ i ] * uWakeStrength[ i ] );
    }
  }
  vWake = clamp( deficit * 2.2, 0.0, 1.0 );

  // slower air → shorter streak; gentle vertical meander so the ribbons feel like air, not rain
  float len = uShape.x * ( 0.55 + 0.9 * aSeed.w ) * ( 1.0 - 0.6 * deficit );
  float s = ( position.x - 1.0 ) * len;
  vec3 p = head + dir * s;
  p.y += sin( ( dot( p, dir ) ) * 0.045 + aSeed.w * 6.2831 ) * ( 0.8 + 1.4 * aSeed.y );
  vec3 toCam = normalize( cameraPosition - p );
  vec3 wide = normalize( cross( dir, toCam ) );
  float taper = sin( 3.14159 * clamp( position.x, 0.0, 1.0 ) );
  // never thinner than ≈ 2 px: in the wide shots the streaks are hundreds of metres away
  float halfW = max( uShape.y, distance( cameraPosition, p ) * 0.0019 );
  p += wide * position.y * halfW * ( 0.35 + 0.65 * taper ) * ( 0.7 + 0.6 * aSeed.z );
  vUv = vec2( position.x, position.y );
  vFade = smoothstep( 0.0, 0.1, along ) * smoothstep( 1.0, 0.9, along );
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}
`;

export const WIND_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec4 uShape;
uniform vec3 uColor;
uniform vec3 uTail;
uniform vec3 uWakeColor;
varying vec2 vUv;
varying float vFade;
varying float vWake;

void main() {
  // bright head, fading tail, soft edges across
  float alongA = smoothstep( 0.0, 0.75, vUv.x ) * smoothstep( 1.0, 0.93, vUv.x );
  float across = 1.0 - vUv.y * vUv.y;
  vec3 c = mix( mix( uTail, uColor, vUv.x ), uWakeColor, vWake );
  // 25–40 % opacity (document); wake streaks are a little denser so the dark plume reads
  float a = uShape.z * vFade * alongA * across * mix( 0.46, 0.68, vWake );
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( c, a );
}
`;
