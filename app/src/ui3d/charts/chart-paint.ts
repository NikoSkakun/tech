/**
 * Drawing of `Chart`: the frame (well, grid, ticks, axis titles, bars) through the shape / glyph batches,
 * the curves through the chart's `PlotMesh`, markers on the layer above the curves.
 */
import { UiNode } from '../core/node';
import { lit, rgba, type Painter, type Rgba, type TextColors } from '../core/painter';
import { MeshNode } from '../core/surface';
import { accentOf, TEXT_COLOR, UI } from '../theme';
import type { Axis } from './axis';
import type { Chart } from './chart';

const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1);

function colors(c: Rgba): TextColors {
  return { base: c, accent: c, formula: c };
}

export class ChartFrame extends UiNode {
  constructor(
    private readonly chart: Chart,
    height: number,
  ) {
    super({ dir: 'stack', width: 'fill', height });
    const plot = new MeshNode(chart.plot, { float: { ax: 0.5, ay: 0.5 }, width: 'fill', height: 'fill' });
    plot.onPlace = (opacity) => {
      chart.plot.opacity = opacity;
      if (chart.dirty && this.bw > 0) {
        chart.dirty = false;
        buildPlot(chart);
      }
    };
    this.add(plot, new MarkerLayer(chart));
    const scrub = chart.cfg.onScrub;
    if (scrub) {
      const at = (e: Parameters<UiNode['localPoint']>[0]): void => {
        const p = this.localPoint(e);
        const a = chart.area();
        if (p) scrub(chart.axes.x.value(clamp01((p.x - a.x0) / a.w)));
      };
      this.on({ cursor: 'ew-resize', press: at, dragStart: at, drag: at, tooltip: 'Перетягніть уздовж осі' });
    } else this.on({ cursor: 'default' });
  }

  override paint(p: Painter): void {
    const chart = this.chart;
    const { x: ax, y: ay, y2 } = chart.axes;
    const a = chart.area();
    const dim = rgba(TEXT_COLOR.mute);
    const text = rgba(TEXT_COLOR.dim);
    p.rect(a.x0 + a.w / 2, a.y0 + a.h / 2, a.w + 8, a.h + 8, {
      r: UI.radius.inset,
      fill: rgba('bg.void', 0.62),
      border: rgba('slate', 0.55),
      bw: 1,
    });
    // horizontal grid + left ticks
    for (const v of ay.ticks()) {
      const y = a.y0 + a.h * clamp01(ay.t(v));
      const zero = v === 0 && ay.spec.min < 0;
      p.rect(a.x0 + a.w / 2, y, a.w, zero ? 1.6 : 1, {
        fill: rgba(zero ? 'mist' : 'slate', zero ? 0.7 : 0.4),
        dash: zero ? 0 : 7,
      });
      if (!ay.spec.bare) {
        const l = chart.tick(ay.label(v));
        p.text(l, a.x0 - 9 - l.metrics.width, y + l.metrics.height / 2, 1, colors(text));
      }
    }
    if (y2 && !y2.spec.bare) {
      for (const v of y2.ticks()) {
        const l = chart.tick(y2.label(v));
        p.text(l, a.x0 + a.w + 9, a.y0 + a.h * clamp01(y2.t(v)) + l.metrics.height / 2, 1, colors(text));
      }
    }
    for (const v of ax.ticks()) {
      const x = a.x0 + a.w * clamp01(ax.t(v));
      p.rect(x, a.y0 - 4, 1.2, 6, { fill: dim });
      if (!ax.spec.bare) {
        const l = chart.tick(ax.label(v));
        p.text(l, x - l.metrics.width / 2, a.y0 - 9, 1, colors(text));
      }
    }
    // axis titles: X under the ticks on the right; Y / Y2 in the margin above the plot's top corners
    const title = (s: string | undefined, x: number, y: number, right: boolean, tone: Rgba): void => {
      if (!s) return;
      const l = chart.tick(s, true);
      p.text(l, right ? x - l.metrics.width : x, y, 1, colors(tone));
    };
    title(ax.spec.label, a.x0 + a.w, a.y0 - 26, true, rgba('white'));
    const first = (axis: 'y' | 'y2'): Rgba => {
      const s = [...chart.data.values()].find((d) => (d.spec.axis ?? 'y') === axis);
      return s && y2 ? lit(rgba(s.spec.color), 1.1) : rgba('white');
    };
    title(ay.spec.label, a.x0 - 2, a.y0 + a.h + 25, false, first('y'));
    title(y2?.spec.label, a.x0 + a.w + 2, a.y0 + a.h + 25, true, first('y2'));
    // bars
    for (const s of chart.data.values()) {
      if (s.spec.kind !== 'bars' || s.xs.length === 0) continue;
      const axis: Axis = s.spec.axis === 'y2' && y2 ? y2 : ay;
      const base = a.y0 + a.h * clamp01(axis.t(axis.spec.log ? axis.spec.min : 0));
      const bw = Math.max(Math.min((a.w / s.xs.length) * 0.68, 26), 2);
      const c = rgba(s.spec.color, s.spec.opacity ?? 1);
      for (let i = 0; i < s.xs.length; i++) {
        if (!Number.isFinite(s.xs[i]!) || !Number.isFinite(s.ys[i]!)) continue; // a gap, not a bar
        const x = a.x0 + a.w * clamp01(ax.t(s.xs[i]!));
        const y = a.y0 + a.h * clamp01(axis.t(s.ys[i]!));
        const h = Math.abs(y - base);
        if (h < 0.5) continue;
        p.rect(x, (y + base) / 2, bw, h, { r: Math.min(bw / 2, 3), fill: lit(c, 1.15), fill2: lit(c, 0.7) });
      }
    }
  }
}

