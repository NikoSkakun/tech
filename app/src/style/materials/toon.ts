/**
 * K.toon / K.metal / K.energy — the lit cel-shaded material family (one shader, three variants).
 */
import {
  BufferAttribute,
  type BufferGeometry,
  Color,
  FrontSide,
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
import { K_FRAGMENT_COMMON, K_LIGHTING_PARS, kVertexShader } from './chunks';
import { kGlobals, linkGlobals } from './globals';

export interface ToonGradient {
  /** Colour at/below `range[0]`. */
  bottom: ColorLike;
  /** Colour at/above `range[1]`. */
  top: ColorLike;
  /** Y range of the blend, in the chosen space. */
  range: [number, number];
  /** `object` (default; follows the mesh, pre-instance) or `world`. */
  space?: 'object' | 'world';
}

/** Colour bands by height — deliberate strata / terrain zones with crisp, slightly wobbling borders. */
export interface ToonLayers {
  /**
   * `[y, colour]` pairs sorted by ascending y (at most 8). The first colour applies below the second stop's
   * y; every further stop takes over above its y.
   */
  stops: readonly (readonly [number, ColorLike])[];
  /** Half-width of the border between two bands in y units. Default 0 = one antialiased pixel (crisp). */
  softness?: number;
  /** Amplitude (y units) of the noise that makes the borders wander instead of being ruler-straight. Default 0.12. */
  wobble?: number;
  /** Horizontal size of the wobble features in world units. Default 2. */
  wobbleScale?: number;
  /** `world` (default) or `object` space for y. */
  space?: 'object' | 'world';
}

/** Recolour steep faces (cliffs, banks): where the world normal's y falls below `to` the slope colour takes over. */
export interface ToonSlope {
  color: ColorLike;
  /** Normal y where the slope colour starts to appear. Default 0.8. */
  from?: number;
  /** Normal y where it has fully taken over. Default 0.6. */
  to?: number;
}

export interface ToonParams {
  /** Base colour (palette token or colour). Default `mist`. */
  color?: ColorLike;
  /** Height bands replacing the base colour (terrain, strata, liquid levels). */
  layers?: ToonLayers;
  /** Different colour on steep faces (applied after `layers`). */
  slope?: ToonSlope;
  /** Optional vertical two-colour gradient replacing the flat base colour. */
  gradient?: ToonGradient;
  /** Emissive colour (drives bloom when `emissiveIntensity` > 1). Default: none. */
  emissive?: ColorLike;
  /** Multiplier of the emissive colour. Default 1 when `emissive` is given. */
  emissiveIntensity?: number;
  /** N·L value where shade turns into light (−1…1). Default 0.02. Lower = more of the object is lit. */
  terminator?: number;
  /**
   * Number of cel bands of the key light: 3 (default) = shadow / half-tone / light, 2 = shadow / light.
   * The highlight band (`highlight`) comes on top of either.
   */
  bands?: 2 | 3;
  /** N·L value where the half-tone turns into full light (3 bands). Default 0.42. */
  midThreshold?: number;
  /** Brightness of the half-tone band between shadow (0) and light (1). Default 0.5. */
  midLevel?: number;
  /**
   * Half-width of the band edges in N·L: 0.035 (default) = crisp, antialiased cel edges; 0.1–0.15 = soft
   * plush look; ≥ 0.3 with `bands: 2` = smooth Lambert-like falloff (opt-out of the cel look, e.g. clouds).
   */
  softness?: number;
  /** Strength of the third (highlight) band, 0…1. Default 0.55. 0 gives a two-band look. */
  highlight?: number;
  /** N·L value where the highlight band begins. Default 0.8. */
  highlightThreshold?: number;
  /** Rim light strength multiplier (the rig sets colour/direction). Default 1. */
  rim?: number;
  /** 0…1 — adds one crisp specular spot (glossy toy-plastic look for spheres and rounded forms). Default 0. */
  gloss?: number;
  /** Multiply by per-vertex colours (`geometry.attributes.color`). Instance colours always work. */
  vertexColors?: boolean;
  /**
   * Per-vertex emissive colour from the geometry attribute `kEmissive` (vec3, linear RGB; see
   * `paintEmissive`), × `vertexEmissiveIntensity` (default 1), added to the uniform emissive. Lit windows in
   * warm / cool / TV-blue, multi-colour LEDs: one material, one draw call. Default false.
   */
  vertexEmissive?: boolean;
  /** Multiplier of the per-vertex emissive (tweenable as `.vertexEmissiveIntensity`). Default 1. */
  vertexEmissiveIntensity?: number;
  /**
   * Keep the hue of bright emissive pixels on screen (lit windows at night, LEDs on a lit body): the same
   * pre-compensation of the final pass's overflow bleed as `K.glow({ keepHue })`, applied to the lit + emissive
   * result, so warm / cool tones above 1 do not wash to cream-white. Peaks are capped at 1.8. Default false (M3).
   */
  keepHue?: boolean;
  /** Faceted look — only where intentional (crystals, rocks). */
  flatShading?: boolean;
  side?: Side;
  /** Affected by scene fog. Default true. */
  fog?: boolean;
  /** Local clipping planes (world space) for cutaways. */
  clippingPlanes?: Plane[];
  /** Constant opacity < 1 turns the material into a blended transparent one (prefer `fade` for appear/disappear). */
  opacity?: number;
  name?: string;
}

export interface MetalParams extends ToonParams {
  /** Tightness of the specular streak (higher = narrower). Default 48. */
  shininess?: number;
  /** Brightness of the streak, 0…1. Default 0.7. */
  specular?: number;
}

export interface EnergyParams extends ToonParams {
  /** Colour of the travelling pulses. Default `yellow` (current / energy flow, STYLE_GUIDE §2.2). */
  pulseColor?: ColorLike;
  /** Pulses per unit of U (the geometry's `uv.x` must run along the cable/pipe). Default 3. */
  repeat?: number;
  /** Travel speed in U units per second (negative reverses direction). Default 0.5. */
  speed?: number;
  /** Tail length as a fraction of the pulse spacing, 0…1. Default 0.45. */
  length?: number;
  /** Peak emissive multiplier of a pulse (> 1 blooms). Default 3.5. */
  intensity?: number;
  /** 0…1+ — scales brightness; map it to the real power flowing (STYLE_GUIDE: brightness ∝ power). Default 1. */
  power?: number;
}

type Variant = 'toon' | 'metal' | 'energy';

const FRAGMENT = /* glsl */ `
${K_FRAGMENT_COMMON}
#ifdef K_KEEP_HUE
// Pre-compensate the final pass's overflow bleed (mix toward the peak by w = 1 − exp(−0.7·(peak − 1))):
// channel c' = (target − peak·w) / (1 − w) shows as target = colour / peak after the bleed. Same maths as
// K.glow keepHue (unlit.ts); the peak is capped at 1.8, above which no compensation can keep the hue.
vec3 kKeepHue( vec3 c ) {
  float peak = max( c.r, max( c.g, c.b ) );
  if ( peak <= 1.0 ) return c;
  c *= min( peak, 1.8 ) / peak;
  peak = min( peak, 1.8 );
  float w = 1.0 - exp( -0.7 * ( peak - 1.0 ) );
  vec3 target = c / peak;
  vec3 comp = max( ( target - peak * w ) / max( 1.0 - w, 1e-3 ), -peak );
  return mix( comp, vec3( peak ), step( 0.999, target ) );
}
#endif
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec2 uGradRange;
uniform vec3 uEmissive;
#ifdef K_VERTEX_EMISSIVE
  varying vec3 vKEmissive;
  uniform float uVertexEmissive;
#endif
uniform float uEmissiveIntensity;
#ifdef K_LAYERS
  uniform float uLayerY[ K_LAYERS ];
  uniform vec3 uLayerColor[ K_LAYERS ];
  uniform vec3 uLayerOpts; // border softness, wobble amplitude, 1 / wobble scale
#endif
#ifdef K_SLOPE
  uniform vec3 uSlopeColor;
  uniform vec2 uSlope; // normal.y where it starts, where it is complete
#endif
#ifdef K_ENERGY
  varying vec2 vKUv;
  uniform vec3 uPulseColor;
  uniform vec4 uPulse; // repeat, speed, tail length, peak intensity
  uniform float uPulsePhase; // ∫ speed dt (integrated on the CPU so changing speed never makes pulses jump)
  uniform float uPower;
#endif
${K_LIGHTING_PARS}
void main() {
  #include <clipping_planes_fragment>
  kFadeDiscard();
  #ifdef K_GRADIENT_WORLD
    float gradY = vKWorldPos.y;
  #else
    float gradY = vKObjPos.y;
  #endif
  float grad = smoothstep( uGradRange.x, uGradRange.y, gradY );
  vec4 diffuseColor = vec4( mix( uColorA, uColorB, grad ), opacity );
  #include <normal_fragment_begin>
  #ifdef K_LAYERS
    #ifdef K_LAYERS_OBJECT
      float layerY = vKObjPos.y;
    #else
      float layerY = vKWorldPos.y;
    #endif
    layerY += ( kNoise( vKWorldPos.xz * uLayerOpts.z ) + 0.5 * kNoise( vKWorldPos.zx * uLayerOpts.z * 2.7 + 5.0 ) - 0.75 ) * uLayerOpts.y;
    // border width: at least ~1 screen pixel (crisp, antialiased at any slope and zoom), or the requested softness
    float layerEdge = max( fwidth( layerY ) * 0.9, uLayerOpts.x );
    vec3 layerColor = uLayerColor[ 0 ];
    for ( int i = 1; i < K_LAYERS; i ++ ) {
      layerColor = mix( layerColor, uLayerColor[ i ], smoothstep( uLayerY[ i ] - layerEdge, uLayerY[ i ] + layerEdge, layerY ) );
    }
    diffuseColor.rgb = layerColor;
  #endif
  #ifdef K_SLOPE
    float worldNormalY = dot( normal, viewMatrix[ 1 ].xyz );
    diffuseColor.rgb = mix( diffuseColor.rgb, uSlopeColor, 1.0 - smoothstep( uSlope.y, uSlope.x, worldNormalY ) );
  #endif
  #include <color_fragment>
  vec3 color = kShade( diffuseColor.rgb, normal );
  vec3 emissive = uEmissive * uEmissiveIntensity;
  #ifdef K_VERTEX_EMISSIVE
    emissive += vKEmissive * uVertexEmissive;
  #endif
  #ifdef K_ENERGY
    // Comet-shaped pulses travelling along +U: bright head, quadratic tail, seamless loop.
    float phase = fract( vKUv.x * uPulse.x - uPulsePhase );
    float tail = smoothstep( 1.0 - uPulse.z, 1.0, phase );
    float pulse = tail * tail * smoothstep( 1.0, 0.975, phase );
    emissive += uPulseColor * ( ( pulse * uPulse.w + 0.1 ) * uPower );
  #endif
  #ifdef K_KEEP_HUE
    gl_FragColor = vec4( kKeepHue( color + emissive ), diffuseColor.a );
  #else
    gl_FragColor = vec4( color + emissive, diffuseColor.a );
  #endif
  #include <fog_fragment>
}
`;

/** Name of the per-vertex emissive attribute read by `K.toon({ vertexEmissive: true })`. */
export const K_EMISSIVE_ATTRIBUTE = 'kEmissive';

/**
 * Fill a geometry's `kEmissive` attribute with one colour × `intensity` (black = no glow). Paint every part
 * before merging (`mergeGeometries` needs the attribute on all parts): windows lit warm, cool or off, LEDs…
 */
export function paintEmissive(geometry: BufferGeometry, color: ColorLike, intensity = 1): BufferGeometry {
  const c = col(color).multiplyScalar(intensity);
  const n = geometry.getAttribute('position').count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute(K_EMISSIVE_ATTRIBUTE, new BufferAttribute(data, 3));
  return geometry;
}

/** Lit cel-shaded material. Create through `K.toon()`, `K.metal()` or `K.energy()`. */
export class KToonMaterial extends ShaderMaterial {
  readonly isKMaterial = true;
  readonly variant: Variant;
  /** Read by three's program cache (not declared on ShaderMaterial's typings): faceted normals when true. */
  flatShading = false;
  private phase = 0;
  private phaseTime = -1;

  constructor(params: ToonParams & MetalParams & EnergyParams = {}, variant: Variant = 'toon') {
    super();
    this.variant = variant;
    this.name = params.name ?? `K.${variant}`;
    const base = col(params.color ?? 'mist');
    const g = params.gradient;
    const emissive = params.emissive !== undefined ? col(params.emissive) : new Color(0, 0, 0);
    const own: Record<string, IUniform> = {
      opacity: { value: params.opacity ?? 1 },
      uFade: { value: 1 },
      uColorA: { value: g ? col(g.bottom) : base.clone() },
      uColorB: { value: g ? col(g.top) : base.clone() },
      uGradRange: { value: new Vector2(g ? g.range[0] : 0, g ? g.range[1] : 1) },
      uEmissive: { value: emissive },
      uEmissiveIntensity: { value: params.emissiveIntensity ?? (params.emissive !== undefined ? 1 : 0) },
      uBand: {
        value: new Vector4(
          params.terminator ?? 0.02,
          Math.max(params.softness ?? 0.035, 0.002),
          params.highlightThreshold ?? 0.8,
          params.highlight ?? 0.55,
        ),
      },
      uRim: { value: new Vector3(params.rim ?? 1, 0.62, 0.12) },
    };
    this.defines = {};
    if (g?.space === 'world') this.defines.K_GRADIENT_WORLD = '';
    if ((params.bands ?? 3) === 3) {
      this.defines.K_BANDS3 = '';
      own.uMid = { value: new Vector2(params.midThreshold ?? 0.42, params.midLevel ?? 0.5) };
    }
    const layers = params.layers;
    if (layers && layers.stops.length > 0) {
      const stops = layers.stops.slice(0, 8);
      this.defines.K_LAYERS = stops.length;
      if (layers.space === 'object') this.defines.K_LAYERS_OBJECT = '';
      own.uLayerY = { value: stops.map((st) => st[0]) };
      own.uLayerColor = { value: stops.map((st) => col(st[1])) };
      own.uLayerOpts = {
        value: new Vector3(
          Math.max(layers.softness ?? 0, 0),
          layers.wobble ?? 0.12,
          1 / Math.max(layers.wobbleScale ?? 2, 1e-3),
        ),
      };
    }
    if (params.slope) {
      this.defines.K_SLOPE = '';
      own.uSlopeColor = { value: col(params.slope.color) };
      own.uSlope = { value: new Vector2(params.slope.from ?? 0.8, params.slope.to ?? 0.6) };
    }
    if (variant !== 'metal' && (params.gloss ?? 0) > 0) {
      this.defines.K_GLOSS = '';
      own.uSpec = { value: new Vector3(90, params.gloss ?? 0, 0.06) };
    }
    if (variant === 'metal') {
      this.defines.K_METAL = '';
      own.uSpec = { value: new Vector3(params.shininess ?? 48, params.specular ?? 0.7, 0.08) };
    }
    if (params.keepHue) this.defines.K_KEEP_HUE = '';
    if (params.vertexEmissive) {
      this.defines.K_VERTEX_EMISSIVE = '';
      own.uVertexEmissive = { value: params.vertexEmissiveIntensity ?? 1 };
    }
    if (variant === 'energy') {
      this.defines.K_ENERGY = '';
      own.uPulseColor = { value: col(params.pulseColor ?? 'yellow') };
      own.uPulse = {
        value: new Vector4(
          params.repeat ?? 3,
          params.speed ?? 0.5,
          params.length ?? 0.45,
          params.intensity ?? 3.5,
        ),
      };
      own.uPower = { value: params.power ?? 1 };
      own.uPulsePhase = { value: 0 };
    }
    this.uniforms = UniformsUtils.merge([UniformsLib.lights, UniformsLib.fog, own]);
    linkGlobals(this.uniforms);
    this.vertexShader = kVertexShader({
      uv: variant === 'energy',
      ...(params.vertexEmissive
        ? {
            pars: `attribute vec3 ${K_EMISSIVE_ATTRIBUTE};\nvarying vec3 vKEmissive;`,
            transform: `vKEmissive = ${K_EMISSIVE_ATTRIBUTE};`,
          }
        : {}),
    });
    this.fragmentShader = FRAGMENT;
    this.lights = true;
    this.fog = params.fog ?? true;
    this.clipping = true;
    this.vertexColors = params.vertexColors ?? false;
    this.flatShading = params.flatShading ?? false;
    this.side = params.side ?? FrontSide;
    if (params.clippingPlanes) this.clippingPlanes = params.clippingPlanes;
    if ((params.opacity ?? 1) < 1) {
      this.transparent = true;
      this.depthWrite = false;
    }
  }

  /** Base colour (the gradient bottom when a gradient is set). Mutating it has immediate effect. */
  get color(): Color {
    return this.uniforms.uColorA!.value as Color;
  }

  /** Set a flat base colour (removes any gradient). */
  setColor(value: ColorLike): this {
    col(value, this.uniforms.uColorA!.value as Color);
    (this.uniforms.uColorB!.value as Color).copy(this.uniforms.uColorA!.value as Color);
    return this;
  }

  setGradient(bottom: ColorLike, top: ColorLike, range: [number, number]): this {
    col(bottom, this.uniforms.uColorA!.value as Color);
    col(top, this.uniforms.uColorB!.value as Color);
    (this.uniforms.uGradRange!.value as Vector2).set(range[0], range[1]);
    return this;
  }

  get emissive(): Color {
    return this.uniforms.uEmissive!.value as Color;
  }

  setEmissive(value: ColorLike, intensity?: number): this {
    col(value, this.uniforms.uEmissive!.value as Color);
    if (intensity !== undefined) this.emissiveIntensity = intensity;
    return this;
  }

  /** Emissive multiplier (tweenable). Values above ~1.2 start to bloom. */
  get emissiveIntensity(): number {
    return this.uniforms.uEmissiveIntensity!.value as number;
  }
  set emissiveIntensity(v: number) {
    this.uniforms.uEmissiveIntensity!.value = v;
  }

  /** Multiplier of the per-vertex emissive (`vertexEmissive: true` only; tweenable). */
  get vertexEmissiveIntensity(): number {
    return (this.uniforms.uVertexEmissive?.value as number | undefined) ?? 0;
  }
  set vertexEmissiveIntensity(v: number) {
    if (this.uniforms.uVertexEmissive) this.uniforms.uVertexEmissive.value = v;
  }

  /** Dissolve factor 0 (invisible) … 1 (solid), tweenable; uses a screen-door dither so it needs no sorting. */
  get fade(): number {
    return this.uniforms.uFade!.value as number;
  }
  set fade(v: number) {
    this.uniforms.uFade!.value = v;
  }

  /** K.energy only: brightness scale ∝ power flow (tweenable). */
  get power(): number {
    return (this.uniforms.uPower?.value as number | undefined) ?? 0;
  }
  set power(v: number) {
    if (this.uniforms.uPower) this.uniforms.uPower.value = v;
  }

  /** K.energy only: pulse travel speed in U units per second (tweenable; sign = direction). */
  get speed(): number {
    return (this.uniforms.uPulse?.value as Vector4 | undefined)?.y ?? 0;
  }
  set speed(v: number) {
    const p = this.uniforms.uPulse?.value as Vector4 | undefined;
    if (p) p.y = v;
  }

  /** Advances the pulse phase once per frame (three calls this for every object drawn with the material). */
  override onBeforeRender(): void {
    const u = this.uniforms.uPulsePhase;
    if (!u) return;
    const t = kGlobals.uKTime.value;
    if (t === this.phaseTime) return;
    const dt = this.phaseTime < 0 ? 0 : Math.max(t - this.phaseTime, 0);
    this.phaseTime = t;
    this.phase = (this.phase + dt * (this.uniforms.uPulse!.value as Vector4).y) % 4096;
    u.value = this.phase;
  }

  override clone(): this {
    const m = new KToonMaterial({}, this.variant) as this;
    ShaderMaterial.prototype.copy.call(m, this);
    m.flatShading = this.flatShading;
    linkGlobals(m.uniforms);
    return m;
  }
}
