/**
 * RadarChart — several quantities on spokes around a centre, one polygon per series (e.g. battery chemistries
 * compared on energy density, power, safety, life, cost). Values are 0…1 per axis.
 */
import { fontData, layoutText, type LayoutResult } from '@/text';
import type { ColorLike } from '@/style';
import { UiNode, type NodeProps } from '../core/node';
import { lit, rgba, type Painter } from '../core/painter';
import { MeshNode } from '../core/surface';
import { TEXT_COLOR, UI } from '../theme';
import { Legend } from '../widgets/legend';
import { PlotMesh } from './plot';

export interface RadarSeries {
  id: string;
  label: string;
  color: ColorLike;
  /** One value per axis, 0…1. */
  values: readonly number[];
}

export interface RadarProps extends NodeProps {
  axes: readonly string[];
  series: readonly RadarSeries[];
  /** Diameter of the web in units. Default 240. */
  size?: number;
  /** Number of rings. Default 4. */
  rings?: number;
  /** Show the legend under the web. Default true. */
  legend?: boolean;
}

export class RadarChart extends UiNode {
  private readonly plot = new PlotMesh();
  private readonly web: UiNode;
  private series: RadarSeries[];
  private highlighted: string | null = null;
  private dirty = true;
  private legend: Legend | null = null;

  constructor(private readonly cfg: RadarProps) {
    super({ dir: 'col', gap: 8, align: 'center', ...cfg, children: [] });
    this.series = [...cfg.series];
    const d = cfg.size ?? 240;
    const labels = cfg.axes.map((a): LayoutResult =>
      layoutText(
        a,
        { font: 'body', size: UI.text.caption, anchorX: 'left', anchorY: 'top', lineHeight: 1.2 },
        fontData(),
      ),
    );
    const n = cfg.axes.length;
    const dir = (i: number): [number, number] => [
      Math.sin((i / n) * Math.PI * 2),
      Math.cos((i / n) * Math.PI * 2),
    ];
    const mesh = new MeshNode(this.plot, { float: { ax: 0.5, ay: 0.5 }, width: 'fill', height: 'fill' });
    mesh.onPlace = (opacity) => {
      this.plot.opacity = opacity;
      if (!this.dirty) return;
      this.dirty = false;
      const r = d / 2;
      this.plot.begin();
      for (const s of this.series) {
        const dim = this.highlighted !== null && this.highlighted !== s.id;
        const c = lit(rgba(s.color, dim ? 0.35 : 1), 1.2);
        const pts: number[] = [];
        const centre: number[] = [];
        for (let i = 0; i <= n; i++) {
          const [x, y] = dir(i % n);
          const v = Math.min(Math.max(s.values[i % n] ?? 0, 0), 1);
          pts.push(x * r * v, y * r * v);
          centre.push(0, 0);
        }
        this.plot.area(pts, centre, n + 1, c, dim ? 0.06 : 0.22, dim ? 0.02 : 0.08);
        this.plot.line(pts, n + 1, 2.4, c);
      }
      this.plot.end();
    };
    this.web = new (class extends UiNode {
      override paint(p: Painter): void {
        const r = d / 2;
        const rings = cfg.rings ?? 4;
        for (let k = 1; k <= rings; k++)
          p.arc(0, 0, (d * k) / rings, 0, Math.PI * 2, 1.2, { fill: rgba('slate', k === rings ? 0.8 : 0.4) });
        for (let i = 0; i < n; i++) {
          const [x, y] = dir(i);
          p.line(0, 0, x * r, y * r, 1.2, { fill: rgba('slate', 0.6) });
          const l = labels[i]!;
          const lx = x * (r + 12) + (x > 0.3 ? 0 : x < -0.3 ? -l.metrics.width : -l.metrics.width / 2);
          const ly = y * (r + 12) + (y > 0.3 ? l.metrics.height : y < -0.3 ? 0 : l.metrics.height / 2);
          const c = rgba(TEXT_COLOR.dim);
          p.text(l, lx, ly, 1, { base: c, accent: c, formula: c });
        }
      }
    })({ dir: 'stack', width: d + 190, height: d + 64, children: [mesh] });
    this.add(this.web);
    this.syncLegend();
  }

  /** Replace the whole set of series (e.g. the chemistries the user ticked); the legend follows. */
  setSeries(series: readonly RadarSeries[]): void {
    this.series = [...series];
    this.dirty = true;
    this.syncLegend();
  }

  /**
   * Replace a series' values; with `duration` (seconds) the polygon morphs from its current shape on the engine
   * clock, otherwise it jumps.
   */
  setValues(id: string, values: readonly number[], opts: { duration?: number } = {}): void {
    const from = this.series.find((s) => s.id === id)?.values ?? values.map(() => 0);
    const host = this.surface?.host;
    if (!opts.duration || !host || host.reducedMotion()) {
      this.series = this.series.map((s) => (s.id === id ? { ...s, values } : s));
      this.dirty = true;
      return;
    }
    const morph = { k: 0 };
    host.tweens.to(morph, { k: 1 }, {
      duration: opts.duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        const v = values.map((to, i) => (from[i] ?? 0) + (to - (from[i] ?? 0)) * morph.k);
        this.series = this.series.map((s) => (s.id === id ? { ...s, values: v } : s));
        this.dirty = true;
      },
    }); // prettier-ignore
  }

  private syncLegend(): void {
    this.legend?.detach();
    this.legend = null;
    if (this.cfg.legend === false) return;
    this.legend = new Legend({ items: this.series.map((s) => ({ label: s.label, color: s.color })), width: 'hug' });
    this.add(this.legend);
  }

  /** Emphasise one series (others dim); null restores all. */
  highlight(id: string | null): void {
    this.highlighted = id;
    this.dirty = true;
  }
}
