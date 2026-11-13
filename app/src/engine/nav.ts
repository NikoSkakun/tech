/**
 * Navigation API: the single entry point for moving through the library. It keeps the router (address bar),
 * the store and the chapter runtime in agreement.
 *
 * Addresses. A step is `<volume>/<chapter>/<step>`. Wherever a chapter is named, the short form `<chapter>`
 * means "in the current volume, else in the default volume, else in any other volume" — so a chapter keeps
 * saying `nav.goto('atom', 'quarks')` and old two-part links keep working.
 */
import type { ChapterManifest } from './chapter';
import { parseChapterRef, type Library } from './library';
import { formatHash, parseHash, type Route, type Router } from './router';
import { samePosition, type Position, type Store } from './store';
import type { VolumeManifest } from './volume';

export interface GotoOptions {
  /** Apply the target state without step animation (the chapter transition still plays between chapters). */
  instant?: boolean;
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

/** What the navigation layer needs from the chapter runtime. */
export interface NavTarget {
  request(position: Position, opts: { instant: boolean }): Promise<void>;
}

/** The part of the router `Nav` uses (lets tests pass a stub). */
export type NavRouter = Pick<Router, 'route' | 'push' | 'replace' | 'onChange'>;

type Address = { volumeId: string | null; chapterId: string | null; stepId: string | null };

export class Nav {
  private target: Position | null = null;
  /** Bumped by every navigation request, so a slow (volume-loading) request cannot overtake a newer one. */
  private seq = 0;

  constructor(
    readonly library: Library,
    private readonly router: NavRouter,
    private readonly store: Store,
    private readonly runtime: NavTarget,
  ) {
    router.onChange((route) => void this.onRoute(route));
  }

  /** Volume of the current position (null before the first navigation). */
  get volume(): VolumeManifest | null {
    return this.target ? (this.library.get(this.target.volumeId) ?? null) : null;
  }

  /** Registered volumes in library order. */
  get volumes(): readonly VolumeManifest[] {
    return this.library.volumes;
  }

  /** Visible chapters of the current volume in journey order. */
  get chapters(): readonly ChapterManifest[] {
    return this.target ? (this.library.registry(this.target.volumeId)?.chapters ?? []) : [];
  }

  /** Where navigation is heading (or resting). */
  get position(): Position | null {
    return this.target;
  }

  /** Manifest of a chapter (`chapter` or `volume/chapter`) among the loaded volumes. */
  chapter(ref: string): ChapterManifest | undefined {
    return this.library.chapter(ref, this.target?.volumeId);
  }

  childrenOf(ref: string): readonly ChapterManifest[] {
    const m = this.chapter(ref);
    return m ? (this.library.registry(m.volume)?.childrenOf(m.id) ?? []) : [];
  }

  parentOf(ref: string): ChapterManifest | undefined {
    const m = this.chapter(ref);
    return m ? this.library.registry(m.volume)?.parentOf(m.id) : undefined;
  }

  /** Index of the current position among all steps of the current volume's journey. */
  get journeyProgress(): { index: number; total: number } {
    const registry = this.target && this.library.registry(this.target.volumeId);
    return registry && this.target ? registry.journeyProgress(this.target) : { index: -1, total: 0 };
  }

  get canNext(): boolean {
    return this.neighbour(1) !== null;
  }

  get canPrev(): boolean {
    return this.neighbour(-1) !== null;
  }

  private neighbour(dir: 1 | -1): Position | null {
    const registry = this.target && this.library.registry(this.target.volumeId);
    if (!registry || !this.target) return null;
    return dir > 0 ? registry.next(this.target) : registry.prev(this.target);
  }

  /**
   * Parse a step address — `volume/chapter/step`, `chapter/step`, `chapter`, `volume/chapter` — and resolve
   * it among the loaded volumes. Null when the chapter does not exist (or its volume is not loaded): use it
   * to show a cross-reference only when its target can be opened.
   */
  locate(address: string): Position | null {
    return this.library.resolveLoaded(this.parse(address), this.target?.volumeId) ?? null;
  }

  private parse(address: string): Address {
    return parseHash(`#/${address}`, (id) => this.library.has(id));
  }

  /**
   * Go to any step of any chapter. `chapter` is a chapter id (short form) or `volume/chapter`. Omitting
   * `stepId` opens the chapter's first step. Unknown ids are ignored (resolves false). The returned promise
   * resolves when the target is on screen (or was superseded).
   */
  goto(chapter: string, stepId?: string | null, opts: GotoOptions = {}): Promise<boolean> {
    const ref = parseChapterRef(chapter);
    if (!ref) return Promise.resolve(false);
    return this.go({ volumeId: ref.volumeId, chapterId: ref.chapterId, stepId: stepId ?? null }, opts);
  }