class MarkerLayer extends UiNode {
  constructor(private readonly chart: Chart) {
    super({ float: { ax: 0.5, ay: 0.5 }, width: 'fill', height: 'fill', layerUp: 1 });
  }
  override paint(p: Painter): void {
    const chart = this.chart;
    const a = chart.area();
    for (const m of chart.markers.values()) {
      const axis = m.axis === 'y2' && chart.axes.y2 ? chart.axes.y2 : chart.axes.y;
      const tx = chart.axes.x.t(m.x);
      const ty = axis.t(m.y);
      if (tx < -0.001 || tx > 1.001 || ty < -0.001 || ty > 1.001) continue;
      const x = a.x0 + a.w * tx;
      const y = a.y0 + a.h * ty;
      const c = rgba(m.color ?? accentOf(this));
      if (m.guides ?? true) {
        p.rect((x + a.x0) / 2, y, x - a.x0, 1.4, { fill: [c[0], c[1], c[2], 0.75], dash: 8 });
        p.line(x, a.y0, x, y, 1.4, { fill: [c[0], c[1], c[2], 0.5] });
      }
      p.circle(x, y, 15, { fill: rgba('white'), border: lit(c, 1.3), bw: 3.5, glow: 9, glowAlpha: 0.45 });
      if (m.label) {
        const l = chart.tick(m.label, true);
        const lx = x + 12 + l.metrics.width > a.x0 + a.w ? x - 12 - l.metrics.width : x + 12;
        p.rect(lx + l.metrics.width / 2, y + 18, l.metrics.width + 10, l.metrics.height + 2, {
          r: 5,
          fill: rgba('bg.void', 0.85),
        });
        p.text(l, lx, y + 18 + l.metrics.height / 2, 1, colors(rgba('white')));
      }
    }
  }
}

const DASH: readonly [number, number] = [8, 6];

