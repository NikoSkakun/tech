/**
 * Holographic ring gauge floating in the world (SOC, SOH): a `ProgressRing` of the UI kit on a small overlay
 * surface, so it is always crisp and reads like the rest of the interface.
 */
import type { ChapterContext } from '@/engine/api';
import { fmtPercent } from '@/content';
import { Label, ProgressRing, UiNode, worldSurface, type UiSurface } from '@/ui3d';
import type { ColorLike } from '@/style';

export interface RingGauge {
  surface: UiSurface;
  /** 0…1; redraws only when the picture changes. */
  set(value: number): void;
}

/** `size` = ring diameter in world units; `caption` is drawn under the ring. */
export function createRingGauge(
  ctx: ChapterContext,
  o: { size: number; caption?: string; accent?: ColorLike; digits?: number },
): RingGauge {
  const px = 150;
  const height = px + (o.caption ? 34 : 0);
  const surface = worldSurface(ctx, { width: px + 40, height, unit: o.size / px, name: 'ring-gauge' });
  const ring = new ProgressRing({ size: px, thickness: 15, accent: o.accent ?? 'lime', label: '' });
  const children: UiNode[] = [ring];
  if (o.caption)
    children.push(new Label(o.caption, { font: 'bodyBold', size: 22, color: 'white', nowrap: true }));
  surface.root.add(new UiNode({ dir: 'col', align: 'center', gap: 6, width: px + 40, height, children }));
  let last = -1;
  return {
    surface,
    set(value) {
      const v = Math.min(Math.max(value, 0), 1);
      if (Math.abs(v - last) < 0.002) return;
      last = v;
      ring.t = v;
      ring.label = fmtPercent(v, o.digits ?? 0);
      ring.repaint();
    },
  };
}
