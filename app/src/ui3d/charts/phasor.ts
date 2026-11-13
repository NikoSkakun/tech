/**
 * PhasorScope — a phasor diagram linked to an oscilloscope strip: arrows rotate on the left, and each arrow's
 * vertical projection draws its sine wave on the right; a dashed line ties every arrow tip to the head of its
 * trace. Drive it with `setAngle(ωt)` every frame (slow it down and say so with an honesty chip).
 */
import { fontData, layoutText } from '@/text';
import type { ColorLike } from '@/style';
import { UiNode, type NodeProps } from '../core/node';
import { lit, rgba, type Painter } from '../core/painter';
import { MeshNode } from '../core/surface';
import { TEXT_COLOR, UI } from '../theme';
import { Legend } from '../widgets/legend';
import { PlotMesh } from './plot';

export interface Phasor {
  id: string;
  label: string;
  color: ColorLike;
  /** Length relative to the circle radius, 0…1. */
  amplitude: number;
  /** Phase shift in radians (positive = leading). */
  phase: number;
}

export interface PhasorProps extends NodeProps {
  phasors: readonly Phasor[];
  /** Diameter of the phasor circle. Default 170. */
  size?: number;
  /** Periods shown on the strip. Default 1.5. */
  periods?: number;
}

const SAMPLES = 96;

export class PhasorScope extends UiNode {
  private angle = 0;
  private phasors: Phasor[];
  private readonly plot = new PlotMesh();
  private readonly dial: UiNode;
  private readonly d: number;

  constructor(private readonly cfg: PhasorProps) {
    super({ dir: 'col', gap: 8, width: 'fill', ...cfg, children: [] });
    this.phasors = [...cfg.phasors];
    this.d = cfg.size ?? 170;
    const mesh = new MeshNode(this.plot, { float: { ax: 0.5, ay: 0.5 }, width: 'fill', height: 'fill' });
    mesh.onPlace = (opacity) => {
      this.plot.opacity = opacity;
      this.build();
    };
    const paint = (p: Painter): void => this.paintDial(p);
    this.dial = new (class extends UiNode {
      override paint(p: Painter): void {
        paint(p);
      }
    })({ dir: 'stack', width: 'fill', height: this.d + 16, children: [mesh] });
    this.add(this.dial, new Legend({ items: this.phasors.map((f) => ({ label: f.label, color: f.color })) }));
  }

  /** Rotation angle ωt in radians. */
  setAngle(angle: number): void {
    this.angle = angle;
    this.dial.repaint();
  }

  /** Change a phasor's amplitude / phase (e.g. the current lagging more as the load turns inductive). */
  setPhasor(id: string, patch: Partial<Pick<Phasor, 'amplitude' | 'phase'>>): void {
    this.phasors = this.phasors.map((f) => (f.id === id ? { ...f, ...patch } : f));
    this.dial.repaint();
  }

  private geometry(): { cx: number; r: number; x0: number; x1: number } {
    const r = this.d / 2;
    const cx = -this.dial.bw / 2 + r + 8;
    return { cx, r, x0: cx + r + 26, x1: this.dial.bw / 2 - 8 };
  }

  /** Traces: the strip scrolls so that "now" is at its left edge, next to the dial. */
  private build(): void {
    const g = this.geometry();
    const span = (this.cfg.periods ?? 1.5) * Math.PI * 2;
    this.plot.begin();
    const pts = new Float32Array(SAMPLES * 2);
    for (const f of this.phasors) {
      for (let i = 0; i < SAMPLES; i++) {
        const k = i / (SAMPLES - 1);
        pts[i * 2] = g.x0 + (g.x1 - g.x0) * k;
        pts[i * 2 + 1] = Math.sin(this.angle + f.phase - span * k) * g.r * f.amplitude;
      }
      this.plot.line(pts, SAMPLES, 2.4, lit(rgba(f.color), 1.2));
    }
    this.plot.end();
  }

  private paintDial(p: Painter): void {
    const g = this.geometry();
    const grid = rgba('slate', 0.6);
    p.arc(g.cx, 0, this.d, 0, Math.PI * 2, 1.4, { fill: grid });
    p.line(g.cx - g.r, 0, g.cx + g.r, 0, 1, { fill: rgba('slate', 0.4) });
    p.line(g.cx, -g.r, g.cx, g.r, 1, { fill: rgba('slate', 0.4) });
    p.rect((g.x0 + g.x1) / 2, 0, g.x1 - g.x0 + 12, this.d + 8, {
      r: UI.radius.inset,
      fill: rgba('bg.void', 0.55),
      border: grid,
      bw: 1,
    });
    p.line(g.x0, 0, g.x1, 0, 1, { fill: rgba('slate', 0.5) });
    for (const f of this.phasors) {
      const c = lit(rgba(f.color), 1.25);
      const a = this.angle + f.phase;
      const x = g.cx + Math.cos(a) * g.r * f.amplitude;
      const y = Math.sin(a) * g.r * f.amplitude;
      p.line(g.cx, 0, x, y, 3.2, { fill: c, border: c, glow: 5, glowAlpha: 0.3 });
      // arrow head: two short strokes back from the tip
      for (const side of [-1, 1])
        p.line(x, y, x - Math.cos(a + side * 0.45) * 11, y - Math.sin(a + side * 0.45) * 11, 3, { fill: c });
      // the projection: tip → head of the trace
      p.rect((x + g.x0) / 2, y, Math.abs(g.x0 - x), 1.3, { fill: [c[0], c[1], c[2], 0.7], dash: 7 });
      p.circle(g.x0, y, 8, { fill: rgba('white'), border: c, bw: 2.4 });
    }
    p.circle(g.cx, 0, 7, { fill: rgba('white') });
    const l = layoutText(
      't',
      { font: 'mono', size: UI.text.caption, anchorX: 'left', anchorY: 'top' },
      fontData(),
    );
    const tone = rgba(TEXT_COLOR.mute);
    p.text(l, g.x1 - 12, -g.r + 2, 1, { base: tone, accent: tone, formula: tone });
  }
}
