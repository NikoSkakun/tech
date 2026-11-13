/**
 * Flame — stylised layered tongues of fire (outer `orange`/`red`, middle `yellow`, white-hot core) with a
 * wobbling, licking silhouette. One quad that turns around the flame axis to face the camera. The flame
 * stands on the object's origin and burns along local +Y (rotate the object for a horizontal burner).
 */
import { type Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from 'three';
import { col, kGlobals, type ColorLike } from '@/style';
import { FX_COMMON, FX_NOISE } from '../core/glsl';

export interface FlameOptions {
  /** Height at full power, units. Default 1. */
  height?: number;
  /** Width at the widest point, units. Default 0.5. */
  width?: number;
  /** Outer, middle and core colours. Default `orange` / `yellow` / `white` (combustion). */
  colors?: readonly [ColorLike, ColorLike, ColorLike];
  /** Brightness (> 1 blooms). Default 1.6. */
  intensity?: number;
  /** 0…1 size / brightness of the flame (tweenable: 0 = out). Default 1. */
  power?: number;
  /** Flicker speed multiplier. Default 1. */
  speed?: number;
  /** Phase offset so that neighbouring flames do not move in unison. Default 0. */
  seed?: number;
}

const VERTEX = /* glsl */ `
uniform vec4 uFlame; // height, width, power, seed
varying vec2 vQ;
void main() {
  vec3 base = ( modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  vec3 up = ( modelViewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz; // carries the object's scale
  vec3 side = normalize( cross( up, - base ) ) * length( up );
  float grow = 0.25 + 0.75 * uFlame.z;
  vec3 P = base + up * ( uv.y * uFlame.x * grow ) + side * ( position.x * uFlame.y * 1.5 * mix( 0.6, 1.0, uFlame.z ) );
  vQ = vec2( position.x * 2.0 * 1.5, uv.y );
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uOuter;
uniform vec3 uMid;
uniform vec3 uCore;
uniform vec4 uFlame; // height, width, power, seed
uniform vec4 uOut;   // intensity, fade, speed, unused
varying vec2 vQ;
${FX_COMMON}
${FX_NOISE}
// teardrop profile: half-width of the flame at height y (0 base … 1 tip)
float profile( float y ) {
  return pow( saturate( y ) * 1.0, 0.45 ) * pow( saturate( 1.0 - y ), 0.75 ) * 1.75;
}
void main() {
  float t = uKTime * uOut.z + uFlame.w * 17.0;
  float y = vQ.y;
  // licking: the silhouette is pushed sideways by noise that scrolls upward, more strongly near the tip
  float sway = ( fxNoise( vec2( y * 2.6 - t * 2.4, t * 0.6 + uFlame.w ) ) - 0.5 ) * 0.7 * y
             + ( fxNoise( vec2( y * 6.0 - t * 4.2, 3.7 ) ) - 0.5 ) * 0.25 * y;
  float flick = 0.86 + 0.14 * fxNoise( vec2( t * 3.1, 9.0 + uFlame.w ) );
  float x = abs( vQ.x + sway );
  float yy = y / flick;
  float d = x / max( profile( yy ), 1e-3 ) + step( 1.0, yy ) * 4.0;
  float aa = fwidth( d ) * 1.2;
  float outer = 1.0 - smoothstep( 1.0 - aa, 1.0, d );
  // inner layers are smaller flames sitting lower (each with its own tip)
  float dm = x / max( profile( yy * 1.45 ) * 0.62, 1e-3 ) + step( 1.0, yy * 1.45 ) * 4.0;
  float mid = 1.0 - smoothstep( 1.0 - aa * 1.6, 1.0, dm );
  float dc = x / max( profile( yy * 2.3 ) * 0.33, 1e-3 ) + step( 1.0, yy * 2.3 ) * 4.0;
  float core = 1.0 - smoothstep( 1.0 - aa * 2.6, 1.0, dc );
  if ( outer < 0.01 ) discard;
  vec3 color = mix( uOuter, uMid, mid );
  color = mix( color, uCore * 1.3, core );
  // the base of the flame is a little transparent and cooler, as at a burner mouth
  float alpha = outer * mix( 0.75, 1.0, smoothstep( 0.0, 0.25, y ) ) * uOut.y;
  gl_FragColor = vec4( color * ( uOut.x * ( 0.55 + 0.45 * uFlame.z ) ) * alpha, alpha );
}
`;

/** A flame. Create through `createFlame()` / `createGasFlame()`. */
export class Flame extends Mesh<PlaneGeometry, ShaderMaterial> {
  constructor(o: FlameOptions = {}) {
    const colors = o.colors ?? ['orange', 'yellow', 'white'];
    const material = new ShaderMaterial({
      name: 'fx.flame',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uOuter: { value: col(colors[0]) },
        uMid: { value: col(colors[1]) },
        uCore: { value: col(colors[2]) },
        uFlame: { value: new Vector4(o.height ?? 1, o.width ?? 0.5, o.power ?? 1, o.seed ?? 0) },
        uOut: { value: new Vector4(o.intensity ?? 1.6, 1, o.speed ?? 1, 0) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      side: DoubleSide,
    });
    super(new PlaneGeometry(1, 1), material);
    this.name = 'flame';
    this.frustumCulled = false;
    this.raycast = () => undefined; // shader-shaped: the base geometry is not where the effect is
  }

  /** 0…1 size and brightness (tweenable; map it to fuel flow / thermal power). */
  get power(): number {
    return (this.material.uniforms.uFlame!.value as Vector4).z;
  }
  set power(v: number) {
    (this.material.uniforms.uFlame!.value as Vector4).z = v;
    this.visible = v > 0.005;
  }
  get intensity(): number {
    return (this.material.uniforms.uOut!.value as Vector4).x;
  }
  set intensity(v: number) {
    (this.material.uniforms.uOut!.value as Vector4).x = v;
  }
  get fade(): number {
    return (this.material.uniforms.uOut!.value as Vector4).y;
  }
  set fade(v: number) {
    (this.material.uniforms.uOut!.value as Vector4).y = v;
  }
  /** Outer / middle / core colours (live). */
  get colors(): [Color, Color, Color] {
    const u = this.material.uniforms;
    return [u.uOuter!.value as Color, u.uMid!.value as Color, u.uCore!.value as Color];
  }
}

/** Combustion flame: `orange` → `yellow` → white (coal, biomass, oil). */
export function createFlame(o: FlameOptions = {}): Flame {
  return new Flame(o);
}

/** Gas burner flame: `blue` → `sky` → white, slimmer and steadier. */
export function createGasFlame(o: FlameOptions = {}): Flame {
  return new Flame({ colors: ['blue', 'sky', 'white'], width: 0.32, speed: 0.7, ...o });
}
