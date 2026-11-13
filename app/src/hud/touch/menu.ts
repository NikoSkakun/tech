/**
 * The menu of the touch shells: on a phone or tablet the row of system buttons collapses into the map button
 * and this one menu (glossary, sound, fullscreen where the browser has it, settings, help, library).
 */
import { Button, UI, UiNode, type IconName } from '@/ui3d';
import type { OverlayName } from '../context';
import { createModal } from '../overlays/modal';
import type { Hud, Overlay } from '../shell';

const WIDTH = 560;

export function createMenu(hud: Hud): Overlay {
  const { store } = hud.engine;
  return createModal(hud, {
    title: 'Меню',
    icon: 'menu',
    width: WIDTH,
    fresh: true, // sound state, fullscreen availability and the library level may have changed
    build(body) {
      // one column on a phone held upright, two where there is room (landscape, tablets)
      const m = hud.metrics;
      const inner = Math.min(WIDTH, m.width - m.safeMargin * 2) - UI.pad.panel * 2;
      const width = inner >= 440 ? (inner - 10) / 2 : inner;
      const item = (name: string, icon: IconName, label: string, onClick: () => void): Button =>
        new Button({ name, icon, label, size: 'md', width, justify: 'start', onClick });
      const go = (overlay: OverlayName) => (): void => hud.open(overlay);
      const audio = store.get().settings.audio;
      const sound = item('menu-sound', audio ? 'soundOn' : 'soundOff', audio ? 'Звук: увімкнено' : 'Звук: вимкнено', () => {
        const on = !store.get().settings.audio;
        store.updateSettings({ audio: on });
        sound.icon = on ? 'soundOn' : 'soundOff';
        sound.label = on ? 'Звук: увімкнено' : 'Звук: вимкнено';
      });
      const rows: (Button | null)[] = [
        hud.libraryLevel ? item('menu-library', 'book', 'Бібліотека', go('library')) : null,
        item('menu-map', 'map', 'Мапа подорожі', go('map')),
        item('menu-glossary', 'glossary', 'Глосарій', go('glossary')),
        sound,
        hud.engine.canFullscreen
          ? item('menu-fullscreen', 'fullscreen', 'На весь екран', () => {
              hud.close();
              hud.engine.toggleFullscreen();
            })
          : null,
        item('menu-settings', 'settings', 'Налаштування', go('settings')),
        item('menu-help', 'help', 'Довідка', go('help')),
        item('menu-home', 'home', 'Титульний екран', go('home')),
      ];
      body.add(
        new UiNode({
          dir: 'row',
          wrap: true,
          gap: 10,
          width: 'fill',
          children: rows.filter((r): r is Button => r !== null),
        }),
      );
    },
  });
}
