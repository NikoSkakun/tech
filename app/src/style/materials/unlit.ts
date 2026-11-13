/**
 * K.glow, K.glass, K.hologram — the unlit members of the material family.
 */
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  FrontSide,
  NormalBlending,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  Vector4,
  type IUniform,
  type Plane,
  type Side,
} from 'three';
import { col, type ColorLike } from '../palette';
import { K_FRAGMENT_COMMON, kVertexShader } from './chunks';
import { linkGlobals } from './globals';

/* ------------------------------------------------------------------------------------------------ K.glow */

export interface GlowParams {
  /** Glow colour. Default `cyan`. */
  color?: ColorLike;
  /** Brightness multiplier; > ~1.2 drives bloom. Default 2.2. Use 1 for a flat unlit colour. */
  intensity?: number;
  /** Colour of the hot centre (facing the camera). Default: `color` pushed toward white by `whiten`. */
  core?: ColorLike;
  /**
   * How far the default core moves toward white, 0…1 (ignored when `core` is given). Default 0.55 (white-hot
   * core). Use 0 for semantic colours that must keep their hue at the centre (phases, field arrows, LEDs).
   */
  whiten?: number;
  /**
   * Keep the hue on screen at high intensity (small LEDs, SOC bars, phase-coloured lamps). The display
   * transform bleeds every pixel above 1 toward white; with `keepHue` the shader lowers the non-dominant
   * channels so that after that bleed the pixel still shows the palette hue at full brightness, and the bloom
   * halo is more saturated. The peak (`intensity` × brightest channel) is capped at 1.8, the highest level at
   * which the hue can survive the bleed — so `intensity` above ≈ 1.8 adds nothing. Default false.
   */
  keepHue?: boolean;
  /** 0 = flat disc of colour, higher = smaller hot core with darker limb. Default 1.6. */
  falloff?: number;
  /** Brightness of the limb relative to the core, 0…1. Default 0.55. */
  edge?: number;
  /** Additive, non-depth-writing (halos, beams, ghost shells). Default false = solid emissive body. */
  additive?: boolean;
  /** Constant opacity (with `additive` it scales the contribution). Default 1. */
  opacity?: number;
  vertexColors?: boolean;
  side?: Side;
  /** Affected by scene fog. Default true for solid, false for additive. */
  fog?: boolean;
  clippingPlanes?: Plane[];
  name?: string;
}

const GLOW_FRAGMENT = /* glsl */ `
${K_FRAGMENT_COMMON}
#include <normal_pars_fragment>
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uIntensity;
uniform vec2 uFalloff; // power, edge level
void main() {
  #include <clipping_planes_fragment>
  kFadeDiscard();
  #include <normal_fragment_begin>
  float ndv = saturate( dot( normal, normalize( vViewPosition ) ) );
  float core = uFalloff.x > 0.0 ? pow( ndv, uFalloff.x ) : 1.0;
  vec4 diffuseColor = vec4( mix( uColor * uFalloff.y, uCore, core ) * uIntensity, opacity );
  #include <color_fragment>
  #ifdef K_KEEP_HUE
    // Pre-compensate the overflow bleed of the final pass (FINAL_FRAGMENT: mix toward the peak by
    // w = 1 − exp(−0.7·(peak − 1))): channel c' = (target − peak·w) / (1 − w) shows as target after the bleed,
    // where target = colour / peak (the hue at full brightness). The dominant channel keeps the peak (bloom).
    // c' may be negative (exact compensation needs it; the bloom halo just gets more saturated). Above a peak
    // of 1.8 no compensation can keep the hue, so the peak is capped there.
    float kPeak = max( diffuseColor.r, max( diffuseColor.g, diffuseColor.b ) );
    if ( kPeak > 1.0 ) {
      diffuseColor.rgb *= min( kPeak, 1.8 ) / kPeak;
      kPeak = min( kPeak, 1.8 );
      float kW = 1.0 - exp( -0.7 * ( kPeak - 1.0 ) );
      vec3 kTarget = diffuseColor.rgb / kPeak;
      vec3 kComp = max( ( kTarget - kPeak * kW ) / max( 1.0 - kW, 1e-3 ), -kPeak );
      diffuseColor.rgb = mix( kComp, vec3( kPeak ), step( 0.999, kTarget ) );
    }
  #endif
  gl_FragColor = diffuseColor;
  #ifdef K_ADDITIVE
    gl_FragColor.rgb *= gl_FragColor.a * mix( 1.0, core, 0.6 );
  #endif
  #include <fog_fragment>
}
`;