  /** Go to a step address (see `locate` for the accepted forms). */
  open(address: string, opts: GotoOptions = {}): Promise<boolean> {
    const a = this.parse(address);
    return a.chapterId
      ? this.go(a, opts)
      : a.volumeId
        ? this.gotoVolume(a.volumeId, opts)
        : Promise.resolve(false);
  }

  /** Enter a volume: where the user last was in it, else its first step. False for an unknown or empty volume. */
  async gotoVolume(volumeId: string, opts: GotoOptions = {}): Promise<boolean> {
    const seq = ++this.seq;
    const pos = await this.volumeEntry(volumeId);
    if (!pos || seq !== this.seq) return false;
    return this.apply(pos, opts);
  }

  private async volumeEntry(volumeId: string): Promise<Position | null> {
    if (!this.library.has(volumeId)) return null;
    const registry = await this.library.load(volumeId);
    const last = this.store.get().lastIn[volumeId];
    const first = registry.chapters[0];
    return (
      (last ? registry.resolve(last.chapterId, last.stepId) : null) ??
      (first ? registry.resolve(first.id, null) : null)
    );
  }

  private go(address: Address, opts: GotoOptions): Promise<boolean> {
    const seq = ++this.seq;
    const from = this.target?.volumeId;
    const pos = this.library.resolveLoaded(address, from);
    if (pos === null) return Promise.resolve(false);
    if (pos) return this.apply(pos, opts);
    // the target's volume is not loaded yet
    return this.library.resolve(address, from).then((found) => {
      if (!found || seq !== this.seq) return false;
      return this.apply(found, opts);
    });
  }

  private apply(pos: Position, opts: GotoOptions): Promise<boolean> {
    const same = samePosition(this.target, pos);
    this.target = pos;
    this.store.set({ target: pos });
    if (opts.replace || same) this.router.replace(pos);
    else this.router.push(pos);
    return this.runtime.request(pos, { instant: opts.instant ?? false }).then(() => true);
  }

  /** Next step in journey order of the volume (continues into the next chapter). */
  next(opts: GotoOptions = {}): Promise<boolean> {
    const n = this.neighbour(1);
    return n ? this.go(n, opts) : Promise.resolve(false);
  }

  prev(opts: GotoOptions = {}): Promise<boolean> {
    const p = this.neighbour(-1);
    return p ? this.go(p, opts) : Promise.resolve(false);
  }

  /** Go to the parent chapter (plant type → plants hub, lab → home). */
  up(opts: GotoOptions = {}): Promise<boolean> {
    const t = this.target;
    const parent = t ? this.library.registry(t.volumeId)?.parentOf(t.chapterId) : undefined;
    return parent && t
      ? this.go({ volumeId: t.volumeId, chapterId: parent.id, stepId: null }, opts)
      : Promise.resolve(false);
  }

  /**
   * Initial navigation: deep link from the address bar (a legacy two-part link lands in the default volume;
   * a volume-only link enters that volume), else the last persisted position, else the first chapter of the
   * default volume. The address bar is normalised without adding a history entry.
   */
  async start(opts: { instant?: boolean } = {}): Promise<boolean> {
    const route = this.router.route;
    const last = this.store.get().last;
    const pos =
      (await this.library.resolve(route)) ??
      (route.volumeId && !route.chapterId ? await this.volumeEntry(route.volumeId) : null) ??
      (last ? await this.library.resolve(last) : null) ??
      (await this.volumeEntry(this.library.defaultVolume.id));
    if (!pos) throw new Error('Nav: no chapters registered');
    ++this.seq;
    return this.apply(pos, { replace: true, instant: opts.instant ?? true });
  }

  /** Address bar changed by the user (back/forward, typed hash). */
  private async onRoute(route: Route): Promise<void> {
    const seq = ++this.seq;
    const pos =
      (await this.library.resolve(route)) ??
      (route.volumeId && !route.chapterId ? await this.volumeEntry(route.volumeId) : null);
    if (seq !== this.seq) return;
    if (!pos) {
      // unknown target: restore the address of where we actually are
      if (this.target) this.router.replace(this.target);
      return;
    }
    // legacy two-part links, volume-only links and unknown steps are rewritten to the full address
    if (formatHash(pos) !== formatHash(route)) this.router.replace(pos);
    this.target = pos;
    this.store.set({ target: pos });
    void this.runtime.request(pos, { instant: false });
  }
}
