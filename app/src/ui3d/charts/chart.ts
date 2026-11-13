/**
 * Chart — XY plot widget: static curves (I-V with the operating point), live scrolling multi-series plots,
 * filled and stacked areas (also below zero), bars (also on a log axis — harmonic spectra), two Y axes,
 * markers with guide lines to the axes, a marker the user can drag along X. Axes, ticks, units, legend.
 * Data may contain NaN (or ±Infinity): the curve breaks there (gaps in a record, undefined regions).
 *
 *   const chart = new Chart({ height: 230, x: { min: 0, max: 45, label: 'U, V' }, y: { min: 0, max: 15, label: 'I, A' },
 *     y2: { min: 0, max: 500, label: 'P, W' },
 *     series: [{ id: 'iv', label: 'I(U)', color: 'sky' }, { id: 'pv', label: 'P(U)', color: 'yellow', axis: 'y2' }] });
 *   chart.setData('iv', us, is);   chart.setMarker('op', { x: 33.1, y: 13.3, label: 'MPP' });
 */
import { fontData, layoutText, type LayoutResult } from '@/text';
import type { ColorLike } from '@/style';
import { UiNode, type NodeProps } from '../core/node';
import { UI } from '../theme';
import { Legend } from '../widgets/legend';
import { Axis, type AxisSpec } from './axis';
import { ChartFrame } from './chart-paint';
import { PlotMesh } from './plot';

export interface SeriesSpec {
  id: string;
  /** Legend text (omit to keep the series out of the legend). */
  label?: string;
  color: ColorLike;
  /** Which Y axis the series uses. Default `y`. */
  axis?: 'y' | 'y2';
  /** `line` (default) · `area` (line + fill to zero) · `bars` · `step` (staircase line). */
  kind?: 'line' | 'area' | 'bars' | 'step';
  /** Line width in units. Default 2.6. */
  width?: number;
  /** Series with the same stack id pile up (positive values up from zero, negative values down). */
  stack?: string;
  /** Dashed line: `true` (8 on, 6 off units) or `[on, off]` (open-circuit voltage, «поза межами моделі» tails). */
  dash?: boolean | readonly [number, number];
  /** Line / fill opacity 0…1 (a lighter companion curve). Default 1. */
  opacity?: number;
}

export interface MarkerSpec {
  x: number;
  y: number;
  axis?: 'y' | 'y2';
  color?: ColorLike;
  label?: string;
  /** Dashed guide lines to the axes. Default true. */
  guides?: boolean;
}

export interface ChartProps extends NodeProps {
  x: AxisSpec;
  y: AxisSpec;
  /** Second Y axis on the right. */
  y2?: AxisSpec;
  series: readonly SeriesSpec[];
  /** Live mode: `push()` appends samples and the X axis shows the last `window` units (seconds). */
  window?: number;
  legend?: boolean;
  /** The user drags a vertical cursor along X; called with the X value. */
  onScrub?: (x: number) => void;
}

interface SeriesData {
  spec: SeriesSpec;
  xs: number[];
  ys: number[];
}

/** @internal Plot margins inside the frame. */
export const PAD = { left: 56, right: 14, top: 26, bottom: 28 };

export class Chart extends UiNode {
  readonly axes: { x: Axis; y: Axis; y2: Axis | null };
  /** @internal */
  readonly data = new Map<string, SeriesData>();
  /** @internal */
  readonly markers = new Map<string, MarkerSpec>();
  /** @internal */
  readonly cfg: ChartProps;
  /** @internal */
  readonly plot = new PlotMesh();
  /** @internal */
  dirty = true;
  private readonly labels = new Map<string, LayoutResult>();
  /** @internal */
  readonly frame: UiNode;

