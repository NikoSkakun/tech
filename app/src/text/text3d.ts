/**
 * Text3D — crisp SDF text as a regular three.js mesh (one draw call per text block, mixed faces included).
 * Layout is synchronous: `text.metrics` is valid right after construction or any change, so panels can size
 * themselves to their content in the same frame.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  Quaternion,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
  Vector4,
  type Camera,
  type Intersection,
  type Raycaster,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { col, type ColorLike } from '@/style/palette';
import { fontAtlas, fontData } from './fonts';
import { layoutText, type LayoutOptions, type TextMetrics } from './layout';
import type { RunColor } from './rich';

export interface TextStyle extends LayoutOptions {
  /** Base colour. Default `white`. */
  color?: ColorLike;
  /** Colour of `**terms**`. Default `cyan` — pass the chapter accent. */
  accent?: ColorLike;
  /** Colour of `` `formulas` ``. Default `yellow`. */
  formulaColor?: ColorLike;
  /** 0…1. Default 1. */
  opacity?: number;
  /** Brightness multiplier; > 1 makes the text emissive (it will bloom). Default 1. */
  intensity?: number;
  /** Outline around the glyphs; `width` in em (≤ 0.1). */
  outline?: { width: number; color?: ColorLike };
  /**
   * Soft halo behind the glyphs (legibility over busy backgrounds); `radius` in em (≤ 0.12).
   * Screen-space labels get a dark halo by default; pass `false` to remove it.
   */
  halo?: { radius?: number; color?: ColorLike; opacity?: number } | false;
  /**
   * Smallest allowed em size on screen in CSS px for `screenSpace` text (default 16): on small viewports the
   * px-equivalent scale would make world labels too small to read, so they stop shrinking there.
   */
  minScreenPx?: number;
  /** Stroke weight adjustment in em (−0.03…0.03): thicken small text slightly, thin huge text. Default 0. */
  weight?: number;
  /** Always face the camera (world-anchored labels). Default false. */
  billboard?: boolean;
  /**
   * Interpret `size`/`maxWidth` in px-equivalent units (the HUD scale) regardless of distance — labels in the
   * world that must stay legible when the camera zooms. Implies nothing about facing; combine with `billboard`.
   */
  screenSpace?: boolean;
  /** Default true. */
  depthTest?: boolean;
  /**
   * Write depth where glyphs are (default true): keeps world labels sharp under depth of field.
   * Disable for text layered on HUD panels at the same depth.
   */
  depthWrite?: boolean;
}

const VERTEX = /* glsl */ `
attribute float aLayer;
attribute vec3 aColor;
varying vec2 vUv;
varying float vLayer;
varying vec3 vColor;
#include <common>
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vLayer = aLayer;
  vColor = aColor;
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform highp sampler2DArray uAtlas;
uniform vec2 uUnitRange;     // SDF range in uv units (range px / atlas size)
uniform vec4 uParams;        // opacity, intensity, weight (sdf units), fade
uniform vec4 uOutline;       // rgb, width (sdf units)
uniform vec4 uHalo;          // rgb, radius (sdf units)
uniform float uHaloOpacity;
varying vec2 vUv;
varying float vLayer;
varying vec3 vColor;
#include <common>
#include <fog_pars_fragment>
void main() {
  float sd = texture( uAtlas, vec3( vUv, vLayer ) ).r;
  // how many screen pixels the distance range spans here → 1-pixel-wide analytic antialiasing at any scale
  vec2 texelsPerPixel = fwidth( vUv ) / uUnitRange;
  float pxRange = max( 1.0 / max( max( texelsPerPixel.x, texelsPerPixel.y ), 1e-6 ), 1.0 );
  float d = sd - 0.5 + uParams.z;
  float fill = clamp( d * pxRange + 0.5, 0.0, 1.0 );
  vec3 color = vColor * uParams.y;
  float alpha = fill;
  if ( uOutline.a > 0.0 ) {
    float o = clamp( ( d + uOutline.a ) * pxRange + 0.5, 0.0, 1.0 );
    color = mix( uOutline.rgb, color, fill );
    alpha = o;
  }
  if ( uHaloOpacity > 0.0 ) {
    float h = smoothstep( -uHalo.a, 0.0, d ) * uHaloOpacity;
    color = mix( uHalo.rgb, color, alpha );
    alpha = max( alpha, h );
  }
  alpha *= uParams.x * uParams.w;
  if ( alpha < 0.004 ) discard;
  gl_FragColor = vec4( color, alpha );
  #include <fog_fragment>
}
`;

