/**
 * RibbonLines — many polylines in one draw call (field lines, equipotentials, traces, lightning).
 * Lines can be replaced every frame (`setLines`) within the allocated capacity.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Color,
  DoubleSide,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
} from 'three';
import { col, type ColorLike } from '@/style';
import { hotCore } from '../characters/orb';
import { RIBBON_FRAGMENT, RIBBON_VERTEX } from './ribbon-shader';
import { onTick } from './tick';

export interface RibbonLine {
  points: readonly Vector3[];
  closed?: boolean;
  /** Brightness per point (default 1) or one value for the whole line. */
  brightness?: readonly number[] | number;
}

export interface RibbonOptions {
  /** Total number of points that can be drawn (all lines together). */
  capacity: number;
  color?: ColorLike;
  /** Line width, units. Default 0.03. */
  width?: number;
  /** Minimum on-screen width, px. Default 1.4. */
  minPixels?: number;
  /** Brightness (> 1 blooms). Default 1.15. */
  intensity?: number;
  /** Dashes per unit length. Default 1.2. */
  dashRepeat?: number;
  /** Dash contrast 0 (solid line) … 1. Default 0.75. */
  dashStrength?: number;
  /** Speed of the dashes along the line, units/s. Default 0.6. */
  dashSpeed?: number;
  /** Brightness of the line between dashes, 0…1. Default 0.4. */
  base?: number;
  /** Fade at the start / end of open lines, as fractions of the line. Default [0.04, 0.08]. */
  endFade?: readonly [number, number];
  /** How white the centre of the line is, 0…1 (lightning: ~0.9). Default 0.1 (0 with `keepHue`). */
  hotCore?: number;
  /**
   * Keep the semantic hue on screen (field lines): the crisp core covers the backdrop instead of adding to it and
   * is pre-compensated for the display transform's white bleed like `K.glow({ keepHue })` (peak capped at 1.8);
   * the soft glow stays additive. Default false (fully additive, as before).
   */
  keepHue?: boolean;
  /**
   * Mitred joints: the ribbon keeps its full width through sharp corners (pulse trains, polylines with right
   * angles). Without it the joint direction is the chord prev → next, which pinches short segments next to long
   * ones (thin PWM tops). Default false (smooth curves do not need it).
   */
  mitre?: boolean;
  depthTest?: boolean;
  /**
   * `additive` (default): light added to the frame — glows on dark backdrops, vanishes on a bright `day` sky or
   * white machines. `normal` (M3): alpha-blended paint — the line covers what is behind it in its own colour
   * (wind streaks, streamlines, wakes over sky); dashes modulate coverage, `intensity` brightens the colour.
   */
  blend?: 'additive' | 'normal';
}

const _t = new Vector3();
const _d1 = new Vector3();
const _d2 = new Vector3();
const _size = new Vector2();

export class RibbonLines extends Mesh<BufferGeometry, ShaderMaterial> {
  readonly capacity: number;
  /** Dash travel speed, units/s (tweenable; negative reverses). */
  dashSpeed: number;
  private readonly mitre: boolean;
  private readonly pos: BufferAttribute;
  private readonly tan: BufferAttribute;
  private readonly line: BufferAttribute;
  private readonly index: BufferAttribute;

  constructor(o: RibbonOptions) {
    const cap = o.capacity;
    const geometry = new BufferGeometry();
    const color = col(o.color ?? 'white');
    const material = new ShaderMaterial({
      name: 'fx.ribbon',
      uniforms: {
        uRibbon: { value: new Vector4((o.width ?? 0.03) / 2, 3, (o.minPixels ?? 1.4) / 2, 1080) },
        uColor: { value: color },
        uCore: { value: hotCore(color, 0.7) },
        uDash: { value: new Vector4(o.dashRepeat ?? 1.2, 0, o.dashStrength ?? 0.75, 0.22) },
        uOut: { value: new Vector4(o.intensity ?? 1.15, 1, 1, o.base ?? 0.4) },
        uEnds: { value: new Vector3(o.endFade?.[0] ?? 0.04, o.endFade?.[1] ?? 0.08, o.hotCore ?? (o.keepHue ? 0 : 0.1)) },
      },
      defines: {
        ...(o.keepHue ? { FX_RIBBON_KEEP_HUE: '' } : {}),
        ...(o.blend === 'normal' ? { FX_RIBBON_NORMAL: '' } : {}),
      },
      vertexShader: RIBBON_VERTEX,
      fragmentShader: RIBBON_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: o.depthTest ?? true,
      // with premultipliedAlpha, NormalBlending is (ONE, ONE_MINUS_SRC_ALPHA): alpha 0 = additive glow
      blending: o.keepHue || o.blend === 'normal' ? NormalBlending : AdditiveBlending,
      premultipliedAlpha: true,
      side: DoubleSide,
    });
    super(geometry, material);
    this.name = 'ribbon-lines';
    this.frustumCulled = false;
    this.raycast = () => undefined; // shader-shaped: the base geometry is not where the effect is
    this.capacity = cap;
    this.dashSpeed = o.dashSpeed ?? 0.6;
    this.mitre = o.mitre ?? false;
    this.pos = new BufferAttribute(new Float32Array(cap * 2 * 3), 3);
    this.tan = new BufferAttribute(new Float32Array(cap * 2 * 3), 3);
    this.line = new BufferAttribute(new Float32Array(cap * 2 * 4), 4);
    this.index = new BufferAttribute(new Uint32Array(cap * 6), 1);
    geometry.setAttribute('position', this.pos);
    geometry.setAttribute('aTangent', this.tan);
    geometry.setAttribute('aLine', this.line);
    geometry.setIndex(this.index);
    geometry.setDrawRange(0, 0);
    geometry.boundingSphere = new Sphere(new Vector3(), Infinity);
    onTick(this, (_time, dt) => {
      const d = material.uniforms.uDash!.value as Vector4;
      d.y = (d.y + this.dashSpeed * d.x * dt) % 1024;
    });
  }

