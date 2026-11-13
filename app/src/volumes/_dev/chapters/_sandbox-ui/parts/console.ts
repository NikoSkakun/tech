import type { ChapterContext } from '@/engine/api';
import { Gauge, Label, Panel, STATUS, Slider, Toggle, type UiSurface, row, worldSurface } from '@/ui3d';

export interface WorldConsole {
  surface: UiSurface;
  /** Rotor speed set on the console, rpm. */
  speed(): number;
  running(): boolean;
  update(t: number): void;
}

/** A control console that lives in the world next to the machine it controls (same widgets as the HUD). */
export function createConsole(ctx: ChapterContext): WorldConsole {
  const surface = worldSurface(ctx, { width: 380, height: 300, unit: 0.0085, name: 'rotor-console' });
  const speed = new Slider({
    label: 'Оберти ротора n',
    min: 0,
    max: 3000,
    step: 100,
    unit: 'rpm',
    value: 1500,
    snaps: [3000],
  });
  const run = new Toggle({ label: 'Привід увімкнено', value: true });
  const freq = new Gauge({
    kind: 'linear',
    label: 'Частота f',
    min: 0,
    max: 50,
    unit: 'Hz',
    digits: 1,
    zones: [{ from: 49.5, to: 50, color: STATUS.ok }],
  });
  surface.root.add(
    new Panel({
      width: 380,
      gap: 12,
      pad: [18, 20],
      children: [
        row({ gap: 8 }, new Label('Консоль генератора', { font: 'display', size: 22 })),
        speed,
        freq,
        run,
      ],
    }),
  );
  return {
    surface,
    speed: () => (run.value ? speed.value : 0),
    running: () => run.value,
    // one pole pair: f = n / 60
    update: () => freq.setNow(run.value ? speed.value / 60 : 0),
  };
}
