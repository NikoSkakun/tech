/**
 * Tooltip layer: shows the name of the hovered interactive object — world objects registered with
 * `ctx.input.register(…, { tooltip })` and UI controls alike — next to the pointer, after a short delay.
 */
import type { Tween } from '@/engine/api';
import { Tooltip, type UiNode } from '@/ui3d';
import type { HudContext } from './context';

export function mountTooltips(hud: HudContext, parent: UiNode): void {
  const tip = new Tooltip();
  tip.name = 'tooltip'; // QA: `__ui.locate('tooltip')` is non-null while a tooltip shows
  parent.add(tip);
  let pending: Tween | null = null;
  let visible = false;
  /** Engine time until which a long-press tooltip stays although the finger has left. */
  let lingerOff: Tween | null = null;
  hud.engine.input.on('hover', ({ object, tooltip: name, x, y, longPress, pointerType }) => {
    // a finger has no hover: a touch shows the name only when it has rested on the object (long press)
    const tooltip = pointerType !== undefined && pointerType !== 'mouse' && !longPress ? null : name;
    pending?.kill();
    pending = null;
    if (!tooltip) {
      // shown by a long press: the finger lifting (`object` null) does not hide it — it goes by itself, or
      // with the next touch on anything
      if (lingerOff && object === null) return;
      lingerOff?.kill();
      lingerOff = null;
      if (visible) tip.hide();
      visible = false;
      return;
    }
    lingerOff?.kill();
    lingerOff = null;
    const show = (): void => {
      const m = hud.metrics;
      tip.showAt(
        tooltip,
        (x - m.cssWidth / 2) / m.pxPerUnit,
        (m.cssHeight / 2 - y) / m.pxPerUnit,
        { hw: m.width / 2, hh: m.height / 2 },
        longPress ? 'touch' : 'pointer',
      );
      visible = true;
    };
    if (longPress) {
      // touch: the finger has already waited; the bubble stays readable after the finger lifts
      show();
      lingerOff = hud.surface.host.tweens.delay(2.2, () => {
        lingerOff = null;
        if (visible) tip.hide();
        visible = false;
      });
      return;
    }
    // moving from one named object straight to another: no delay
    if (visible) show();
    else pending = hud.surface.host.tweens.delay(0.32, show);
  });
  hud.engine.input.on('background', () => {
    pending?.kill();
    lingerOff?.kill();
    lingerOff = null;
    if (visible) tip.hide();
    visible = false;
  });
}
