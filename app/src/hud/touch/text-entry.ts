/**
 * Text entry on touch devices: the WebGL UI has no text field, and an on-screen keyboard appears only for a
 * focused DOM field. This is that field — invisible plumbing (STYLE_GUIDE §6 allows HTML for native APIs):
 * one hidden `<input>`; `open()` must be called from a tap handler (browsers show the keyboard only on a user
 * gesture). What the user types arrives through `onInput`; the WebGL search box draws it.
 *
 * The device model reports the keyboard's height (`device.keyboard`), the HUD adds it to the bottom safe
 * area, so open panels move above the keyboard by themselves.
 */

export interface TextEntry {
  /** Focus the field with `value` in it (shows the on-screen keyboard). Call from a tap / click handler. */
  open(value: string, onInput: (value: string) => void, onDone?: () => void): void;
  /** Hide the keyboard. */
  close(): void;
  readonly active: boolean;
}

let shared: TextEntry | null = null;

/** The app's one hidden text field (created on first use). */
export function textEntry(): TextEntry {
  if (shared) return shared;
  const input = document.createElement('input');
  input.type = 'search';
  input.setAttribute('aria-label', 'Пошук');
  input.setAttribute('inputmode', 'search');
  input.setAttribute('enterkeyhint', 'search');
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.maxLength = 32;
  // at the top-left corner, so focusing it never makes the browser scroll the page; 16 px font: iOS zooms
  // into smaller fields; opacity 0 and no pointer events: it is never seen and never touched directly
  input.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;' +
    'font-size:16px;pointer-events:none;background:transparent;color:transparent;caret-color:transparent';
  input.tabIndex = -1;
  let listener: ((value: string) => void) | null = null;
  let done: (() => void) | null = null;
  input.addEventListener('input', () => listener?.(input.value));
  input.addEventListener('keydown', (e) => {
    // Enter / Search on the on-screen keyboard: done typing
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });
  input.addEventListener('blur', () => {
    const fn = done;
    listener = null;
    done = null;
    fn?.();
  });
  document.body.appendChild(input);
  shared = {
    open(value, onInput, onDone) {
      input.value = value;
      listener = onInput;
      done = onDone ?? null;
      input.focus({ preventScroll: true });
      const end = input.value.length;
      try {
        input.setSelectionRange(end, end);
      } catch {
        // some browsers do not allow selection ranges on search fields
      }
    },
    close() {
      if (document.activeElement === input) input.blur();
    },
    get active() {
      return document.activeElement === input;
    },
  };
  return shared;
}