  /** Replace all lines. Points beyond the capacity are dropped (whole lines). */
  setLines(lines: readonly RibbonLine[]): void {
    let v = 0; // vertex pairs written
    let ix = 0;
    for (const l of lines) {
      const n = l.points.length;
      const total = n + (l.closed ? 1 : 0);
      if (n < 2 || v + total > this.capacity) continue;
      let length = 0;
      for (let i = 1; i < total; i++) length += l.points[i % n]!.distanceTo(l.points[i - 1]!);
      let u = 0;
      for (let i = 0; i < total; i++) {
        const p = l.points[i % n]!;
        const prev = l.points[l.closed ? (i - 1 + n) % n : Math.max(i - 1, 0)]!;
        const next = l.points[l.closed ? (i + 1) % n : Math.min(i + 1, n - 1)]!;
        if (i > 0) u += p.distanceTo(l.points[i - 1]!);
        _t.subVectors(next, prev).normalize();
        if (this.mitre) this.mitreTangent(prev, p, next);
        const b = typeof l.brightness === 'number' ? l.brightness : (l.brightness?.[i % n] ?? 1);
        // closed lines have no ends: park their 0…1 coordinate in the middle so the end fade never bites
        const along = l.closed ? 0.5 : length > 0 ? u / length : 0;
        for (let s = 0; s < 2; s++) {
          const k = (v + i) * 2 + s;
          this.pos.setXYZ(k, p.x, p.y, p.z);
          this.tan.setXYZ(k, _t.x, _t.y, _t.z);
          this.line.setXYZW(k, u, along, b, s === 0 ? -1 : 1);
        }
        if (i < total - 1) {
          const a = (v + i) * 2;
          this.index.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], ix);
          ix += 6;
        }
      }
      v += total;
    }
    this.pos.needsUpdate = this.tan.needsUpdate = this.line.needsUpdate = this.index.needsUpdate = true;
    this.geometry.setDrawRange(0, ix);
  }

  /**
   * Joint direction = bisector of the unit directions in / out, scaled by the mitre length 1 / cos(θ/2) (capped at
   * 3); the vertex shader reads that length as a width factor (plain tangents have length 1).
   */
  private mitreTangent(prev: Vector3, p: Vector3, next: Vector3): void {
    _d1.subVectors(p, prev);
    _d2.subVectors(next, p);
    if (_d1.lengthSq() < 1e-12 || _d2.lengthSq() < 1e-12) return;
    _d1.normalize();
    _t.copy(_d2.normalize()).add(_d1);
    if (_t.lengthSq() < 1e-8) {
      _t.copy(_d1); // full reversal: no sensible mitre
      return;
    }
    _t.normalize().multiplyScalar(1 / Math.max(_t.dot(_d1), 1 / 3));
  }

  override onBeforeRender(renderer: WebGLRenderer): void {
    const target = renderer.getRenderTarget();
    (this.material.uniforms.uRibbon!.value as Vector4).w = target ? target.height : renderer.getDrawingBufferSize(_size).y;
  }

  get color(): Color {
    return this.material.uniforms.uColor!.value as Color;
  }
  setColor(color: ColorLike): this {
    const c = col(color, this.color);
    (this.material.uniforms.uCore!.value as Color).copy(hotCore(c, 0.7));
    return this;
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
  /** 0…1: how much of every line is drawn from its start (tween 0 → 1 to grow the lines). */
  get reveal(): number {
    return (this.material.uniforms.uOut!.value as Vector4).z;
  }
  set reveal(v: number) {
    (this.material.uniforms.uOut!.value as Vector4).z = v;
  }
  /** Line width, units. */
  set width(v: number) {
    (this.material.uniforms.uRibbon!.value as Vector4).x = v / 2;
  }
}
