/**
 * Flowing water: a ribbon along a curve (river, canal, spillway, waterfall, open pipe cross-section) with
 * streaks that run downstream, foam along the banks and optional white water. `K.water` (style) is for
 * still surfaces; this one has a direction and a speed.
 */
import { BufferAttribute, BufferGeometry, type Color, type Curve, DoubleSide, Mesh, ShaderMaterial, Vector3, Vector4 } from 'three';
import { col, kGlobals, SEMANTIC, type ColorLike } from '@/style';
import { FX_COMMON, FX_NOISE } from '../core/glsl';
import { onTick } from '../core/tick';

export interface WaterStripOptions {
  /** Width of the stream, units (or [start, end] to widen / narrow). Default 1. */
  width?: number | readonly [number, number];
  /** Flow speed, units/s (tweenable through `.speed`). Default 1.5. */
  speed?: number;
  shallow?: ColorLike;
  deep?: ColorLike;
  foam?: ColorLike;
  /** 0…1 share of white water (0 calm river … 1 spillway / waterfall). Default 0.25. */
  whiteWater?: number;
  /** Up direction used to lay the ribbon flat. Default +Y; for a vertical fall pass the face normal. */
  up?: Vector3;
  /** Segments along the curve. Default 64. */
  segments?: number;
  opacity?: number;
}

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec4 uWater; // flow phase (units), white water, opacity, fade
varying vec2 vUvw; // x = distance along (units), y = 0…1 across
varying float vWidth;
${FX_COMMON}
${FX_NOISE}
void main() {
  float across = abs( vUvw.y - 0.5 ) * 2.0; // 0 middle … 1 bank
  float u = vUvw.x - uWater.x;
  vec3 color = mix( uDeep, uShallow, smoothstep( 0.35, 1.0, across ) );
  // streaks: noise stretched along the flow, carried downstream; faster in the middle like a real stream
  float lane = vUvw.y * vWidth * 3.2;
  float s1 = fxNoise( vec2( u * 0.9 - across * 0.4, lane ) );
  float s2 = fxNoise( vec2( u * 2.1 + 5.0, lane * 2.3 + 7.0 ) );
  float streak = smoothstep( 0.62, 0.78, s1 * 0.65 + s2 * 0.35 );
  color = mix( color, mix( color, uFoam, 0.55 ), streak * ( 0.35 + 0.65 * uWater.y ) );
  // foam: a scalloped lip along both banks, and broken white water where the flow is violent
  float lip = smoothstep( 0.86, 0.93, across + ( fxNoise( vec2( u * 1.6, vUvw.y * 9.0 ) ) - 0.5 ) * 0.12 );
  float rapids = smoothstep( 1.0 - uWater.y, 1.02, s1 * 0.6 + fxNoise( vec2( u * 3.0, lane * 0.8 ) ) * 0.5 + uWater.y * 0.45 );
  color = mix( color, uFoam, saturate( lip + rapids * uWater.y ) );
  float alpha = uWater.z * uWater.w * ( 1.0 - smoothstep( 0.97, 1.0, across ) );
  gl_FragColor = vec4( min( color, vec3( 1.0 ) ) * alpha, alpha );
}
`;

/** Flowing water ribbon. Create through `createWaterStrip()`. */
export class WaterStrip extends Mesh<BufferGeometry, ShaderMaterial> {
  /** Flow speed, units/s (tweenable; 0 = still, negative = upstream). */
  speed: number;

  constructor(curve: Curve<Vector3>, o: WaterStripOptions = {}) {
    const n = o.segments ?? 64;
    const w = typeof o.width === 'number' || o.width === undefined ? [o.width ?? 1, o.width ?? 1] : o.width;
    const up = (o.up ?? new Vector3(0, 1, 0)).clone().normalize();
    const position = new Float32Array((n + 1) * 2 * 3);
    const uvw = new Float32Array((n + 1) * 2 * 3);
    const index: number[] = [];
    const p = new Vector3();
    const t = new Vector3();
    const side = new Vector3();
    const length = curve.getLength();
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      curve.getPointAt(k, p);
      curve.getTangentAt(k, t);
      side.crossVectors(t, up);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const width = w[0]! + (w[1]! - w[0]!) * k;
      for (let s = 0; s < 2; s++) {
        const o3 = (i * 2 + s) * 3;
        const sign = s === 0 ? -0.5 : 0.5;
        position.set([p.x + side.x * width * sign, p.y + side.y * width * sign, p.z + side.z * width * sign], o3);
        uvw.set([k * length, s, width], o3);
      }
      if (i < n) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('aUvw', new BufferAttribute(uvw, 3));
    geometry.setIndex(index);
    const material = new ShaderMaterial({
      name: 'fx.water-strip',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uShallow: { value: col(o.shallow ?? SEMANTIC.water) },
        uDeep: { value: col(o.deep ?? SEMANTIC.cold) },
        uFoam: { value: col(o.foam ?? 'white') },
        uWater: { value: new Vector4(0, o.whiteWater ?? 0.25, o.opacity ?? 1, 1) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aUvw;
        varying vec2 vUvw;
        varying float vWidth;
        void main() {
          vUvw = aUvw.xy;
          vWidth = aUvw.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: FRAGMENT,
      transparent: true,
      premultipliedAlpha: true,
      side: DoubleSide,
    });
    super(geometry, material);
    this.name = 'water-strip';
    this.speed = o.speed ?? 1.5;
    onTick(this, (_time, dt) => {
      const u = material.uniforms.uWater!.value as Vector4;
      u.x = (u.x + this.speed * dt) % 4096;
    });
  }

  /** 0…1 share of white water (tweenable: open the spillway gate → more foam). */
  get whiteWater(): number {
    return (this.material.uniforms.uWater!.value as Vector4).y;
  }
  set whiteWater(v: number) {
    (this.material.uniforms.uWater!.value as Vector4).y = v;
  }
  get fade(): number {
    return (this.material.uniforms.uWater!.value as Vector4).w;
  }
  set fade(v: number) {
    (this.material.uniforms.uWater!.value as Vector4).w = v;
  }
  get shallow(): Color {
    return this.material.uniforms.uShallow!.value as Color;
  }
  get deep(): Color {
    return this.material.uniforms.uDeep!.value as Color;
  }
}

export function createWaterStrip(curve: Curve<Vector3>, o: WaterStripOptions = {}): WaterStrip {
  return new WaterStrip(curve, o);
}