/** Cut a polyline (x, y pairs) into dashes of `on` units separated by `off` units, measured along the curve. */
function dashes(xy: readonly number[], on: number, off: number): number[][] {
  const out: number[][] = [];
  let piece: number[] | null = [xy[0]!, xy[1]!];
  let left = on; // length left in the current dash (or gap when piece is null)
  for (let i = 2; i < xy.length; i += 2) {
    let x0 = xy[i - 2]!;
    let y0 = xy[i - 1]!;
    const x1 = xy[i]!;
    const y1 = xy[i + 1]!;
    let len = Math.hypot(x1 - x0, y1 - y0);
    while (len > left) {
      const k = left / len;
      const xm = x0 + (x1 - x0) * k;
      const ym = y0 + (y1 - y0) * k;
      if (piece) {
        piece.push(xm, ym);
        out.push(piece);
        piece = null;
        left = off;
      } else {
        piece = [xm, ym];
        left = on;
      }
      len -= Math.hypot(xm - x0, ym - y0);
      x0 = xm;
      y0 = ym;
    }
    left -= len;
    if (piece) piece.push(x1, y1);
  }
  if (piece && piece.length >= 4) out.push(piece);
  return out;
}

/** Rebuild the chart's curve mesh from its series data. */
function buildPlot(chart: Chart): void {
  const plot = chart.plot;
  const a = chart.area();
  const ax = chart.axes.x;
  plot.begin();
  // running totals of stacked series, per stack id and sample index
  const up = new Map<string, number[]>();
  const down = new Map<string, number[]>();
  for (const s of chart.data.values()) {
    const kind = s.spec.kind ?? 'line';
    const n = Math.min(s.xs.length, s.ys.length);
    if (kind === 'bars' || n < 2) continue;
    const axis = s.spec.axis === 'y2' && chart.axes.y2 ? chart.axes.y2 : chart.axes.y;
    const color = lit(rgba(s.spec.color, s.spec.opacity ?? 1), 1.2);
    const px = (v: number): number => a.x0 + a.w * clamp01(ax.t(v));
    const py = (v: number): number => a.y0 + a.h * clamp01(axis.t(v));
    const top: number[] = [];
    const bottom: number[] = [];
    const stack = s.spec.stack;
    if (stack) {
      const pos = up.get(stack) ?? up.set(stack, []).get(stack)!;
      const neg = down.get(stack) ?? down.set(stack, []).get(stack)!;
      for (let i = 0; i < n; i++) {
        const v = s.ys[i]!;
        const from = v >= 0 ? (pos[i] ?? 0) : (neg[i] ?? 0);
        const to = from + v;
        if (v >= 0) pos[i] = to;
        else neg[i] = to;
        const x = px(s.xs[i]!);
        top.push(x, py(to));
        bottom.push(x, py(from));
      }
      plot.area(top, bottom, n, color, 0.78, 0.6);
      plot.line(top, n, 1.4, color);
      continue;
    }
    // NaN / Infinity break the curve: draw each finite run on its own
    let run: number[] = [];
    const flush = (): void => {
      const count = run.length / 2;
      if (count >= 2) {
        if (kind === 'area') {
          const zero = py(axis.spec.log ? axis.spec.min : 0);
          const base: number[] = [];
          for (let i = 0; i < count; i++) base.push(run[i * 2]!, zero);
          plot.area(run, base, count, color, 0.42, 0.04);
        }
        const width = s.spec.width ?? 2.6;
        const dash = s.spec.dash === true ? DASH : s.spec.dash || null;
        if (dash) for (const piece of dashes(run, dash[0], dash[1])) plot.line(piece, piece.length / 2, width, color);
        else plot.line(run, count, width, color);
      }
      run = [];
    };
    for (let i = 0; i < n; i++) {
      const xv = s.xs[i]!;
      const yv = s.ys[i]!;
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) {
        flush();
        continue;
      }
      const x = px(xv);
      const y = py(yv);
      if (kind === 'step' && run.length > 0) run.push(x, run[run.length - 1]!);
      run.push(x, y);
    }
    flush();
  }
  plot.end();
}
