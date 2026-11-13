/**
 * Spectrum strip — the visible spectrum 380–750 nm with UV / IR margins as a world console; every emitted
 * photon lights a line at its wavelength (lines add up, repeated ones get brighter). Colours come from the
 * sim's `wavelengthToRgb`, so the strip, the photons and the readouts agree.
 */
import type { ChapterContext } from '@/engine/api';
import { wavelengthToRgb } from '@electricity/sim/atom';
import { Label, UiNode, rgba, worldSurface, type Painter, type Rgba, type UiSurface } from '@/ui3d';

const W = 640;
const H = 92;
const BAR_H = 34;
const MARGIN = 62; // UV / IR zones at the ends
const X0 = -W / 2 + 14 + MARGIN;
const X1 = W / 2 - 14 - MARGIN;
const xOf = (nm: number): number => X0 + ((nm - 380) / (750 - 380)) * (X1 - X0);

class StripNode extends UiNode {
  readonly lines = new Map<number, number>(); // rounded nm → hits
  constructor(labels: { uv: string; ir: string; title: string }) {
    super({ name: 'spectrum-strip', width: W, height: H, dir: 'stack' });
    const small = { font: 'mono', size: 14, color: 'mist', nowrap: true } as const;
    this.add(
      new Label(
        labels.title,
        { size: 14, color: 'steel', nowrap: true },
        { float: { ax: 0.5, ay: 0, py: 0, dy: 6 } },
      ),
    );
    this.add(
      new Label(
        labels.uv,
        { ...small, color: 'violet.light' },
        { float: { ax: 0, ay: 1, px: 0, py: 1, dx: 22, dy: -8 } },
      ),
    );
    this.add(
      new Label(
        labels.ir,
        { ...small, color: 'coral' },
        { float: { ax: 1, ay: 1, px: 1, py: 1, dx: -22, dy: -8 } },
      ),
    );
    for (const nm of [400, 500, 600, 700])
      this.add(
        new Label(String(nm), small, {
          float: { ax: 0, ay: 1, px: 0.5, py: 1, dx: xOf(nm) + W / 2, dy: -8 },
        }),
      );
  }
  override paint(p: Painter): void {
    p.panel(0, 0, this.bw, this.bh, {
      fill: rgba('bg.deep', 0.88),
      border: rgba('cyan', 0.45),
      bw: 1.5,
      r: 16,
    });
    const y = 4;
    // dim rainbow as the backdrop of the bar, dark UV / IR zones at its ends
    const slices = 74;
    for (let i = 0; i < slices; i++) {
      const nm = 380 + ((i + 0.5) / slices) * 370;
      const [r, g, b] = wavelengthToRgb(nm);
      p.rect(xOf(nm), y, (X1 - X0) / slices + 0.6, BAR_H, { fill: [r, g, b, 0.3] });
    }
    p.rect((X0 - W / 2 + 14) / 2 + 0, y, MARGIN, BAR_H, { fill: rgba('violet', 0.14) });
    p.rect((X1 + W / 2 - 14) / 2, y, MARGIN, BAR_H, { fill: rgba('red.dark', 0.22) });
    for (const [nm, hits] of this.lines) {
      const visible = nm >= 380 && nm <= 750;
      // invisible lines pile up in the margins, ordered by wavelength
      const x = visible
        ? xOf(nm)
        : nm < 380
          ? X0 - 10 - Math.min((380 - nm) / 6, MARGIN - 18)
          : X1 + 10 + Math.min((nm - 750) / 140, MARGIN - 18);
      const [r, g, b] = visible ? wavelengthToRgb(nm) : nm < 380 ? [0.75, 0.6, 1] : [0.8, 0.2, 0.25];
      const k = Math.min(1.2 + 0.5 * hits, 3);
      const c: Rgba = [r * k, g * k, b * k, 1];
      p.rect(x, y, visible ? 4 : 3, BAR_H + 8, {
        fill: c,
        glow: visible ? 10 : 4,
        glowAlpha: 0.7,
        border: c,
      });
    }
  }
}

export interface SpectrumStrip {
  surface: UiSurface;
  add(wavelengthNm: number): void;
  clear(): void;
  /** Number of distinct lines on the strip. */
  count(): number;
}

export function createSpectrumStrip(
  ctx: ChapterContext,
  labels: { uv: string; ir: string; title: string },
): SpectrumStrip {
  const surface = worldSurface(ctx, { width: W, height: H, unit: 0.0185, name: 'spectrum-strip' });
  const node = new StripNode(labels);
  surface.root.add(node);
  return {
    surface,
    add(nm) {
      const key = Math.round(nm);
      node.lines.set(key, (node.lines.get(key) ?? 0) + 1);
      node.repaint();
    },
    clear() {
      node.lines.clear();
      node.repaint();
    },
    count: () => node.lines.size,
  };
}