/** Unlit emissive material for particles, plasma, indicator lights, beams. Create through `K.glow()`. */
export class KGlowMaterial extends ShaderMaterial {
  readonly isKMaterial = true;
  /** Core whitening used by `setColor` (see `GlowParams.whiten`). */
  whiten: number;

  constructor(params: GlowParams = {}) {
    super();
    this.name = params.name ?? 'K.glow';
    const color = col(params.color ?? 'cyan');
    this.whiten = Math.min(Math.max(params.whiten ?? 0.55, 0), 1);
    const core =
      params.core !== undefined ? col(params.core) : color.clone().lerp(new Color(1, 1, 1), this.whiten);
    const additive = params.additive ?? false;
    const own: Record<string, IUniform> = {
      opacity: { value: params.opacity ?? 1 },
      uFade: { value: 1 },
      uColor: { value: color },
      uCore: { value: core },
      uIntensity: { value: params.intensity ?? 2.2 },
      uFalloff: { value: new Vector2(params.falloff ?? 1.6, params.edge ?? 0.55) },
    };
    this.uniforms = UniformsUtils.merge([UniformsLib.fog, own]);
    linkGlobals(this.uniforms);
    this.defines = {
      ...(additive ? { K_ADDITIVE: '' } : {}),
      ...(params.keepHue ? { K_KEEP_HUE: '' } : {}),
    };
    this.vertexShader = kVertexShader();
    this.fragmentShader = GLOW_FRAGMENT;
    this.fog = params.fog ?? !additive;
    this.clipping = true;
    this.vertexColors = params.vertexColors ?? false;
    this.side = params.side ?? FrontSide;
    if (params.clippingPlanes) this.clippingPlanes = params.clippingPlanes;
    if (additive) {
      this.transparent = true;
      this.depthWrite = false;
      this.blending = AdditiveBlending;
    } else if ((params.opacity ?? 1) < 1) {
      this.transparent = true;
      this.depthWrite = false;
    }
  }

  get color(): Color {
    return this.uniforms.uColor!.value as Color;
  }

  /** Set glow colour (and a matching core, whitened by `whiten`). */
  setColor(value: ColorLike): this {
    const c = col(value, this.uniforms.uColor!.value as Color);
    (this.uniforms.uCore!.value as Color).copy(c).lerp(new Color(1, 1, 1), this.whiten);
    return this;
  }

  /** Brightness multiplier (tweenable). */
  get intensity(): number {
    return this.uniforms.uIntensity!.value as number;
  }
  set intensity(v: number) {
    this.uniforms.uIntensity!.value = v;
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
    m.whiten = this.whiten;
    return m;
  }
}

/* ----------------------------------------------------------------------------------------------- K.glass */

export interface GlassParams {
  /** Tint. Default `sky`. */
  color?: ColorLike;
  /** Opacity where the surface faces the camera. Default 0.16. */
  opacity?: number;
  /** Opacity at grazing angles (fresnel edge). Default 0.7. */
  edgeOpacity?: number;
  /** Colour of the fresnel edge. Default: tint pushed toward white. */
  edgeColor?: ColorLike;
  /** Strength of the stylised highlight streak, 0…1. Default 0.8. */
  specular?: number;
  /** Render both faces (bottles, domes seen from inside). Default true. */
  doubleSided?: boolean;
  fog?: boolean;
  clippingPlanes?: Plane[];
  name?: string;
}

const GLASS_FRAGMENT = /* glsl */ `
${K_FRAGMENT_COMMON}
#include <normal_pars_fragment>
uniform vec3 uColor;
uniform vec3 uEdgeColor;
uniform vec3 uGlass; // edge opacity, fresnel power, specular strength
void main() {
  #include <clipping_planes_fragment>
  kFadeDiscard();
  #include <normal_fragment_begin>
  float ndv = saturate( abs( dot( normal, normalize( vViewPosition ) ) ) );
  float fres = pow( 1.0 - ndv, uGlass.y );
  // No real refraction (STYLE_GUIDE §4): tinted body, brighter fresnel edge, one crisp view-space highlight.
  float streak = smoothstep( 0.93, 0.96, dot( normal, normalize( vec3( -0.45, 0.72, 0.52 ) ) ) );
  vec3 color = mix( uColor, uEdgeColor, fres ) + vec3( streak * uGlass.z );
  float alpha = mix( opacity, uGlass.x, fres );
  alpha = max( alpha, streak * uGlass.z );
  gl_FragColor = vec4( min( color, vec3( 1.0 ) ), alpha );
  #include <fog_fragment>
}
`;

