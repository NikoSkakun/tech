/**
 * A holographic console standing in the world (UI_API §8): a glass panel with a title, a chart and optional
 * big readouts. Used where the document asks for a hologram next to the machine (the P(v) calculator of
 * step 2, the power curve at the tower foot in step 7, the year of wind over the farm in step 9) — and it
 * keeps the control dock short enough to fit beside the step text.
 */
import type { ChapterContext } from '@/engine/api';
import { Chart, Label, Panel, Readout, row, worldSurface, type ChartProps, type UiNode, type UiSurface } from '@/ui3d';

export interface ConsoleReadout {
  label: string;
  unit?: string;
  digits?: number;
  get: () => number;
}

export interface WorldConsole {
  surface: UiSurface;
  /** The chart, when the console has one. */
  chart: Chart;
  /** Poll the readouts (call every frame while visible). */
  update(): void;
}

export interface ConsoleOptions {
  title: string;
  /** Panel width in px-equivalent units. */
  width: number;
  /** World metres per px-equivalent. */
  unit: number;
  /** Omit for a console that only shows numbers (a tiny placeholder chart is created but not shown). */
  chart?: ChartProps;
  /** Shown in rows of three. */
  readouts?: readonly ConsoleReadout[];
  /** A second chart under the first one (same width). */
  extra?: UiNode;
}

export function buildConsole(ctx: ChapterContext, o: ConsoleOptions): WorldConsole {
  const chart = new Chart(o.chart ?? { height: 10, x: { min: 0, max: 1 }, y: { min: 0, max: 1 }, series: [] });
  const readouts = (o.readouts ?? []).map((r) => ({ spec: r, node: new Readout({ label: r.label, unit: r.unit, digits: r.digits ?? 1 }) }));
  const children: UiNode[] = [new Label(o.title, { font: 'display', size: 26 })];
  if (o.chart) children.push(chart);
  if (o.extra) children.push(o.extra);
  for (let i = 0; i < readouts.length; i += 3) children.push(row({ gap: 26 }, ...readouts.slice(i, i + 3).map((r) => r.node)));
  const panel = new Panel({ width: o.width, gap: 12, children });
  const surface = worldSurface(ctx, { width: o.width, height: 10, unit: o.unit, name: 'console' });
  surface.root.add(panel);
  return {
    surface,
    chart,
    update() {
      for (const r of readouts) r.node.value = r.spec.get();
    },
  };
}
