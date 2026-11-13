/**
 * Legend — colour keys for charts and colour-coded scenes: a swatch (dot, line or dashed line) and a label.
 */
import type { ColorLike } from '@/style';
import { UiNode, type NodeProps } from '../core/node';
import { lit, rgba, type Painter } from '../core/painter';
import { TEXT_COLOR, UI } from '../theme';
import { Label } from './label';

export interface LegendItem {
  label: string;
  color: ColorLike;
  swatch?: 'dot' | 'line' | 'dash' | 'box';
}

class Swatch extends UiNode {
  constructor(private readonly item: LegendItem) {
    super({ width: item.swatch === 'dot' || item.swatch === 'box' ? 14 : 24, height: 16 });
  }
  override paint(p: Painter): void {
    const c = lit(rgba(this.item.color), 1.15);
    const kind = this.item.swatch ?? 'line';
    if (kind === 'dot') p.circle(0, 0, 11, { fill: c });
    else if (kind === 'box') p.rect(0, 0, 12, 12, { r: 3, fill: c });
    else p.rect(0, 0, this.bw, 3.5, { r: 1.75, fill: c, dash: kind === 'dash' ? 8 : 0 });
  }
}

export interface LegendProps extends NodeProps {
  items: readonly LegendItem[];
  /** `row` wraps; `col` lists. Default `row`. */
  flow?: 'row' | 'col';
}

export class Legend extends UiNode {
  constructor(props: LegendProps) {
    super(
      props.flow === 'col'
        ? { dir: 'col', gap: 4, ...props }
        : { dir: 'row', wrap: true, gap: 14, width: 'fill', align: 'center', ...props },
    );
    for (const item of props.items) {
      this.add(
        new UiNode({
          dir: 'row',
          align: 'center',
          gap: 6,
          children: [
            new Swatch(item),
            new Label(item.label, { size: UI.text.caption, color: TEXT_COLOR.dim, nowrap: true }),
          ],
        }),
      );
    }
  }
}