/** Viewport facts needed by `screenSpace` text; the engine keeps them current. */
export const textViewport = { cssHeight: 1080, pxPerUnit: 1 };

const _pos = new Vector3();
const _scale = new Vector3();
const _quat = new Quaternion();
const _m = new Matrix4();
const _color = new Color();

export class Text3D extends Mesh<BufferGeometry, ShaderMaterial> {
  readonly isText3D = true;
  private content: string;
  private style: TextStyle;
  private dirty = true;
  private layoutMetrics!: TextMetrics;
  private capacity = 0;
  /** Geometry replaced by a capacity growth during a draw; disposed once it is no longer drawn. */
  private retired: BufferGeometry | null = null;

  constructor(text = '', style: TextStyle = {}) {
    const data = fontData();
    super(
      new BufferGeometry(),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uAtlas: { value: fontAtlas() },
          uUnitRange: { value: new Vector2(data.range / data.width, data.range / data.height) },
          uParams: { value: new Vector4(1, 1, 0, 1) },
          uOutline: { value: new Vector4(0, 0, 0, 0) },
          uHalo: { value: new Vector4(0, 0, 0, 0) },
          uHaloOpacity: { value: 0 },
          fogColor: { value: new Color() },
          fogDensity: { value: 0 },
          fogNear: { value: 1 },
          fogFar: { value: 1000 },
        },
        transparent: true,
        side: DoubleSide,
        fog: false,
      }),
    );
    this.content = text;
    this.style = { ...style };
    this.frustumCulled = false; // bounds change with billboard / screenSpace; text blocks are cheap
    this.applyStyle();
    this.sync();
  }

  /** The string being displayed. Assigning re-lays out lazily (on `metrics` access or before rendering). */
  get text(): string {
    return this.content;
  }
  set text(value: string) {
    if (value === this.content) return;
    this.content = value;
    this.dirty = true;
  }

  /** Change style properties (any subset). */
  set(style: Partial<TextStyle>): this {
    Object.assign(this.style, style);
    this.applyStyle();
    this.dirty = true;
    return this;
  }

  /**
   * Base text colour (the `color` style; accent / formula / `{name:…}` runs keep their own colours).
   * Re-colours lazily like `text`; assigning the same value is free.
   */
  get color(): ColorLike {
    return this.style.color ?? 'white';
  }
  set color(value: ColorLike) {
    if (value === this.style.color) return;
    this.style.color = value;
    this.dirty = true;
  }

  /** Same as assigning `color`, chainable. */
  setColor(value: ColorLike): this {
    this.color = value;
    return this;
  }

  /** 1 em in local units (`style.size`, default 1) — QA uses it to measure on-screen text size. */
  get fontSize(): number {
    return this.style.size ?? 1;
  }

  /** True for `screenSpace` text (constant on-screen size). */
  get screenSpace(): boolean {
    return this.style.screenSpace === true;
  }

  /** Layout metrics in local units — synchronous and always up to date. */
  get metrics(): TextMetrics {
    this.sync();
    return this.layoutMetrics;
  }

  /** 0…1 (tweenable). */
  get opacity(): number {
    return (this.material.uniforms.uParams!.value as Vector4).x;
  }
  set opacity(v: number) {
    (this.material.uniforms.uParams!.value as Vector4).x = v;
  }

  /** Dissolve factor 0…1 used by `ctx.stage` actors with `appear: 'fade'` (multiplies `opacity`). */
  get fade(): number {
    return (this.material.uniforms.uParams!.value as Vector4).w;
  }
  set fade(v: number) {
    (this.material.uniforms.uParams!.value as Vector4).w = v;
  }

  /** Emissive multiplier (tweenable). */
  get intensity(): number {
    return (this.material.uniforms.uParams!.value as Vector4).y;
  }
  set intensity(v: number) {
    (this.material.uniforms.uParams!.value as Vector4).y = v;
  }

  /** Rebuild the geometry now if text or style changed. Called automatically before rendering. */
  sync(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const { glyphs, metrics } = layoutText(this.content, this.style, fontData());
    this.layoutMetrics = metrics;
    const count = glyphs.length;
    let geometry = this.geometry;
    if (count > this.capacity || this.capacity === 0) {
      if (this.capacity > 0) {
        // Grow into a *new* geometry. `sync()` usually runs in `onBeforeRender`, i.e. while the renderer is
        // in the middle of drawing `this.geometry`: disposing / re-attributing it there left three with a
        // half-released buffer set and the text vanished for good. The old geometry is retired instead and
        // disposed once it is no longer the one being drawn (next `onBeforeRender` / `dispose`).
        if (this.retired && this.retired !== geometry) this.retired.dispose();
        this.retired = geometry;
        geometry = this.geometry = new BufferGeometry();
      }
      this.capacity = Math.max(count, Math.ceil(this.capacity * 1.5), 16);
      const cap = this.capacity;
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(cap * 12), 3));
      geometry.setAttribute('uv', new BufferAttribute(new Float32Array(cap * 8), 2));
      geometry.setAttribute('aLayer', new BufferAttribute(new Float32Array(cap * 4), 1));
      geometry.setAttribute('aColor', new BufferAttribute(new Float32Array(cap * 12), 3));
      const index = new Uint16Array(cap * 6);
      for (let i = 0; i < cap; i++)
        index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
      geometry.setIndex(new BufferAttribute(cap * 4 > 65535 ? new Uint32Array(index) : index, 1));
    }
    const position = geometry.getAttribute('position') as BufferAttribute;
    const uv = geometry.getAttribute('uv') as BufferAttribute;
    const layer = geometry.getAttribute('aLayer') as BufferAttribute;
    const color = geometry.getAttribute('aColor') as BufferAttribute;
    const colors = new Map<RunColor, Color>();
    const resolve = (c: RunColor): Color => {
      let hit = colors.get(c);
      if (!hit) {
        hit =
          c === 'base'
            ? col(this.style.color ?? 'white')
            : c === 'accent'
              ? col(this.style.accent ?? 'cyan')
              : c === 'formula'
                ? col(this.style.formulaColor ?? 'yellow')
                : col(c);
        colors.set(c, hit);
      }
      return hit;
    };
    for (let i = 0; i < count; i++) {
      const g = glyphs[i]!;
      const skewTop = g.skew * (g.y1 - g.baseline);
      const skewBottom = g.skew * (g.y0 - g.baseline);
      const v = i * 4;
      position.setXYZ(v, g.x0 + skewBottom, g.y0, 0);
      position.setXYZ(v + 1, g.x1 + skewBottom, g.y0, 0);
      position.setXYZ(v + 2, g.x0 + skewTop, g.y1, 0);
      position.setXYZ(v + 3, g.x1 + skewTop, g.y1, 0);
      // atlas rows run top-down (v0 = top of the glyph cell); textures are uploaded unflipped
      uv.setXY(v, g.u0, g.v1);
      uv.setXY(v + 1, g.u1, g.v1);
      uv.setXY(v + 2, g.u0, g.v0);
      uv.setXY(v + 3, g.u1, g.v0);
      const c = resolve(g.color);
      for (let k = 0; k < 4; k++) {
        layer.setX(v + k, g.layer);
        color.setXYZ(v + k, c.r, c.g, c.b);
      }
    }
    position.needsUpdate = true;
    uv.needsUpdate = true;
    layer.needsUpdate = true;
    color.needsUpdate = true;
    geometry.setDrawRange(0, count * 6);
    // three sorts transparent objects by the centre of this sphere: keep it on the current text block
    const cx = (metrics.left + metrics.right) / 2;
    const cy = (metrics.top + metrics.bottom) / 2;
    (geometry.boundingSphere ??= new Sphere()).set(
      _pos.set(cx, cy, 0).clone(),
      Math.hypot(metrics.width, metrics.height) / 2 + metrics.lineHeight,
    );
  }

  override onBeforeRender(
    _renderer: WebGLRenderer,
    _scene: Scene,
    camera: Camera,
    drawn?: BufferGeometry,
  ): void {
    if (this.retired && this.retired !== drawn) {
      this.retired.dispose();
      this.retired = null;
    }
    this.sync();
    const billboard = this.style.billboard === true;
    const screen = this.style.screenSpace === true;
    if (!billboard && !screen) return;
    // rewrite the world matrix for this draw: face the camera and/or hold a constant on-screen size
    this.matrixWorld.decompose(_pos, _quat, _scale);
    if (billboard) camera.getWorldQuaternion(_quat);
    if (screen) {
      const depth = Math.max(
        -_m.copy(camera.matrixWorldInverse).multiply(this.matrixWorld).elements[14]!,
        1e-4,
      );
      // world height of one CSS pixel at this depth = 2·depth / (P11 · cssHeight)
      const worldPerPx = (2 * depth) / (camera.projectionMatrix.elements[5]! * textViewport.cssHeight);
      // px-equivalent scale, but never smaller on screen than the legibility floor
      const size = this.style.size ?? 1;
      const pxPerUnit = Math.max(
        textViewport.pxPerUnit,
        (this.style.minScreenPx ?? 16) / Math.max(size, 1e-3),
      );
      _scale.multiplyScalar(worldPerPx * pxPerUnit);
    }
    this.matrixWorld.compose(_pos, _quat, _scale);
  }

  /** Pick against the text block's rectangle (not individual glyphs). */
  override raycast(raycaster: Raycaster, intersects: Intersection[]): void {
    const m = this.metrics;
    if (m.width <= 0) return;
    const inverse = _m.copy(this.matrixWorld).invert();
    const origin = raycaster.ray.origin.clone().applyMatrix4(inverse);
    const direction = raycaster.ray.direction.clone().transformDirection(inverse);
    if (Math.abs(direction.z) < 1e-8) return;
    const t = -origin.z / direction.z;
    if (t < 0) return;
    const x = origin.x + direction.x * t;
    const y = origin.y + direction.y * t;
    const pad = m.lineHeight * 0.15;
    if (x < m.left - pad || x > m.right + pad || y < m.bottom - pad || y > m.top + pad) return;
    const point = new Vector3(x, y, 0).applyMatrix4(this.matrixWorld);
    const distance = raycaster.ray.origin.distanceTo(point);
    if (distance < raycaster.near || distance > raycaster.far) return;
    intersects.push({ distance, point, object: this });
  }

  override dispose(): void {
    this.retired?.dispose();
    this.retired = null;
    this.geometry.dispose();
    this.material.dispose();
  }

  private applyStyle(): void {
    const s = this.style;
    const u = this.material.uniforms;
    const data = fontData();
    const emToSdf = data.em / data.range; // SDF value change per em of distance
    const params = u.uParams!.value as Vector4;
    params.x = s.opacity ?? params.x;
    params.y = s.intensity ?? params.y;
    params.z = Math.min(Math.max(s.weight ?? 0, -0.05), 0.05) * emToSdf;
    const outline = u.uOutline!.value as Vector4;
    if (s.outline && s.outline.width > 0) {
      col(s.outline.color ?? 'bg.void', _color);
      outline.set(_color.r, _color.g, _color.b, Math.min(s.outline.width, 0.1) * emToSdf);
    } else {
      outline.set(0, 0, 0, 0);
    }
    const halo = u.uHalo!.value as Vector4;
    // world labels must stay readable over any background: screen-space text gets a halo unless refused
    const haloStyle = s.halo === false ? null : (s.halo ?? (s.screenSpace ? {} : null));
    if (haloStyle) {
      col(haloStyle.color ?? 'bg.void', _color);
      halo.set(_color.r, _color.g, _color.b, Math.min(haloStyle.radius ?? 0.12, 0.12) * emToSdf);
      u.uHaloOpacity!.value = haloStyle.opacity ?? 0.8;
    } else {
      u.uHaloOpacity!.value = 0;
    }
    this.material.depthTest = s.depthTest ?? true;
    this.material.depthWrite = s.depthWrite ?? true;
  }
}

/** Measure text without creating an object (same result as `new Text3D(text, style).metrics`). */
export function measureText(text: string, style: LayoutOptions = {}): TextMetrics {
  return layoutText(text, style, fontData()).metrics;
}
