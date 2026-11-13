/**
 * Small helpers of the shell: the chunk-loading indicator (shown while the engine loads another chapter) and
 * the first-run onboarding hints (shown once per browser, then remembered in localStorage).
 */
import { Label, Panel, ProgressRing, UI, conceal, reveal } from '@/ui3d';
import type { HudModule } from './context';
import type { Hud } from './shell';

/** Loading pill above the navigator: spinner ring that fills with the chapter's reported progress. */
export function createLoading(hud: Hud): HudModule {
  const ring = new ProgressRing({ size: 34 });
  const text = new Label('Завантаження розділу…', { size: UI.text.small, nowrap: true });
  const node = new Panel({
    variant: 'card',
    dir: 'row',
    align: 'center',
    gap: 12,
    pad: [8, 18, 8, 10],
    radius: 26,
    float: { ax: 0.5, ay: 1 },
    visible: false,
    opacity: 0,
    blocks: false,
    children: [ring, text],
  });
  let active = false;
  let spin = 0;
  hud.engine.store.subscribe(
    (s) => s.transition,
    (t) => {
      const loading = t.phase === 'loading';
      if (loading && !active) {
        const title = t.to ? hud.engine.library.chapter(t.to)?.title : undefined;
        text.text = title ? `Завантаження: ${title}…` : 'Завантаження розділу…';
        ring.spin = 0;
        // quick loads (cached chunks) never flash the pill: it appears only after a moment
        hud.host.tweens.delay(0.25, () => active && reveal(node, { dy: -10 }));
      } else if (!loading && active) conceal(node, { dy: -6 });
      active = loading;
      if (loading && t.progress > 0.02) {
        ring.spin = null;
        ring.value = t.progress;
      }
    },
  );
  return {
    node,
    onLayout(m) {
      node.float = { ax: 0.5, ay: 1, dy: -(m.safeMargin + 96) };
    },
    update(dt) {
      if (!active || ring.spin === null) return;
      spin += dt * 4.2;
      ring.spin = spin;
      ring.repaint();
    },
  };
}

const SEEN_KEY = 'electricity:ui:v1:onboarded';

/**
 * First-run hints: three toasts, one after another, the first time a chapter is on screen without an
 * overlay. Deep links from QA (`?freeze`) and `?debug` sessions skip them.
 */
export function installOnboarding(hud: Hud): void {
  const flags = hud.engine.flags;
  let seen = true;
  try {
    seen = window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // storage unavailable: do not nag on every visit
  }
  if (seen || flags.freeze !== null || flags.debug) return;
  const hints: [string, 'hand' | 'keyboard' | 'map'][] = [
    ['Тягніть сцену, щоб обертати її; колесо або щипок — масштаб.', 'hand'],
    ['← і → перемикають кроки. Усе з блакитним контуром можна натискати.', 'keyboard'],
    ['Мапа подорожі (кнопка або клавіша M) перенесе на будь-який крок курсу.', 'map'],
  ];
  const off = hud.engine.runtime.on('step', () => {
    if (hud.overlay !== null) return;
    off();
    hints.forEach(([text, icon], i) =>
      hud.host.tweens.delay(
        1.2 + i * 6.2,
        () => hud.overlay === null && hud.toast(text, { icon, duration: 5.6 }),
      ),
    );
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // best effort
    }
  });
}
