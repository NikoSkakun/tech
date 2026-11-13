/**
 * Painted pieces of the touch shells: the sheet's plate (rounded only where it meets the scene), the grip
 * (drag handle) and the reopen tab of a collapsed side sheet.
 */
import { UiNode, accentOf, rgba, type NodeProps, type Painter } from '@/ui3d';

/** How far a plate continues past the screen edge it is attached to, so its rounded corners never show. */
const OVERHANG = 60;

/**
 * Background of a sheet. `edge` is the screen edge it grows from: `bottom` (portrait sheet: rounded top) or
 * `right` (landscape side sheet: rounded left).
 */
export class SheetPlate extends UiNode {
  constructor(
    public edge: 'bottom' | 'right',
    props: NodeProps = {},
  ) {
    super(props);
  }

  override paint(p: Painter): void {
    const accent = accentOf(this);
    const w = this.bw + (this.edge === 'right' ? OVERHANG : 0);
    const h = this.bh + (this.edge === 'bottom' ? OVERHANG : 0);
    const cx = this.edge === 'right' ? OVERHANG / 2 : 0;
    const cy = this.edge === 'bottom' ? -OVERHANG / 2 : 0;
    // the hologlass body with the accent hairline (STYLE_GUIDE §6). No separate dark halo as the desktop
    // panels have: on a phone the sheet covers half the screen, and every screen-sized layer costs fill rate.
    p.panel(cx, cy, w, h, {
      r: 22,
      // nearly opaque: a sheet is read over a bright scene for minutes (blending is in linear light, where
      // the panels' 0.985 still lets a white diorama ghost through)
      fill: rgba('bg.indigo', 0.997),
      fill2: rgba('bg.void', 1),
      border: rgba(accent, 0.6),
      bw: 1.5,
      glow: 14,
      glowAlpha: 0.22,
    });
  }
}

/** The drag handle: a short pill. `vertical` for the side sheet's left edge. */
export class Grip extends UiNode {
  /** 0…1, brighter while the sheet is being dragged. */
  hot = 0;

  constructor(
    private readonly vertical: boolean,
    props: NodeProps = {},
  ) {
    super(props);
  }

  override paint(p: Painter): void {
    const accent = accentOf(this);
    const a = 0.45 + 0.5 * this.hot;
    if (this.vertical) p.rect(0, 0, 5, 44, { r: 2.5, fill: rgba(accent, a) });
    else p.rect(0, 1, 44, 5, { r: 2.5, fill: rgba(accent, a) });
  }
}
