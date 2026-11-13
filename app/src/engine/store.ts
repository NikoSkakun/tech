/**
 * Small observable application store with localStorage persistence of the user-facing slices
 * (settings, progress, last position). No framework: `get`, `set`, `subscribe(selector, listener)`.
 */
import type { QualityTier } from './quality';

export interface Settings {
  /** `auto` = result of the first-run GPU benchmark. */
  quality: QualityTier | 'auto';
  /** Tier picked by the first-run benchmark (null until it ran). */
  benchmarkTier: QualityTier | null;
  /** Lower the internal resolution when frames run over budget. */
  dynamicResolution: boolean;
  /** Master audio switch (the mute toggle of STYLE_GUIDE §7). */
  audio: boolean;
  /** 0…1 master volume. */
  volume: number;
  /** `auto` follows the OS `prefers-reduced-motion` media query. */
  reducedMotion: boolean | 'auto';
  /** UI text scale multiplier (0.85…1.4). */
  textScale: number;
}

export interface Progress {
  /** Full chapter id (`<volume>/<chapter>`) → ids of steps the user has opened. */
  visited: Record<string, string[]>;
}

/** A step address: `<volumeId>/<chapterId>/<stepId>`. `chapterId` is unique inside its volume only. */
export interface Position {
  volumeId: string;
  chapterId: string;
  stepId: string;
}

export function samePosition(a: Position | null | undefined, b: Position | null | undefined): boolean {
  return !!a && !!b && a.volumeId === b.volumeId && a.chapterId === b.chapterId && a.stepId === b.stepId;
}

export type TransitionPhase = 'idle' | 'loading' | 'animating';

export interface TransitionState {
  phase: TransitionPhase;
  /** Full id (`<volume>/<chapter>`) of the chapter being left (null on first load). */
  from: string | null;
  /** Full id of the chapter being entered. */
  to: string | null;
  /** +1 = zooming in (down in scale), −1 = zooming out (up in scale). */
  direction: 1 | -1;
  /** Loading progress 0…1 while `phase === 'loading'`, animation progress while `animating`. */
  progress: number;
}

export interface AppState {
  /** Volume and chapter currently on screen (null before the first chapter is ready). */
  volumeId: string | null;
  chapterId: string | null;
  stepId: string | null;
  /** Where navigation is heading (equals chapterId/stepId when settled). */
  target: Position | null;
  transition: TransitionState;
  /** Effective quality tier in use right now. */
  quality: QualityTier;
  settings: Settings;
  progress: Progress;
  /** Last settled position, persisted across sessions. */
  last: Position | null;
  /** Last settled position inside each volume (volume id → position): where "continue" resumes a volume. */
  lastIn: Record<string, Position>;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'auto',
  benchmarkTier: null,
  dynamicResolution: true,
  audio: true,
  volume: 0.8,
  reducedMotion: 'auto',
  textScale: 1,
};

