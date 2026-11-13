/**
 * Tooltip layer: shows the name of the hovered interactive object — world objects registered with
 * `ctx.input.register(…, { tooltip })` and UI controls alike — next to the pointer, after a short delay.
 */
import type { Tween } from '@/engine/api';
import { Tooltip, type UiNode } from '@/ui3d';
import type { HudContext } from './context';

export function mountTooltips(hud: HudContext, parent: UiNode): void {
  const tip = new Tooltip();
  parent.add(tip);
  let pending: Tween | null = null;
  let visible = false;
  hud.engine.input.on('hover', ({ tooltip, x, y }) => {
    pending?.kill();
    pending = null;
    if (!tooltip) {
      if (visible) tip.hide();
      visible = false;
      return;
    }
    const show = (): void => {
      const m = hud.metrics;
      tip.showAt(tooltip, (x - m.cssWidth / 2) / m.pxPerUnit, (m.cssHeight / 2 - y) / m.pxPerUnit, {
        hw: m.width / 2,
        hh: m.height / 2,
      });
      visible = true;
    };
    // moving from one named object straight to another: no delay
    if (visible) show();
    else pending = hud.surface.host.tweens.delay(0.32, show);
  });
  hud.engine.input.on('background', () => {
    pending?.kill();
    if (visible) tip.hide();
    visible = false;
  });
}
