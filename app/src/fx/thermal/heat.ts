/**
 * Heat: stylised shimmer (rising wavy lines — the cartoon convention for hot air; real refraction would need
 * the scene colour buffer), and helpers that make a surface glow with temperature.
 */
import { AdditiveBlending, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from 'three';
import { col, heatRamp, kGlobals, type ColorLike, type KToonMaterial } from '@/style';
import { FX_COMMON, FX_NOISE } from '../core/glsl';

export interface HeatShimmerOptions {
  /** Width / height of the shimmering column, units. Defaults 1 / 1.5. */
  width?: number;
  height?: number;
  color?: ColorLike;
  /** Number of wavy lines. Default 5. */
  lines?: number;
  /** Brightness. Default 0.8. */
  intensity?: number;
  /** Rise speed multiplier. Default 1. */
  speed?: number;
}

/** Heat shimmer above a hot surface: stands on the object's origin, rises along +Y, faces the camera. */
export class HeatShimmer extends Mesh<PlaneGeometry, ShaderMaterial> {
  constructor(o: HeatShimmerOptions = {}) {
    const material = new ShaderMaterial({
      name: 'fx.heat-shimmer',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uColor: { value: col(o.color ?? 'orange') },
        uSize: { value: new Vector4(o.width ?? 1, o.height ?? 1.5, o.lines ?? 5, o.speed ?? 1) },
        uOut: { value: new Vector4(o.intensity ?? 0.8, 1, 0, 0) },
      },
      vertexShader: /* glsl */ `
        uniform vec4 uSize;
        varying vec2 vQ;
        void main() {
          vec3 base = ( modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
          vec3 up = ( modelViewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz;
          vec3 side = normalize( cross( up, - base ) ) * length( up );
          vQ = vec2( position.x, uv.y );
          gl_Position = projectionMatrix * vec4( base + up * ( uv.y * uSize.y ) + side * ( position.x * uSize.x ), 1.0 );
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uKTime;
        uniform vec3 uColor;
        uniform vec4 uSize; // width, height, lines, speed
        uniform vec4 uOut;  // intensity, fade
        varying vec2 vQ;
        ${FX_COMMON}
        ${FX_NOISE}
        void main() {
          float t = uKTime * uSize.w;
          float n = uSize.z;
          float col = ( vQ.x + 0.5 ) * n;
          float id = floor( col );
          float h = fxHash11( id + 3.0 );
          // each line is a vertical wave that rises; dashes travel up and fade toward the top
          float wave = sin( vQ.y * ( 7.0 + h * 5.0 ) - t * ( 2.0 + h * 1.5 ) + h * 20.0 ) * 0.22 * smoothstep( 0.0, 0.3, vQ.y );
          float x = fract( col ) - 0.5 - wave;
          float w = fwidth( col ) * 1.2;
          float line = 1.0 - smoothstep( 0.035, 0.035 + w, abs( x ) );
          float dash = smoothstep( 0.15, 0.4, fract( vQ.y * 1.3 - t * ( 0.35 + h * 0.25 ) + h ) ) * smoothstep( 1.0, 0.75, fract( vQ.y * 1.3 - t * ( 0.35 + h * 0.25 ) + h ) );
          float env = smoothstep( 0.0, 0.12, vQ.y ) * ( 1.0 - smoothstep( 0.45, 1.0, vQ.y ) ) * ( 1.0 - smoothstep( 0.3, 0.5, abs( vQ.x ) ) );
          gl_FragColor = vec4( uColor * ( line * dash * env * uOut.x * uOut.y ), 0.0 );
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      premultipliedAlpha: true,
      side: DoubleSide,
    });
    super(new PlaneGeometry(1, 1), material);
    this.name = 'heat-shimmer';
    this.frustumCulled = false;
    this.raycast = () => undefined; // shader-shaped: the base geometry is not where the effect is
  }

  /** Brightness (tweenable: map to temperature). */
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
}

export function createHeatShimmer(o: HeatShimmerOptions = {}): HeatShimmer {
  return new HeatShimmer(o);
}

/**
 * Make a `K.toon` / `K.metal` surface glow with heat: `t` 0 = cold (no glow) … 1 = white-hot `red`.
 * Colour follows the heat ramp `orange` → `red`; brightness rises quadratically so that a warm part only
 * hints at a glow and a hot one blooms.
 */
export function applyHeat(material: KToonMaterial, t: number, maxIntensity = 2.2): void {
  const k = Math.min(Math.max(t, 0), 1);
  heatRamp(k, material.emissive);
  material.emissiveIntensity = k * k * maxIntensity;
}
