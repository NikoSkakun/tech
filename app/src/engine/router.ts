/**
 * Hash router: deep links of the form `#/<volumeId>/<chapterId>/<stepId>`; back/forward work through
 * `hashchange`. Hash routing (not the History API paths) keeps the app servable from any static path without
 * rewrites.
 *
 * Links from before the library of volumes had two parts, `#/<chapterId>/<stepId>`. They still parse — with
 * `volumeId: null` — and navigation redirects them to the default volume (`Library.resolve`).
 */
import { Emitter, type Unsubscribe } from './events';

export interface Route {
  /** Null for the bare `#/` and for a legacy two-part link. */
  volumeId: string | null;
  chapterId: string | null;
  stepId: string | null;
}

const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

export function sameRoute(a: Route, b: Route): boolean {
  return a.volumeId === b.volumeId && a.chapterId === b.chapterId && a.stepId === b.stepId;
}

/**
 * Parse a location hash. Three segments are always `volume/chapter/step`. With one or two segments the first
 * one is a volume if `isVolume` says so (`#/electricity`, `#/electricity/atom`); otherwise the link is a
 * legacy `chapter[/step]` and `volumeId` stays null. Invalid segments become null.
 */
export function parseHash(hash: string, isVolume: (id: string) => boolean = () => false): Route {
  const clean = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const parts = clean.split('/').filter((p) => p.length > 0);
  const seg = (i: number): string | null => (parts[i] && SEGMENT.test(parts[i]!) ? parts[i]! : null);
  const first = seg(0);
  if (!first) return { volumeId: null, chapterId: null, stepId: null };
  if (parts.length >= 3 || isVolume(first)) {
    const chapterId = seg(1);
    return { volumeId: first, chapterId, stepId: chapterId ? seg(2) : null };
  }
  return { volumeId: null, chapterId: first, stepId: seg(1) };
}

export function formatHash(route: Route): string {
  const parts = [route.volumeId, route.chapterId, route.chapterId ? route.stepId : null];
  const path = parts.filter((p): p is string => !!p).join('/');
  return `#/${path}`;
}

/** The part of `window` the router needs (injectable for tests). */
export interface LocationHost {
  location: { hash: string };
  history: { replaceState(data: unknown, unused: string, url?: string | null): void };
  addEventListener(type: 'hashchange', fn: () => void): void;
  removeEventListener(type: 'hashchange', fn: () => void): void;
}

export class Router {
  private readonly events = new Emitter<{ change: Route }>();
  private current: Route;
  private readonly onHashChange = (): void => {
    const next = parseHash(this.host.location.hash, this.isVolume);
    if (sameRoute(next, this.current)) return;
    this.current = next;
    this.events.emit('change', next);
  };

  /** @param isVolume tells volume ids from chapter ids in one- and two-segment links (see `parseHash`). */
  constructor(
    private readonly host: LocationHost,
    private readonly isVolume: (id: string) => boolean = () => false,
  ) {
    this.current = parseHash(host.location.hash, isVolume);
    host.addEventListener('hashchange', this.onHashChange);
  }

  /** Route currently in the address bar. */
  get route(): Route {
    return this.current;
  }

  /** Fires when the user changes the hash (back/forward, manual edit, link) — not for `push`/`replace`. */
  onChange(fn: (route: Route) => void): Unsubscribe {
    return this.events.on('change', fn);
  }

  /** Navigate: adds a history entry. */
  push(route: Route): void {
    if (sameRoute(route, this.current)) return;
    this.current = { ...route };
    this.host.location.hash = formatHash(route);
  }

  /** Correct the address bar without adding a history entry (normalisation, redirects). */
  replace(route: Route): void {
    this.current = { ...route };
    this.host.history.replaceState(null, '', formatHash(route));
  }

  dispose(): void {
    this.host.removeEventListener('hashchange', this.onHashChange);
    this.events.clear();
  }
}
