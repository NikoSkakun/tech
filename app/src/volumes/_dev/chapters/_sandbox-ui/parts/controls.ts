import { Button, Chip, Label, Panel, Slider, Tabs, Toggle, type UiNode, honesty, row } from '@/ui3d';

/** Buttons, sliders (log scale, snaps, marks), toggle, segmented tabs, chips. */
export function controlsDemo(): UiNode {
  const value = new Label('Опір: **10 Ω**', { size: 19 });
  const disabled = new Button({ label: 'Недоступно', icon: 'lock' });
  disabled.disabled = true;
  return new Panel({
    width: 460,
    gap: 16,
    children: [
      new Label('Керування', { font: 'display', size: 36 }),
      new Label(
        '**AC** (alternating current) — _змінний_ струм: `U = I·R`, заряд `−1,602×10^{-19} C`, 230 V, 50 Hz.',
        { size: 19 },
      ),
      new Slider({
        label: 'Опір R',
        min: 0.05,
        max: 1000,
        scale: 'log',
        step: 3,
        unit: 'Ω',
        value: 10,
        onChange: (v) => (value.text = `Опір: **${v} Ω**`),
      }),
      new Slider({
        label: 'Освітленість G',
        min: 0,
        max: 1200,
        step: 50,
        unit: 'W/m²',
        value: 1000,
        snaps: [1000],
        marks: [
          { value: 0, label: '0' },
          { value: 1000, label: 'STC' },
        ],
      }),
      new Toggle({ label: 'Справжні пропорції' }),
      new Tabs({
        items: [
          { id: 'a', label: 'Горошина / стадіон' },
          { id: 'b', label: 'М’яч / місто' },
        ],
      }),
      new Tabs({
        items: ['H', 'He', 'Li', 'C', 'Fe', 'Cu', 'U'].map((id) => ({ id, label: id })),
        value: 'Cu',
      }),
      row(
        { gap: 10 },
        new Button({ label: 'Почати', variant: 'primary', icon: 'play' }),
        new Button({ label: 'Скинути', icon: 'resetView' }),
        new Button({ icon: 'help', tooltip: 'Довідка' }),
        disabled,
      ),
      row(
        { gap: 8, wrap: true, width: 'fill' },
        new Chip({ kind: 'term', text: 'електрон', onClick: () => undefined }),
        new Chip({ kind: 'scale', text: '10⁻¹⁰ m' }),
        honesty.slowed(1000),
        honesty.notToScale(),
        honesty.simplified(),
      ),
      new Chip({
        kind: 'fact',
        text: 'В 1 cm³ міді — `8,5×10²²` атомів: рахувати по одному щосекунди довелося б у 200 000 разів довше, ніж існує Всесвіт.',
        maxWidth: 380,
      }),
      value,
    ],
  });
}
