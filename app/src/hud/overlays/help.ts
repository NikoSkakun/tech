/**
 * Help overlay: how to control the course with a mouse, by touch and from the keyboard.
 */
import { Icon, Label, Panel, TEXT_COLOR, UI, UiNode, rgba, type IconName, type Painter } from '@/ui3d';
import type { Hud, Overlay } from '../shell';
import { createModal } from './modal';

class KeyCap extends UiNode {
  constructor(text: string) {
    super({ pad: [3, 9], minW: 34, align: 'center', dir: 'col' });
    this.add(new Label(text, { font: 'mono', size: UI.text.caption, nowrap: true, align: 'center' }));
  }
  override paint(p: Painter): void {
    p.rect(0, -1.5, this.bw, this.bh, { r: 7, fill: rgba('slate', 0.9) });
    p.rect(0, 1, this.bw, this.bh - 3, { r: 7, fill: rgba('bg.indigo'), border: rgba('mist', 0.5), bw: 1 });
  }
}

function line(keys: readonly string[], text: string): UiNode {
  return new UiNode({
    dir: 'row',
    align: 'center',
    gap: 10,
    width: 'fill',
    children: [
      new UiNode({ dir: 'row', gap: 4, width: 112, wrap: true, children: keys.map((k) => new KeyCap(k)) }),
      new Label(text, { size: UI.text.small, color: TEXT_COLOR.dim, lineHeight: 1.3 }, { width: 'fill' }),
    ],
  });
}

function section(
  icon: IconName,
  title: string,
  rows: readonly (readonly [readonly string[], string])[],
): UiNode {
  return new Panel({
    variant: 'inset',
    width: 'fill',
    gap: 10,
    pad: [14, 16],
    blocks: false,
    children: [
      new UiNode({
        dir: 'row',
        align: 'center',
        gap: 10,
        children: [
          new Icon(icon, 24, 'cyan'),
          new Label(title, { font: 'display', size: UI.text.h3, nowrap: true }),
        ],
      }),
      ...rows.map(([k, t]) => line(k, t)),
    ],
  });
}

export function createHelp(hud: Hud): Overlay {
  return createModal(hud, {
    title: 'Керування',
    icon: 'help',
    width: 1040,
    build(body) {
      const cols = new UiNode({ dir: 'row', gap: 14, wrap: true, width: 'fill', align: 'start' });
      const wide = hud.metrics.width > 1100;
      const w = wide ? 318 : 'fill';
      const mouse = section('mouse', 'Миша', [
        [['тягнути'], 'обертати сцену навколо об’єкта'],
        [['колесо'], 'наблизити або віддалити'],
        [['клац'], 'кнопки, гарячі точки, об’єкти з блакитним контуром'],
        [['навести'], 'назва об’єкта у підказці'],
      ]);
      const touch = section('touch', 'Дотик', [
        [['1 палець'], 'обертати сцену, тягнути повзунки'],
        [['2 пальці'], 'масштаб (щипок) і зсув'],
        [['дотик'], 'кнопки й гарячі точки'],
      ]);
      const keys = section('keyboard', 'Клавіатура', [
        [['←', '→'], 'попередній і наступний крок'],
        [['Home', 'End'], 'перший і останній крок розділу'],
        [['M'], 'мапа подорожі'],
        [['F'], 'на весь екран'],
        [['Tab'], 'перейти до наступного елемента керування'],
        [['Enter'], 'натиснути вибраний елемент'],
        [['Esc'], 'закрити вікно або зняти вибір'],
      ]);
      for (const s of [mouse, touch, keys]) {
        s.width = w;
        cols.add(s);
      }
      body.add(
        cols,
        new Label(
          'На мапі подорожі: тягніть, щоб мандрувати шляхом, колесо змінює масштаб, ← → обирають сусідні розділи, ↓ ↑ — типи станцій і лабораторії, Enter відкриває розділ.',
          { size: UI.text.small, color: TEXT_COLOR.dim, lineHeight: 1.4 },
          { width: 'fill' },
        ),
      );
    },
  });
}
