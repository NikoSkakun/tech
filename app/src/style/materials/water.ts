/**
 * K.water — flat stylised water surface (STYLE_GUIDE §3): gentle shader waves, moving glint lines,
 * foam rings along the shore and a shallow→deep colour gradient. Receives tinted shadows and fog.
 */
import {
  type Color,
  FrontSide,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  Vector4,
  type IUniform,
  type Side,
} from 'three';
import { col, type ColorLike } from '../palette';
import { K_FRAGMENT_COMMON, K_LIGHTING_PARS, kVertexShader } from './chunks';
import { linkGlobals } from './globals';

export interface WaterParams {
  /** Colour near the shore. Default `sky`. */
  shallow?: ColorLike;
  /** Colour in the middle / far from the shore. Default `blue`. */
  deep?: ColorLike;
  /** Foam and glint colour. Default `white`. */
  foam?: ColorLike;
  /**
   * How the shore distance is derived from UVs:
   * `disc` — radial (CircleGeometry / square plane: shore at the rim), `strip` — across V (rivers: banks at
   * v = 0 and v = 1), `open` — no shore (sea to the horizon).
   */
  shape?: 'disc' | 'strip' | 'open';
  /**
   * World-space size of the glint / tone pattern (bigger = larger features). Default 1.6 — sized for the F1
   * reference scenes; with `followLook` it is in *reference* units and multiplied by `env.lookScale`.
   */
  scale?: number;
  /**
   * Let the pattern follow `env.setScale(r, { adaptFrom })` like fog / AO / DOF do: world size = `scale` ×
   * `env.lookScale`, so a scene rebuilt in metres + `adaptFrom` keeps the glint size of its reference-unit
   * version (M3). Opt-in; default false keeps `scale` in plain world units.
   */
  followLook?: boolean;
  /** Animation speed multiplier. Default 1. */
  speed?: number;
  /** Vertex wave height in local units. Default 0.03. */
  waveHeight?: number;
  /** Amount of glint lines, 0…1. Default 0.6. */
  glints?: number;
  /** Amount of shore foam, 0…1. Default 1. */
  foamAmount?: number;
  /** Constant opacity < 1 makes the surface translucent. Default 1 (opaque, stylised). */
  opacity?: number;
  side?: Side;
  fog?: boolean;
  name?: string;
}

const WATER_VERTEX_PARS = /* glsl */ `
uniform vec4 uWave; // scale, speed, wave height, glints
`;

const WATER_VERTEX_TRANSFORM = /* glsl */ `
  {
    vec2 wp = position.xy * 1.7 / max( uWave.x, 1e-3 );
    float wt = uKTime * uWave.y;
    transformed += normal * ( sin( wp.x + wt * 1.1 ) * cos( wp.y * 0.8 - wt * 0.7 ) * uWave.z );
  }
`;

