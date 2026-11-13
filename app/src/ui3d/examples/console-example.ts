/**
 * docs/UI_API.md example 2 — a console that lives in the world next to a machine, built from the same widgets.
 */
import type { ChapterContext } from '@/engine/api';
import { Gauge, Label, Panel, STATUS, Slider, Toggle, worldSurface, type UiSurface } from '@/ui3d';

export function turbineConsole(
  ctx: ChapterContext,
  onSpeed: (rpm: number) => void,
): { surface: UiSurface; update(powerMW: number): void } {
  // 360 × 260 px-eq panel, 1 unit = 1 cm in a scene measured in metres
  const surface = worldSurface(ctx, { width: 360, height: 260, unit: 0.01 });
  const power = new Gauge({
    kind: 'linear',
    label: 'Потужність P',
    min: 0,
    max: 5,
    unit: 'MW',
    digits: 2,
    zones: [{ from: 4.5, to: 5, color: STATUS.warning }],
  });
  surface.root.add(
    new Panel({
      width: 360,
      gap: 12,
      children: [
        new Label('Вітрова турбіна', { font: 'display', size: 22 }),
        new Slider({
          label: 'Оберти ротора',
          min: 0,
          max: 16,
          step: 0.5,
          unit: 'rpm',
          value: 12,
          onChange: onSpeed,
        }),
        power,
        new Toggle({ label: 'Гальмо', onChange: (on) => onSpeed(on ? 0 : 12) }),
      ],
    }),
  );
  surface.position.set(3, 1.2, 0);
  surface.rotation.y = -0.4;
  ctx.root.add(surface); // disposed with the chapter
  return { surface, update: (mw) => power.setNow(mw) };
}
