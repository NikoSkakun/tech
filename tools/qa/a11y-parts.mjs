// In-page checks of a11y-check.mjs (D8, docs/HUD_DOM.md §14) on the DOM interface layer #kd-hud.

/** Interactive elements (same set as `__ui.offscreen`), marked `data-a11y-i="<k>"` for the CDP name lookup. */
export function markInteractive(page) {
  return page.evaluate(() => {
    const SEL = 'button, a[href], input, select, textarea, [role=slider], [role=radio], [role=switch], [role=tab], [role=checkbox], [role=link], [role=button], [tabindex]:not([tabindex="-1"])';
    const shown = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !el.closest('[hidden], [inert], .kd-off');
    let k = 0;
    const out = [];
    for (const el of document.querySelectorAll('#kd-hud *')) {
      if (!el.matches(SEL) || !shown(el) || el.disabled) continue;
      el.setAttribute('data-a11y-i', String(k));
      out.push({ k, tag: el.tagName.toLowerCase(), ui: el.getAttribute('data-ui') ?? '', role: el.getAttribute('role') ?? '' });
      k++;
    }
    return out;
  });
}

/**
 * `aria-*` sanity: expanded is true|false and names an existing aria-controls target, aria-controls /
 * labelledby / describedby ids exist, aria-current has a valid value and at most one `step` per container,
 * dialogs are modal and named, nothing focusable inside aria-hidden. Returns problem strings.
 */
export function ariaProblems(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#kd-hud');
    if (!root) return ['no #kd-hud: the DOM interface is not mounted'];
    const out = [];
    const id = (el) => `${el.tagName.toLowerCase()}[${el.getAttribute('data-ui') ?? el.id ?? ''}]`;
    const ids = (v) => (v ?? '').split(/\s+/).filter(Boolean);
    for (const el of root.querySelectorAll('[aria-expanded]')) {
      const v = el.getAttribute('aria-expanded');
      if (v !== 'true' && v !== 'false') out.push(`${id(el)}: aria-expanded="${v}"`);
    }
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby'])
      for (const el of root.querySelectorAll(`[${attr}]`))
        for (const ref of ids(el.getAttribute(attr))) if (!document.getElementById(ref)) out.push(`${id(el)}: ${attr} → #${ref} does not exist`);
    const CURRENT = ['page', 'step', 'location', 'date', 'time', 'true', 'false'];
    for (const el of root.querySelectorAll('[aria-current]'))
      if (!CURRENT.includes(el.getAttribute('aria-current'))) out.push(`${id(el)}: aria-current="${el.getAttribute('aria-current')}"`);
    for (const nav of root.querySelectorAll('nav, [role=navigation], ol, ul')) {
      const n = nav.querySelectorAll(':scope > * [aria-current="step"], :scope > [aria-current="step"]').length;
      if (n > 1) out.push(`${id(nav)}: ${n} elements with aria-current="step"`);
    }
    for (const el of root.querySelectorAll('[role=dialog], dialog')) {
      if (el.getAttribute('aria-modal') !== 'true') out.push(`${id(el)}: dialog without aria-modal="true"`);
      if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) out.push(`${id(el)}: dialog without a name`);
    }
    for (const el of root.querySelectorAll('[aria-hidden="true"] :is(button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]))'))
      out.push(`${id(el)}: focusable inside aria-hidden`);
    return out;
  });
}

/**
 * WCAG contrast of every visible text of #kd-hud against its plate: the nearest ancestor whose background colour
 * or gradient has a colour stop of alpha ≥ 0.5 (thin washes are decoration). The worst stop counts. Text over
 * no plate (straight on the scene) is listed as `plate: null` and not judged.
 */
export function contrastList(page) {
  return page.evaluate(() => {
    const rgba = (s) => [...s.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => {
      const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean);
      return [Number(r), Number(g), Number(b), Number(a)];
    });
    const lum = ([r, g, b]) => {
      const c = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
    };
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const mix = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
    const out = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.querySelector('#kd-hud') ?? document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      if (!el || seen.has(el) || !t.textContent.trim() || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      if (el.closest('[aria-hidden="true"], .sr-only, .kd-sr')) continue;
      seen.add(el);
      let plates = null;
      for (let p = el; p && p.id !== 'kd-hud'; p = p.parentElement) {
        const s = getComputedStyle(p);
        const stops = [...rgba(s.backgroundColor), ...rgba(s.backgroundImage)].filter((c) => c[3] >= 0.5);
        if (stops.length) {
          plates = stops;
          break;
        }
      }
      const s = getComputedStyle(el);
      const px = parseFloat(s.fontSize);
      const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
      const fg = rgba(s.color)[0];
      const worst = plates ? Math.min(...plates.map((bg) => ratio(mix(fg, bg), bg))) : null;
      out.push({ text: t.textContent.trim().slice(0, 28), ui: el.closest('[data-ui]')?.getAttribute('data-ui') ?? '', ratio: worst, need: large ? 3 : 4.5, px });
    }
    return out;
  });
}