const WATER_FRAGMENT = /* glsl */ `
${K_FRAGMENT_COMMON}
varying vec2 vKUv;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec4 uWave; // scale, speed, wave height, glints
uniform float uFoamAmount;
${K_LIGHTING_PARS}
void main() {
  kFadeDiscard();
  #if defined( K_WATER_DISC )
    float shore = saturate( length( vKUv - 0.5 ) * 2.0 );
  #elif defined( K_WATER_STRIP )
    float shore = saturate( abs( vKUv.y - 0.5 ) * 2.0 );
  #else
    float shore = 0.0;
  #endif
  float t = uKTime * uWave.y;
  #ifdef K_WATER_FOLLOW_LOOK
    vec2 p = vKWorldPos.xz / max( uWave.x * uKLookScale, 1e-3 );
  #else
    vec2 p = vKWorldPos.xz / max( uWave.x, 1e-3 );
  #endif
  // depth gradient: shallow at the shore, deep in the middle
  vec3 base = mix( uDeep, uShallow, smoothstep( 0.25, 1.0, shore ) );
  // soft large-scale tone variation so the surface is never a dead flat colour
  float swell = kNoise( p * 0.55 + vec2( t * 0.11, -t * 0.07 ) );
  base *= mix( 0.93, 1.06, swell );
  // glint lines: where two drifting noise fields cross — thin, organic, cel-style highlights
  float n1 = kNoise( p * 1.3 + vec2( t * 0.23, t * 0.17 ) );
  float n2 = kNoise( p * 1.9 - vec2( t * 0.19, -t * 0.21 ) + 7.3 );
  float lineW = 0.035;
  float glint = ( 1.0 - smoothstep( lineW * 0.4, lineW, abs( n1 - n2 ) ) ) * smoothstep( 0.35, 0.6, n1 ) * uWave.w;
  // foam: animated rings near the shore + a solid lip at the very edge
  float ring = fract( shore * 5.0 - t * 0.22 + ( n1 - 0.5 ) * 0.35 );
  float rings = smoothstep( 0.42, 0.5, ring ) * ( 1.0 - smoothstep( 0.62, 0.7, ring ) );
  float foam = rings * smoothstep( 0.62, 0.92, shore ) * 0.75 + smoothstep( 0.93, 0.965, shore + ( n2 - 0.5 ) * 0.04 );
  foam = saturate( foam * uFoamAmount );
  vec3 surface = mix( base, uFoam, saturate( glint * 0.55 + foam ) );
  #include <normal_fragment_begin>
  vec3 color = kShade( surface, normal );
  gl_FragColor = vec4( color, opacity );
  #include <fog_fragment>
}
`;

/** Stylised water surface. Create through `K.water()`. The mesh needs UVs (see `WaterParams.shape`). */
export class KWaterMaterial extends ShaderMaterial {
  readonly isKMaterial = true;

  constructor(params: WaterParams = {}) {
    super();
    this.name = params.name ?? 'K.water';
    const own: Record<string, IUniform> = {
      opacity: { value: params.opacity ?? 1 },
      uFade: { value: 1 },
      uShallow: { value: col(params.shallow ?? 'sky') },
      uDeep: { value: col(params.deep ?? 'blue') },
      uFoam: { value: col(params.foam ?? 'white') },
      uWave: {
        value: new Vector4(
          params.scale ?? 1.6,
          params.speed ?? 1,
          params.waveHeight ?? 0.03,
          params.glints ?? 0.6,
        ),
      },
      uFoamAmount: { value: params.foamAmount ?? 1 },
      // lighting: flat water uses a wide soft terminator and no highlight band / rim
      uBand: { value: new Vector4(0.0, 0.2, 2.0, 0.0) },
      uRim: { value: new Vector3(0, 0.6, 0.1) },
    };
    this.uniforms = UniformsUtils.merge([UniformsLib.lights, UniformsLib.fog, own]);
    linkGlobals(this.uniforms);
    const shape = params.shape ?? 'disc';
    this.defines = shape === 'disc' ? { K_WATER_DISC: '' } : shape === 'strip' ? { K_WATER_STRIP: '' } : {};
    if (params.followLook) this.defines.K_WATER_FOLLOW_LOOK = '';
    this.vertexShader = kVertexShader({
      uv: true,
      pars: WATER_VERTEX_PARS,
      transform: WATER_VERTEX_TRANSFORM,
    });
    this.fragmentShader = WATER_FRAGMENT;
    this.lights = true;
    this.fog = params.fog ?? true;
    this.side = params.side ?? FrontSide;
    if ((params.opacity ?? 1) < 1) {
      this.transparent = true;
      this.depthWrite = false;
    }
  }

  get shallow(): Color {
    return this.uniforms.uShallow!.value as Color;
  }

  get deep(): Color {
    return this.uniforms.uDeep!.value as Color;
  }

  /** Dissolve factor 0…1 (tweenable). */
  get fade(): number {
    return this.uniforms.uFade!.value as number;
  }
  set fade(v: number) {
    this.uniforms.uFade!.value = v;
  }

  override clone(): this {
    const m = super.clone();
    linkGlobals(m.uniforms);
    return m;
  }
}
