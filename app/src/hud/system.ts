/**
 * System buttons (top-right): journey map, glossary, sound, fullscreen, settings, help.
 */
import { Button, UiNode } from '@/ui3d';
import type { HudContext, HudModule } from './context';

export function createSystemButtons(hud: HudContext): HudModule {
  const { store } = hud.engine;
  const sound = new Button({
    name: 'sys-sound',
    icon: 'soundOn',
    variant: 'icon',
    tooltip: 'Звук',
    onClick: () => store.updateSettings({ audio: !store.get().settings.audio }),
  });
  const full = new Button({
    icon: 'fullscreen',
    variant: 'icon',
    tooltip: 'На весь екран (F)',
    onClick: () => hud.engine.toggleFullscreen(),
  });
  // the way up to the library: present only while the library level is shown (more than one volume)
  const libraryButton = new Button({
    name: 'sys-library',
    icon: 'book',
    label: 'Бібліотека',
    tooltip: 'Усі томи (L)',
    visible: false,
    onClick: () => hud.open('library'),
  });
  const node = new UiNode({
    dir: 'row',
    gap: 8,
    align: 'center',
    float: { ax: 1, ay: 0 },
    children: [
      libraryButton,
      new Button({
        name: 'sys-map',
        icon: 'map',
        label: 'Мапа',
        tooltip: 'Мапа подорожі (M)',
        onClick: () => hud.open('map'),
      }),
      new Button({
        name: 'sys-glossary',
        icon: 'glossary',
        variant: 'icon',
        tooltip: 'Глосарій',
        onClick: () => hud.open('glossary'),
      }),
      sound,
      full,
      new Button({
        name: 'sys-settings',
        icon: 'settings',
        variant: 'icon',
        tooltip: 'Налаштування',
        onClick: () => hud.open('settings'),
      }),
      new Button({
        name: 'sys-help',
        icon: 'help',
        variant: 'icon',
        tooltip: 'Довідка',
        onClick: () => hud.open('help'),
      }),
    ],
  });
  store.subscribe(
    (s) => s.settings.audio,
    (on) => {
      sound.icon = on ? 'soundOn' : 'soundOff';
      sound.selected = !on;
    },
    { immediate: true },
  );
  const onFull = (): void => {
    full.icon = document.fullscreenElement ? 'fullscreenExit' : 'fullscreen';
  };
  document.addEventListener('fullscreenchange', onFull);
  return {
    node,
    onVolume() {
      libraryButton.visible = hud.libraryLevel;
      hud.relayout();
    },
    onLayout(m) {
      node.float = { ax: 1, ay: 0, dx: -m.safeMargin, dy: m.safeMargin };
    },
  };
}
