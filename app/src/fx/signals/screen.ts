/**
 * Instrument screen: a dark rounded glass plate with a measurement grid — the backdrop of oscilloscope
 * traces, phasor diagrams and spectrum bars.
 */
import { Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from 'three';
import { col, type ColorLike } from '@/style';

export interface ScreenOptions {
  width: number;
  height: number;
  /** Grid divisions horizontally / vertically. Default 10 × 6. */
  divisions?: readonly [number, number];
  /** Border / grid tint. Default `cyan`. */
  accent?: ColorLike;
  /** `grid` (rectangular) or `polar` (circles + spokes, for phasors). Default `grid`. */
  kind?: 'grid' | 'polar';
  /** Corner radius, units. Default 6 % of the height. */
  radius?: number;
}

const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uFill;
uniform vec3 uAccent;
uniform vec4 uSize; // width, height, corner radius, polar
uniform vec4 uGrid; // divisions x, y, fade, unused
varying vec2 vP;
float roundRect( vec2 p, vec2 h, float r ) {
  vec2 q = abs( p ) - h + r;
  return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - r;
}
void main() {
  vec2 h = uSize.xy * 0.5;
  float d = roundRect( vP, h, uSize.z );
  float aa = fwidth( d );
  float inside = 1.0 - smoothstep( - aa, aa, d );
  if ( inside < 0.01 ) discard;
  vec3 color = uFill * mix( 0.8, 1.15, vP.y / uSize.y + 0.5 );
  float line = 0.0;
  float axis = 0.0;
  if ( uSize.w > 0.5 ) {
    // polar grid: 4 circles, 12 spokes
    float R = min( h.x, h.y ) * 0.86;
    float r = length( vP ) / R;
    float wr = fwidth( r * 4.0 );
    line = ( 1.0 - smoothstep( 0.0, wr * 1.5, abs( fract( r * 4.0 + 0.5 ) - 0.5 ) ) ) * step( r, 1.02 );
    float a = atan( vP.y, vP.x ) / 6.2832 * 12.0;
    float wa = fwidth( a );
    line = max( line, ( 1.0 - smoothstep( 0.0, wa * 1.5, abs( fract( a + 0.5 ) - 0.5 ) ) ) * step( r, 1.0 ) * step( 0.06, r ) * 0.6 );
    axis = ( 1.0 - smoothstep( 0.0, wr * 1.5, abs( r - 1.0 ) * 4.0 ) );
  } else {
    vec2 g = ( vP / uSize.xy + 0.5 ) * uGrid.xy;
    vec2 w = fwidth( g ) * 1.5;
    vec2 l = 1.0 - smoothstep( vec2( 0.0 ), w, abs( fract( g + 0.5 ) - 0.5 ) );
    line = max( l.x, l.y );
    vec2 c = 1.0 - smoothstep( vec2( 0.0 ), w * 1.4, abs( g - uGrid.xy * 0.5 ) );
    axis = max( c.x, c.y );
  }
  color += uAccent * ( line * 0.1 + axis * 0.22 );
  float border = smoothstep( - 0.035 - aa, - 0.035 + aa, d );
  color = mix( color, uAccent * 0.9, border * 0.75 );
  gl_FragColor = vec4( color, inside * 0.94 * uGrid.z );
}
`;

/** Screen plate in the local XY plane, centred on the origin. */
export class Screen extends Mesh<PlaneGeometry, ShaderMaterial> {
  constructor(o: ScreenOptions) {
    const material = new ShaderMaterial({
      name: 'fx.screen',
      uniforms: {
        uFill: { value: col('bg.deep') },
        uAccent: { value: col(o.accent ?? 'cyan') },
        uSize: { value: new Vector4(o.width, o.height, o.radius ?? o.height * 0.06, o.kind === 'polar' ? 1 : 0) },
        uGrid: { value: new Vector4(o.divisions?.[0] ?? 10, o.divisions?.[1] ?? 6, 1, 0) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() {
          vP = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: FRAGMENT,
      transparent: true,
    });
    super(new PlaneGeometry(o.width, o.height), material);
    this.name = 'screen';
  }

  get fade(): number {
    return (this.material.uniforms.uGrid!.value as Vector4).z;
  }
  set fade(v: number) {
    (this.material.uniforms.uGrid!.value as Vector4).z = v;
  }
}

export function createScreen(o: ScreenOptions): Screen {
  return new Screen(o);
}