/** Tinted translucent material with a fresnel edge. Create through `K.glass()`. */
export class KGlassMaterial extends ShaderMaterial {
  readonly isKMaterial = true;

  constructor(params: GlassParams = {}) {
    super();
    this.name = params.name ?? 'K.glass';
    const color = col(params.color ?? 'sky');
    const own: Record<string, IUniform> = {
      opacity: { value: params.opacity ?? 0.16 },
      uFade: { value: 1 },
      uColor: { value: color },
      uEdgeColor: {
        value:
          params.edgeColor !== undefined
            ? col(params.edgeColor)
            : color.clone().lerp(new Color(1, 1, 1), 0.6),
      },
      uGlass: { value: new Vector3(params.edgeOpacity ?? 0.7, 2.2, params.specular ?? 0.8) },
    };
    this.uniforms = UniformsUtils.merge([UniformsLib.fog, own]);
    linkGlobals(this.uniforms);
    this.vertexShader = kVertexShader();
    this.fragmentShader = GLASS_FRAGMENT;
    this.fog = params.fog ?? true;
    this.clipping = true;
    this.transparent = true;
    this.depthWrite = false;
    this.blending = NormalBlending;
    this.side = (params.doubleSided ?? true) ? DoubleSide : FrontSide;
    if (params.clippingPlanes) this.clippingPlanes = params.clippingPlanes;
  }

  get color(): Color {
    return this.uniforms.uColor!.value as Color;
  }

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

/* -------------------------------------------------------------------------------------------- K.hologram */

export interface HologramParams {
  /** Panel size in local units (the "hologlass" rounded rectangle, without the glow margin). */
  size: [number, number];
  /** Corner radius in the same units. Default 20. */
  radius?: number;
  /** Margin around the panel reserved for the outer glow; the mesh must be `size + 2·margin`. Default 24. */
  margin?: number;
  /** Fill colour. Default `bg.deep`. */
  fill?: ColorLike;
  /** Fill opacity of the glass itself (STYLE_GUIDE: 78–88 %; default 0.9 for legibility). */
  fillOpacity?: number;
  /**
   * 0…1 — how much of what still shows through the glass is dimmed away. Effective opacity =
   * 1 − (1 − fillOpacity)·(1 − backdropDim). Default 0.8 → 0.98: white/mist text keeps a contrast ≥ 7:1 even
   * over a pure white scene. Use 0 only for decorative panels without text.
   */
  backdropDim?: number;
  /** Border / glow colour — the chapter accent. Default `cyan`. */
  accent?: ColorLike;
  /** Inner border width in units. Default 1.5. */
  border?: number;
  /** Outer glow strength 0…1. Default 0.5. */
  glow?: number;
  /** Overall opacity (tweenable through `.opacity`). Default 1. */
  opacity?: number;
  name?: string;
}

const HOLOGRAM_FRAGMENT = /* glsl */ `
${K_FRAGMENT_COMMON}
varying vec2 vKUv;
uniform vec4 uPanel;   // width, height, radius, margin
uniform vec3 uFill;
uniform vec3 uAccent;
uniform vec4 uLook;    // fill opacity, border width, glow, hover highlight
uniform float uDim;    // backdrop dim
float kRoundRect( vec2 p, vec2 halfSize, float r ) {
  vec2 q = abs( p ) - halfSize + r;
  return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - r;
}
void main() {
  vec2 full = uPanel.xy + 2.0 * uPanel.w;
  vec2 p = ( vKUv - 0.5 ) * full;
  float r = min( uPanel.z, 0.5 * min( uPanel.x, uPanel.y ) );
  float d = kRoundRect( p, 0.5 * uPanel.xy, r );
  float aa = max( fwidth( d ), 1e-4 );
  float inside = 1.0 - smoothstep( -aa, aa, d );
  float v = p.y / uPanel.y + 0.5; // 0 bottom … 1 top
  // fill: subtle vertical gradient, faint animated scan line and grain
  vec3 fill = uFill * mix( 0.78, 1.22, v );
  float scan = smoothstep( 0.0, 0.5, fract( v * 3.0 - uKTime * 0.06 ) ) * smoothstep( 1.0, 0.5, fract( v * 3.0 - uKTime * 0.06 ) );
  fill += uAccent * ( 0.018 * scan + 0.012 * ( kHash( gl_FragCoord.xy + fract( uKTime ) * 61.0 ) - 0.5 ) );
  fill += uAccent * uLook.w * 0.08;
  // inner border: accent at 60 % along the top-left, fading toward the bottom-right
  float bw = uLook.y;
  float border = smoothstep( -bw - aa, -bw + aa, d ) * inside;
  float sweep = saturate( 0.5 + 0.5 * dot( normalize( p / uPanel.xy + 1e-5 ), normalize( vec2( -0.6, 0.8 ) ) ) );
  float borderAlpha = mix( 0.14, 0.6, sweep ) + uLook.w * 0.3;
  vec3 color = mix( fill, uAccent * 1.25, border * borderAlpha );
  float glassAlpha = 1.0 - ( 1.0 - uLook.x ) * ( 1.0 - uDim );
  float alpha = inside * mix( glassAlpha, 1.0, border * borderAlpha );
  // soft outer glow in the accent colour
  float glow = exp( -max( d, 0.0 ) / max( uPanel.w * 0.3, 1e-3 ) ) * ( 1.0 - inside ) * uLook.z * 0.3;
  color = mix( uAccent, color, inside );
  alpha = max( alpha, glow );
  gl_FragColor = vec4( color, alpha * opacity * uFade );
}
`;

/**
 * "Hologlass" UI panel material (STYLE_GUIDE §6): rounded rectangle with gradient fill, accent inner border,
 * soft outer glow and faint scan/grain — all computed analytically, so it stays crisp at any size.
 * Apply to a plane of `size + 2·margin` units with standard 0…1 UVs. Create through `K.hologram()`.
 */
export class KHologramMaterial extends ShaderMaterial {
  readonly isKMaterial = true;