export function initialState(): AppState {
  return {
    volumeId: null,
    chapterId: null,
    stepId: null,
    target: null,
    transition: { phase: 'idle', from: null, to: null, direction: 1, progress: 0 },
    quality: 'high',
    settings: { ...DEFAULT_SETTINGS },
    progress: { visited: {} },
    last: null,
    lastIn: {},
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface Persisted {
  v: 2;
  settings: Partial<Settings>;
  progress: Progress;
  last: Position | null;
  lastIn: Record<string, Position>;
}

/** Storage format before the library of volumes: chapter ids without a volume. */
interface PersistedV1 {
  v: 1;
  settings?: Partial<Settings>;
  progress?: { visited?: Record<string, string[]> };
  last?: { chapterId: string; stepId: string } | null;
}

/** The key keeps the project's code name as its namespace; it is not a volume id. */
const STORAGE_KEY = 'electricity:v2';
const STORAGE_KEY_V1 = 'electricity:v1';

/**
 * Everything saved before volumes existed belongs to the first volume: progress keys become full chapter ids
 * and the last position gets its volume. Pure — exported for the unit tests.
 */
export function migrateV1(data: PersistedV1, volumeId: string): Persisted {
  const visited: Record<string, string[]> = {};
  for (const [chapterId, steps] of Object.entries(data.progress?.visited ?? {}))
    if (Array.isArray(steps))
      visited[`${volumeId}/${chapterId}`] = steps.filter((s) => typeof s === 'string');
  const last =
    data.last && typeof data.last.chapterId === 'string' && typeof data.last.stepId === 'string'
      ? { volumeId, chapterId: data.last.chapterId, stepId: data.last.stepId }
      : null;
  return {
    v: 2,
    settings: data.settings ?? {},
    progress: { visited },
    last,
    lastIn: last ? { [volumeId]: last } : {},
  };
}

type Listener<T> = (value: T, previous: T) => void;

interface Subscription<T> {
  select: (s: AppState) => T;
  listener: Listener<T>;
  last: T;
}

export class Store {
  private state: AppState;
  private readonly subs = new Set<Subscription<unknown>>();
  private notifying = false;
  private dirty = false;

  /**
   * @param storage pass `null` to disable persistence (tests, private mode failures).
   * @param legacyVolume volume that data saved before the library of volumes belongs to (the default volume).
   */
  constructor(
    private readonly storage: StorageLike | null = null,
    private readonly legacyVolume = 'electricity',
  ) {
    this.state = initialState();
    this.load();
  }

  get(): AppState {
    return this.state;
  }

  /** Shallow-merge a patch (or the result of an updater) into the state and notify subscribers. */
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    const prev = this.state;
    this.state = { ...prev, ...p };
    if (
      p.settings !== undefined ||
      p.progress !== undefined ||
      p.last !== undefined ||
      p.lastIn !== undefined
    )
      this.save();
    this.notify();
  }

  updateSettings(patch: Partial<Settings>): void {
    this.set((s) => ({ settings: { ...s.settings, ...patch } }));
  }

  /** Record that a step was opened (idempotent). */
  markVisited(pos: Position): void {
    const key = `${pos.volumeId}/${pos.chapterId}`;
    const visited = this.state.progress.visited;
    const list = visited[key] ?? [];
    if (list.includes(pos.stepId)) return;
    this.set({ progress: { visited: { ...visited, [key]: [...list, pos.stepId] } } });
  }

  /** Record the position the user settled on: the global last position and the last one inside its volume. */
  settle(pos: Position): void {
    this.set((s) => ({ last: pos, lastIn: { ...s.lastIn, [pos.volumeId]: pos } }));
  }

  /**
   * Subscribe to a derived value. The listener runs only when the selected value changes (`Object.is`).
   * Returns an unsubscribe function.
   */
  subscribe<T>(
    select: (s: AppState) => T,
    listener: Listener<T>,
    opts: { immediate?: boolean } = {},
  ): () => void {
    const sub: Subscription<T> = { select, listener, last: select(this.state) };
    this.subs.add(sub as Subscription<unknown>);
    if (opts.immediate) listener(sub.last, sub.last);
    return () => {
      this.subs.delete(sub as Subscription<unknown>);
    };
  }

  private notify(): void {
    if (this.notifying) {
      this.dirty = true; // a listener called set(): run another pass after the current one
      return;
    }
    this.notifying = true;
    try {
      do {
        this.dirty = false;
        for (const sub of [...this.subs]) {
          const next = sub.select(this.state);
          if (!Object.is(next, sub.last)) {
            const prev = sub.last;
            sub.last = next;
            sub.listener(next, prev);
          }
        }
      } while (this.dirty);
    } finally {
      this.notifying = false;
    }
  }

  private load(): void {
    if (!this.storage) return;
    try {
      let data: Partial<Persisted> | null = null;
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) data = JSON.parse(raw) as Partial<Persisted>;
      else {
        // first run after the move to volumes: take over the old record (it stays in place, untouched)
        const old = this.storage.getItem(STORAGE_KEY_V1);
        const v1 = old ? (JSON.parse(old) as Partial<PersistedV1>) : null;
        if (v1?.v === 1) {
          data = migrateV1(v1 as PersistedV1, this.legacyVolume);
          this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      }
      if (!data || data.v !== 2) return;
      this.state = {
        ...this.state,
        settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
        progress: { visited: { ...(data.progress?.visited ?? {}) } },
        last: data.last ?? null,
        lastIn: { ...(data.lastIn ?? {}) },
      };
    } catch {
      // Corrupt or inaccessible storage: start from defaults.
    }
  }

  private save(): void {
    if (!this.storage) return;
    const data: Persisted = {
      v: 2,
      settings: this.state.settings,
      progress: this.state.progress,
      last: this.state.last,
      lastIn: this.state.lastIn,
    };
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota exceeded / storage disabled: persistence is best-effort.
    }
  }
}
