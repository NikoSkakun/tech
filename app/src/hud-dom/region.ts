/**
 * Camera insets from DOM boxes. A DOM region owns an invisible "phantom" `UiNode` whose box mirrors the
 * element's border box (CSS px → HUD units); mounted through `Hud.mount(…, { side })`, it is measured by the
 * shell's existing inset code exactly like a WebGL region. The box is refreshed by a `ResizeObserver` (size)
 * and on every HUD layout (position), so the camera director keeps today's framing.
 *
 * (Spike bridge: once every region is DOM, `hud-dom/insets.ts` reports the rectangles directly — HUD_DOM.md §6.)
 */
import { Vector3 } from 'three';
import { UiNode } from '@/ui3d';
import type { Hud } from '@/hud/shell';

export class DomRegion {
  /** Invisible stand-in in the WebGL HUD tree; paints nothing and takes no input. */
  readonly node = new UiNode({ name: '', width: 0, height: 0, float: { ax: 0, ay: 0, px: 0, py: 0 } });
  private readonly observer: ResizeObserver;
  private last = '';

  constructor(
    private readonly hud: Hud,
    readonly el: HTMLElement,
  ) {
    this.observer = new ResizeObserver(() => this.sync());
    this.observer.observe(el);
  }

  /** Copy the element's box (layout box, ignores transforms of reveal tweens) into the phantom node. */
  sync(): void {
    const k = this.hud.metrics.pxPerUnit;
    const shown = this.el.isConnected && this.el.offsetParent !== null;
    const x = this.el.offsetLeft / k;
    const y = this.el.offsetTop / k;
    const w = shown ? this.el.offsetWidth / k : 0;
    const h = shown ? this.el.offsetHeight / k : 0;
    const key = `${x.toFixed(1)},${y.toFixed(1)},${w.toFixed(1)},${h.toFixed(1)}`;
    if (key === this.last) return;
    this.last = key;
    this.node.width = w;
    this.node.height = h;
    this.node.visible = shown;
    this.node.float = { ax: 0, ay: 0, px: 0, py: 0, dx: x, dy: y };
    this.hud.relayout();
  }

  dispose(): void {
    this.observer.disconnect();
  }
}

const _v = new Vector3();

/** CSS-px rectangle of a WebGL HUD node (top-left + size), from its world matrix — as `__ui.locate` does. */
export function nodeRect(hud: Hud, n: UiNode): { x: number; y: number; w: number; h: number } {
  const m = hud.metrics;
  const w = n.world;
  _v.set(w[3]!, w[7]!, w[11]!).applyMatrix4(hud.surface.matrixWorld).project(hud.engine.hud.camera);
  const cx = (_v.x * 0.5 + 0.5) * m.cssWidth;
  const cy = (0.5 - _v.y * 0.5) * m.cssHeight;
  const bw = n.bw * Math.abs(w[0]!) * m.pxPerUnit;
  const bh = n.bh * Math.abs(w[5]!) * m.pxPerUnit;
  return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
}