  constructor(params: HologramParams) {
    super();
    this.name = params.name ?? 'K.hologram';
    this.uniforms = {
      opacity: { value: params.opacity ?? 1 },
      uFade: { value: 1 },
      uPanel: {
        value: new Vector4(params.size[0], params.size[1], params.radius ?? 20, params.margin ?? 24),
      },
      uFill: { value: col(params.fill ?? 'bg.deep') },
      uAccent: { value: col(params.accent ?? 'cyan') },
      uLook: { value: new Vector4(params.fillOpacity ?? 0.9, params.border ?? 1.5, params.glow ?? 0.5, 0) },
    };
    this.uniforms.uDim = { value: params.backdropDim ?? 0.8 };
    linkGlobals(this.uniforms);
    this.vertexShader = kVertexShader({ uv: true });
    this.fragmentShader = HOLOGRAM_FRAGMENT;
    this.transparent = true;
    this.depthWrite = false;
    this.fog = false;
    this.side = DoubleSide;
  }

  /** Panel size (without margin) in local units. Keep the mesh at `size + 2·margin`. */
  setSize(width: number, height: number): this {
    const p = this.uniforms.uPanel!.value as Vector4;
    p.x = width;
    p.y = height;
    return this;
  }

  /** Glow margin in local units. */
  get margin(): number {
    return (this.uniforms.uPanel!.value as Vector4).w;
  }

  get accent(): Color {
    return this.uniforms.uAccent!.value as Color;
  }

  /** Backdrop dim 0…1 (tweenable), see `HologramParams.backdropDim`. */
  get backdropDim(): number {
    return this.uniforms.uDim!.value as number;
  }
  set backdropDim(v: number) {
    this.uniforms.uDim!.value = v;
  }

  /** 0…1 hover highlight (tweenable). */
  get highlight(): number {
    return (this.uniforms.uLook!.value as Vector4).w;
  }
  set highlight(v: number) {
    (this.uniforms.uLook!.value as Vector4).w = v;
  }

  /** Overall opacity alias for tweening panel open/close. */
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