  constructor(props: ChartProps) {
    super({ dir: 'col', gap: 6, width: 'fill', ...props, height: 'hug', children: [] });
    this.cfg = props;
    this.axes = {
      x: new Axis({ ...props.x }),
      y: new Axis({ ...props.y }),
      y2: props.y2 ? new Axis({ ...props.y2 }) : null,
    };
    for (const spec of props.series) this.data.set(spec.id, { spec, xs: [], ys: [] });
    this.frame = new ChartFrame(this, typeof props.height === 'number' ? props.height : 220);
    this.add(this.frame);
    const keys = props.series.filter((s) => s.label);
    if ((props.legend ?? keys.length > 1) && keys.length > 0)
      this.add(
        new Legend({
          items: keys.map((s) => ({
            label: s.label!,
            color: s.color,
            swatch: s.kind === 'bars' ? 'box' : 'line',
          })),
          pad: [0, 0, 0, PAD.left],
        }),
      );
  }

  /** Replace a series' points. */
  setData(id: string, xs: ArrayLike<number>, ys: ArrayLike<number>): void {
    const s = this.data.get(id);
    if (!s) return;
    s.xs = Array.from(xs);
    s.ys = Array.from(ys);
    // curves live in the plot mesh; only bars are painted with the frame
    this.dirty = true;
    if (s.spec.kind === 'bars') this.frame.repaint();
  }

  /** Append a sample (live plots). With `window` set, old samples scroll out on the left. */
  push(id: string, x: number, y: number): void {
    const s = this.data.get(id);
    if (!s) return;
    s.xs.push(x);
    s.ys.push(y);
    const win = this.cfg.window;
    if (win) {
      while (s.xs.length > 2 && s.xs[1]! < x - win) {
        s.xs.shift();
        s.ys.shift();
      }
      const ax = this.axes.x.spec;
      if (x > ax.max) {
        ax.max = x;
        ax.min = x - win;
        this.frame.repaint();
      }
    }
    this.dirty = true;
  }

  clearData(id?: string): void {
    for (const s of this.data.values()) if (!id || s.spec.id === id) s.xs.length = s.ys.length = 0;
    this.touch();
  }

  /** Change an axis range / label at run time. */
  setAxis(which: 'x' | 'y' | 'y2', spec: Partial<AxisSpec>): void {
    const axis = this.axes[which];
    if (axis) Object.assign(axis.spec, spec);
    this.touch();
  }

  /** Add or move a marker (operating point, MPP, limit…). */
  setMarker(id: string, marker: MarkerSpec | null): void {
    const before = this.markers.get(id);
    if (marker && before && before.x === marker.x && before.y === marker.y && before.label === marker.label)
      return;
    if (marker) this.markers.set(id, marker);
    else this.markers.delete(id);
    this.frame.children[1]?.repaint();
  }

  /** @internal Cached layout of a tick / axis label. */
  tick(text: string, bold = false): LayoutResult {
    const key = (bold ? 'b' : 'n') + text;
    let hit = this.labels.get(key);
    if (!hit) {
      if (this.labels.size > 400) this.labels.clear();
      hit = layoutText(
        text,
        {
          font: bold ? 'bodyBold' : 'mono',
          size: bold ? UI.text.caption : UI.text.caption - 1,
          anchorX: 'left',
          anchorY: 'top',
          lineHeight: 1.2,
        },
        fontData(),
      );
      this.labels.set(key, hit);
    }
    return hit;
  }

  /** @internal Plot rectangle in frame-local units: left, bottom, width, height. */
  area(): { x0: number; y0: number; w: number; h: number } {
    const f = this.frame;
    const right = this.axes.y2 ? PAD.left : PAD.right;
    const bottom = PAD.bottom + (this.axes.x.spec.label ? 16 : 0);
    return {
      x0: -f.bw / 2 + PAD.left,
      y0: -f.bh / 2 + bottom,
      w: Math.max(f.bw - PAD.left - right, 10),
      h: Math.max(f.bh - PAD.top - bottom, 10),
    };
  }

  /** Something other than curve data changed: repaint the frame (ticks, bars) and the marker layer too. */
  private touch(): void {
    this.dirty = true;
    this.frame.repaint();
    this.frame.children.forEach((c) => c.repaint());
  }
}
