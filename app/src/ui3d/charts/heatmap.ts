/**
 * HeatMap — a value over two parameters as a smooth colour field, with a marker the user drags to pick a
 * point (e.g. yearly PV yield over tilt × azimuth). The field is a small data texture, bilinearly filtered.
 */
import {
  DataTexture,
  LinearFilter,
  Mesh,
  Object3D,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { fmtUnit } from '@/content/format';
import { col, type ColorLike } from '@/style';
import { fontData, layoutText } from '@/text';
import type { PointerInfo } from '@/engine/api';
import { UiNode, type NodeProps } from '../core/node';
import { rgba, type Painter } from '../core/painter';
import { MeshNode } from '../core/surface';
import { TEXT_COLOR, UI } from '../theme';
import { Axis, type AxisSpec } from './axis';

export interface HeatMapProps extends NodeProps {
  x: AxisSpec;
  y: AxisSpec;
  /** Grid resolution of the field. Default 48 × 32. */
  nx?: number;
  ny?: number;
  /** Value at a point (called once per cell when the field is built). */
  value: (x: number, y: number) => number;
  /** Value range mapped to the colour ramp. */
  min: number;
  max: number;
  /** Ramp stops from low to high. Default a cold → hot palette ramp. */
  ramp?: readonly ColorLike[];
  /** Initial marker position; omit for no marker. */
  marker?: { x: number; y: number };
  /** Called while the user drags the marker. */
  onPick?: (x: number, y: number, value: number) => void;
  unit?: string;
}

const PAD = { left: 52, right: 12, top: 26, bottom: 40 };

export class HeatMap extends UiNode {
  private readonly axes: { x: Axis; y: Axis };
  private mark: { x: number; y: number } | null;
  private readonly texture: DataTexture;
  private readonly overlay: UiNode;

  constructor(private readonly cfg: HeatMapProps) {
    super({ dir: 'stack', width: 'fill', height: 240, ...cfg });
    this.axes = { x: new Axis(cfg.x), y: new Axis(cfg.y) };
    this.mark = cfg.marker ? { ...cfg.marker } : null;
    const nx = cfg.nx ?? 48;
    const ny = cfg.ny ?? 32;
    const stops = (cfg.ramp ?? ['bg.indigo', 'blue', 'teal', 'lime', 'yellow']).map((c) =>
      col(c).convertLinearToSRGB(),
    );
    const data = new Uint8Array(nx * ny * 4);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v = cfg.value(this.axes.x.value((i + 0.5) / nx), this.axes.y.value((j + 0.5) / ny));
        const t = Math.min(Math.max((v - cfg.min) / (cfg.max - cfg.min || 1), 0), 1) * (stops.length - 1);
        const k = Math.min(Math.floor(t), stops.length - 2);
        const c = stops[k]!.clone().lerp(stops[k + 1]!, t - k);
        data.set([c.r * 255, c.g * 255, c.b * 255, 255], (j * nx + i) * 4);
      }
    }
    this.texture = new DataTexture(data, nx, ny, RGBAFormat, UnsignedByteType);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.magFilter = this.texture.minFilter = LinearFilter;
    this.texture.needsUpdate = true;
    const material = new ShaderMaterial({
      uniforms: { tMap: { value: this.texture }, uOpacity: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: /* glsl */ `uniform sampler2D tMap; uniform float uOpacity; varying vec2 vUv; void main() { gl_FragColor = vec4( texture2D( tMap, vUv ).rgb, uOpacity ); }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    // the surface drives the holder's matrix (node placement); the quad inside it covers the plot rectangle
    const quad = new Mesh(new PlaneGeometry(1, 1), material);
    // (a plain Object3D: a Group would get its own sort group and draw over every other UI layer)
    const holder = new Object3D();
    holder.add(quad);
    const field = new MeshNode(holder, { float: { ax: 0.5, ay: 0.5 }, width: 'fill', height: 'fill' });
    field.onPlace = (opacity) => {
      material.uniforms.uOpacity!.value = opacity;
      const a = this.area();
      quad.scale.set(a.w, a.h, 1);
      quad.position.set(a.x0 + a.w / 2, a.y0 + a.h / 2, 0);
    };
    const paintMarker = (p: Painter): void => this.paintMarker(p);
    this.overlay = new (class extends UiNode {
      override paint(p: Painter): void {
        paintMarker(p);
      }
    })({ float: { ax: 0.5, ay: 0.5 }, width: 'fill', height: 'fill', layerUp: 1 });
    this.add(field, this.overlay);
    const pick = (e: PointerInfo): void => {
      const pt = this.localPoint(e);
      if (!pt || !this.mark) return;
      const a = this.area();
      this.setMarker(
        this.axes.x.value(Math.min(Math.max((pt.x - a.x0) / a.w, 0), 1)),
        this.axes.y.value(Math.min(Math.max((pt.y - a.y0) / a.h, 0), 1)),
        true,
      );
    };
    if (this.mark)
      this.on({
        cursor: 'crosshair',
        press: pick,
        dragStart: pick,
        drag: pick,
        tooltip: 'Перетягніть маркер',
      });
  }

  get marker(): { x: number; y: number } | null {
    return this.mark;
  }

  setMarker(x: number, y: number, notify = false): void {
    this.mark = { x, y };
    this.overlay.repaint();
    if (notify) this.cfg.onPick?.(x, y, this.cfg.value(x, y));
  }

  private area(): { x0: number; y0: number; w: number; h: number } {
    return {
      x0: -this.bw / 2 + PAD.left,
      y0: -this.bh / 2 + PAD.bottom,
      w: Math.max(this.bw - PAD.left - PAD.right, 10),
      h: Math.max(this.bh - PAD.top - PAD.bottom, 10),
    };
  }

  private label(p: Painter, text: string, x: number, y: number, align: number, bold = false): void {
    const l = layoutText(
      text,
      {
        font: bold ? 'bodyBold' : 'mono',
        size: UI.text.caption - (bold ? 0 : 1),
        anchorX: 'left',
        anchorY: 'top',
        lineHeight: 1.2,
      },
      fontData(),
    );
    const c = rgba(bold ? 'white' : TEXT_COLOR.dim);
    p.text(l, x - l.metrics.width * align, y + l.metrics.height / 2, 1, { base: c, accent: c, formula: c });
  }

  override paint(p: Painter): void {
    const a = this.area();
    p.rect(a.x0 + a.w / 2, a.y0 + a.h / 2, a.w + 6, a.h + 6, {
      r: UI.radius.inset,
      border: rgba('slate', 0.7),
      bw: 1.2,
    });
    for (const v of this.axes.x.ticks())
      this.label(p, this.axes.x.label(v), a.x0 + a.w * this.axes.x.t(v), a.y0 - 14, 0.5);
    for (const v of this.axes.y.ticks())
      this.label(p, this.axes.y.label(v), a.x0 - 8, a.y0 + a.h * this.axes.y.t(v), 1);
    if (this.cfg.x.label) this.label(p, this.cfg.x.label, a.x0 + a.w, a.y0 - 31, 1, true);
    if (this.cfg.y.label) this.label(p, this.cfg.y.label, a.x0 - 2, a.y0 + a.h + 15, 0, true);
  }

  /** @internal */
  paintMarker(p: Painter): void {
    if (!this.mark) return;
    const a = this.area();
    const x = a.x0 + a.w * this.axes.x.t(this.mark.x);
    const y = a.y0 + a.h * this.axes.y.t(this.mark.y);
    p.rect(x, a.y0 + a.h / 2, 1.4, a.h, { fill: rgba('white', 0.55), rot: 0 });
    p.rect(a.x0 + a.w / 2, y, a.w, 1.4, { fill: rgba('white', 0.55) });
    p.circle(x, y, 20, {
      fill: rgba('bg.void', 0.35),
      border: rgba('white'),
      bw: 3,
      glow: 8,
      glowAlpha: 0.5,
    });
    const text = fmtUnit(this.cfg.value(this.mark.x, this.mark.y), this.cfg.unit ?? '', { maxDigits: 1 });
    const l = layoutText(
      text,
      { font: 'bodyBold', size: UI.text.caption, anchorX: 'left', anchorY: 'top', lineHeight: 1.2 },
      fontData(),
    );
    const lx = x + 16 + l.metrics.width > a.x0 + a.w ? x - 16 - l.metrics.width : x + 16;
    p.rect(lx + l.metrics.width / 2, y + 20, l.metrics.width + 12, l.metrics.height + 4, {
      r: 6,
      fill: rgba('bg.void', 0.9),
    });
    p.text(l, lx, y + 20 + l.metrics.height / 2, 1, {
      base: rgba('white'),
      accent: rgba('white'),
      formula: rgba('white'),
    });
  }
}
