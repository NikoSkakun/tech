/**
 * Boot splash and fatal-error screen — the only HTML UI of the app (STYLE_GUIDE §6 allows HTML for the boot
 * loader and fallback plumbing). Markup and critical CSS live in `index.html`.
 */

export type FatalKind = 'webgl' | 'boot' | 'context';

const TEXTS: Record<FatalKind, { title: string; text: string; hint: string }> = {
  webgl: {
    title: 'Потрібен WebGL2',
    text: 'Цей посібник — повністю тривимірний, а ваш браузер не зміг увімкнути 3D-графіку (WebGL2).',
    hint: 'Оновіть браузер до свіжої версії Chrome, Edge, Firefox або Safari та перевірте, що в налаштуваннях увімкнено апаратне прискорення.',
  },
  boot: {
    title: 'Не вдалося запустити посібник',
    text: 'Під час завантаження сталася помилка.',
    hint: 'Перевірте з’єднання з сервером і спробуйте ще раз.',
  },
  context: {
    title: 'Графіку не вдалося відновити',
    text: 'Браузер втратив доступ до відеокарти й не зміг його повернути.',
    hint: 'Перезавантажте сторінку. Якщо це повторюється — закрийте зайві вкладки з 3D-графікою або оновіть драйвер відеокарти.',
  },
};

export interface BootUi {
  /** 0…1; `label` replaces the default "Завантаження…" note. */
  progress(fraction: number, label?: string): void;
  /** Fade the splash out (the WebGL scene is already rendering underneath). `instant` skips the fade (QA). */
  hide(instant?: boolean): void;
  /** Show the fatal-error screen with a reload button. */
  fatal(kind: FatalKind, detail?: string): void;
  /** WebGL context lost: show a recovery notice; escalates to a fatal screen if it is not restored in time. */
  contextLost(): void;
  contextRestored(): void;
}

export function createBootUi(doc: Document = document): BootUi {
  const boot = doc.getElementById('boot');
  const bar = doc.getElementById('boot-bar');
  const note = doc.getElementById('boot-note');
  const fatal = doc.getElementById('fatal');
  let shown = 0;
  let lostTimer = 0;
  let hidden = false;

  const showFatal = (kind: FatalKind, detail?: string): void => {
    const t = TEXTS[kind];
    const set = (id: string, text: string): void => {
      const el = doc.getElementById(id);
      if (el) el.textContent = text;
    };
    set('fatal-title', t.title);
    set('fatal-text', t.text);
    set('fatal-hint', t.hint);
    set('fatal-detail', detail ?? '');
    doc
      .getElementById('fatal-retry')
      ?.addEventListener('click', () => window.location.reload(), { once: true });
    if (fatal) fatal.hidden = false;
    boot?.classList.add('out');
  };

  return {
    progress(fraction, label) {
      shown = Math.max(shown, Math.min(Math.max(fraction, 0), 1)); // never moves backwards
      if (bar) bar.style.width = `${Math.round(4 + shown * 96)}%`;
      if (note) note.textContent = `${label ?? 'Завантаження…'} ${Math.round(shown * 100)} %`;
    },
    hide(instant = false) {
      if (hidden) return;
      hidden = true;
      this.progress(1);
      if (instant && boot) boot.style.transition = 'none';
      boot?.classList.add('out');
    },
    fatal: showFatal,
    contextLost() {
      if (!boot || !note) return;
      note.textContent = 'Графічний контекст втрачено. Відновлюємо…';
      boot.classList.remove('out');
      window.clearTimeout(lostTimer);
      lostTimer = window.setTimeout(() => showFatal('context'), 8000);
    },
    contextRestored() {
      window.clearTimeout(lostTimer);
      if (hidden) boot?.classList.add('out');
    },
  };
}

/** True if this browser can create a WebGL2 context at all. */
export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    // The probe context is simply dropped: explicitly losing it (WEBGL_lose_context) makes Chrome's ANGLE/Vulkan
    // backend lose the main context as well.
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
