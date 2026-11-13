/**
 * Screen-space labels of the Journey Map: chapter titles with scale and progress under (or above) their
 * platforms, and the scale ruler's decade labels. Projected from map space every frame — constant size,
 * crisp, on a dark plate so they read over the glowing path.
 */
import { Label, TEXT_COLOR, UI, UiNode, rgba, type Painter } from '@/ui3d';
import type { MapCamera } from './camera';
import type { MapLayout, MapNode } from './layout';

class NodeLabel extends UiNode {
  readonly progress: Label;
  constructor(readonly node: MapNode) {
    super({
      dir: 'col',
      align: 'center',
      gap: 0,
      pad: [5, 10, 6, 10],
      float: { ax: 0.5, ay: 0.5 },
      opacity: 0,
    });
    const child = node.parent >= 0;
    this.progress = new Label(
      '',
      {
        font: 'mono',
        size: UI.text.caption,
        color: TEXT_COLOR.mute,
        nowrap: true,
        align: 'center',
        reserve: 22,
        stable: true,
      },
      { width: 150, height: 19 },
    );
    this.add(
      new Label(node.chapter.title, {
        font: 'bodyBold',
        size: child ? UI.text.caption : UI.text.small,
        align: 'center',
        maxWidth: child ? 170 : 200,
        lineHeight: 1.22,
      }),
      this.progress,
    );
  }
  override paint(p: Painter): void {
    const tone = rgba(this.node.chapter.accent);
    p.rect(0, 0, this.bw, this.bh, {
      r: 12,
      fill: rgba('bg.void', 0.8),
      border: [tone[0], tone[1], tone[2], 0.45],
      bw: 1,
    });
  }
}

export class MapLabels extends UiNode {
  private readonly labels: NodeLabel[];
  private readonly ticks: { node: Label; exp: number }[] = [];
  private readonly out = { x: 0, y: 0, visible: false, scale: 1 };

  constructor(
    private readonly layout: MapLayout,
    private readonly rulerX: number,
  ) {
    super({ dir: 'stack', width: 'fill', height: 'fill' });
    this.labels = layout.nodes.map((n) => new NodeLabel(n));
    for (const l of this.labels) this.add(l);
    for (const { value: e } of layout.ticks.filter((t) => t.major)) {
      const node = new Label(
        layout.axis.format(e),
        { font: 'mono', size: UI.text.caption, color: TEXT_COLOR.dim, nowrap: true },
        { float: { ax: 0.5, ay: 0.5, px: 1, py: 0.5 }, opacity: 0 },
      );
      this.ticks.push({ node, exp: e });
      this.add(node);
    }
  }

  /** Progress text under a chapter title, e.g. `10⁻¹⁰ m · 3/10`. */
  setProgress(index: number, done: number, total: number): void {
    const n = this.layout.nodes[index]!;
    const scale = n.chapter.axisLabel.length <= 12 ? `${n.chapter.axisLabel} · ` : '';
    this.labels[index]!.progress.text = `${scale}${done}/${total}`;
  }

  /**
   * Per-frame placement. `focus` = index of the node the camera is centred on (−1 in the overview),
   * `amount` = overall opacity (0 hides everything, e.g. on the home screen).
   */
  update(camera: MapCamera, focus: number, amount: number, dt: number): void {
    const k = 1 - Math.exp(-10 * dt);
    const o = this.out;
    const focused = focus >= 0 ? this.layout.nodes[focus]! : null;
    const family = focused ? (focused.parent >= 0 ? focused.parent : focused.index) : -1;
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const label of this.labels) {
      const n = label.node;
      const child = n.parent >= 0;
      // main-path titles sit above their platforms, satellites are named below (while their family is in focus)
      camera.project(n.x, n.y + (child ? -n.radius * 0.9 : n.radius * 2.2), n.z, o);
      let want = amount;
      if (child) want *= n.parent === family ? 1 : 0;
      else if (focused) want *= n.index === family ? 1 : 0.6;
      if (n.index === focus) want = 0; // the card names the focused chapter
      if (!o.visible) want = 0;
      let y = o.y + (child ? -1 : 1) * (label.bh / 2 + 8);
      if (want > 0.01 && label.bw > 0) {
        // greedy collision avoidance in journey order: slide away from the platform until the plate is free
        const hw = label.bw / 2 + 5;
        const hh = label.bh / 2 + 4;
        const dir = child ? -1 : 1;
        for (let tries = 0; tries < 9; tries++) {
          const hit = placed.some(
            (r) => o.x - hw < r.x1 && o.x + hw > r.x0 && y - hh < r.y1 && y + hh > r.y0,
          );
          if (!hit) break;
          y += dir * 16;
        }
        placed.push({ x0: o.x - hw, x1: o.x + hw, y0: y - hh, y1: y + hh });
      }
      label.x = o.x;
      // ease the vertical slot so labels do not jump when neighbours start to overlap during travel
      label.y = dt > 0 && label.opacity > 0.05 ? label.y + (y - label.y) * k : y;
      label.opacity += (want - label.opacity) * (dt > 0 ? k : 1);
    }
    const rz = this.layout.spine[0]!.z;
    for (const t of this.ticks) {
      camera.project(this.rulerX - 14, this.layout.height(t.exp), rz, o);
      t.node.x = o.x;
      t.node.y = o.y;
      const want = o.visible ? amount : 0;
      t.node.opacity += (want - t.node.opacity) * (dt > 0 ? k : 1);
    }
  }
}
