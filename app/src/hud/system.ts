/**
 * System buttons (top-right): journey map, glossary, sound, fullscreen, settings, help.
 */
import { Button, UiNode } from '@/ui3d';
import type { HudContext, HudModule } from './context';
import { TOUCH } from './touch/geometry';

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
  const desk: Button[] = [
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
  ];
  // touch shells (phones, tablets): the map and one menu that holds everything else (`touch/menu.ts`)
  const compact: Button[] = [
    new Button({
      name: 'sys-map',
      icon: 'map',
      variant: 'icon',
      tooltip: 'Мапа подорожі',
      visible: false,
      onClick: () => hud.open('map'),
    }),
    new Button({
      name: 'sys-menu',
      icon: 'menu',
      variant: 'icon',
      tooltip: 'Меню: глосарій, звук, налаштування, довідка',
      visible: false,
      onClick: () => hud.open('menu'),
    }),
  ];
  let touch = false;
  const node = new UiNode({
    dir: 'row',
    gap: 8,
    align: 'center',
    float: { ax: 1, ay: 0 },
    children: [libraryButton, ...desk, ...compact],
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
      libraryButton.visible = hud.libraryLevel && !touch;
      hud.relayout();
    },
    onLayout(m) {
      const now = m.shell !== 'desk';
      if (now !== touch) {
        touch = now;
        for (const b of desk) b.visible = !touch;
        for (const b of compact) b.visible = touch;
        libraryButton.visible = hud.libraryLevel && !touch;
      }
      if (touch) {
        // top-right corner of the scene: beside the side sheet in landscape
        const right = m.shell === 'side' ? (hud.touch.insets?.(m).right ?? m.safeArea.right) : m.safeArea.right;
        node.float = { ax: 1, ay: 0, dx: -(right + TOUCH.edge), dy: m.safeArea.top + TOUCH.edge + 1 };
        return;
      }
      node.float = { ax: 1, ay: 0, dx: -m.safeMargin, dy: m.safeMargin };
    },
  };
}
