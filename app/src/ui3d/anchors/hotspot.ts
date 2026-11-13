/**
 * Hotspot marker — a pulsing ring on an object that opens a card (STYLE_GUIDE §6: affordance in `cyan`,
 * selected = `yellow`). Positioned every frame by `AnnotationLayer`.
 */
import { sfx } from '../core/focus';
import { lit, rgba, type Painter } from '../core/painter';
import { UI } from '../theme';
import { Control } from '../widgets/control';

export class HotspotMarker extends Control {
  /** Pulse phase 0…1 (advanced by the layer). */
  phase = 0;
  shown = 0;
  open = false;

  constructor(
    readonly title: string,
    private readonly pick: () => void,
  ) {
    super({ float: { ax: 0.5, ay: 0.5 }, width: UI.hit, height: UI.hit, opacity: 0 });
    this.lift = 0;
    this.on({ tooltip: title });
  }

  protected override activate(): void {
    sfx('open');
    this.pick();
  }

  override paint(p: Painter): void {
    const tone = rgba(this.open ? 'yellow' : 'cyan');
    const hov = this.hoverT;
    this.paintFocus(p, 34, 34, 17);
    // expanding ring
    const k = this.phase;
    p.arc(0, 0, 22 + 26 * k, 0, Math.PI * 2, 2.2, { fill: [tone[0], tone[1], tone[2], (1 - k) * 0.8] });
    p.circle(0, 0, 30, { fill: rgba('bg.void', 0.55) });
    p.circle(0, 0, 22 + 4 * hov, {
      fill: lit(tone, 1.25 + 0.3 * hov),
      border: rgba('white'),
      bw: 2.2,
      glow: 12,
      glowAlpha: 0.5,
    });
    p.icon(this.open ? 'close' : 'plus', 0, 0, 14, rgba('bg.void'));
  }
}
