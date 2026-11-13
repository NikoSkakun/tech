/**
 * Tween / timeline utility bound to the engine clock (never to wall-clock time): `Tweens.update(dt)` is called
 * once per engine update, so pausing, stepping or fast-forwarding the clock moves every animation with it.
 *
 * Semantics that make random access safe:
 *  - a tween captures its start values when it *starts* (immediately, or after its delay), i.e. from whatever
 *    the current value is — retargeting mid-flight never jumps;
 *  - starting a tween on a property automatically takes that property away from any older tween
 *    (`overwrite: auto`), so spamming state changes cannot leave two tweens fighting.
 */

export type EaseFn = (t: number) => number;

const backC1 = 1.70158;
const backC3 = backC1 + 1;
const backC2 = backC1 * 1.525;

const powIn =
  (p: number): EaseFn =>
  (t) =>
    Math.pow(t, p);
const powOut =
  (p: number): EaseFn =>
  (t) =>
    1 - Math.pow(1 - t, p);
const powInOut =
  (p: number): EaseFn =>
  (t) =>
    t < 0.5 ? Math.pow(2 * t, p) / 2 : 1 - Math.pow(2 - 2 * t, p) / 2;

/** Easing functions; names follow the GSAP convention the style guide uses (`power2.in`, `back.out`, …). */
export const EASE = {
  linear: (t: number) => t,
  'power1.in': powIn(2),
  'power1.out': powOut(2),
  'power1.inOut': powInOut(2),
  'power2.in': powIn(3),
  'power2.out': powOut(3),
  'power2.inOut': powInOut(3),
  'power3.in': powIn(4),
  'power3.out': powOut(4),
  'power3.inOut': powInOut(4),
  'power4.in': powIn(5),
  'power4.out': powOut(5),
  'power4.inOut': powInOut(5),
  'sine.in': (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  'sine.out': (t: number) => Math.sin((t * Math.PI) / 2),
  'sine.inOut': (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  'expo.in': (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  'expo.out': (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  'expo.inOut': (t: number) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  'back.in': (t: number) => backC3 * t * t * t - backC1 * t * t,
  'back.out': (t: number) => 1 + backC3 * Math.pow(t - 1, 3) + backC1 * Math.pow(t - 1, 2),
  'back.inOut': (t: number) =>
    t < 0.5
      ? (Math.pow(2 * t, 2) * ((backC2 + 1) * 2 * t - backC2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((backC2 + 1) * (t * 2 - 2) + backC2) + 2) / 2,
  'elastic.out': (t: number) =>
    t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  /** Camera moves: quintic in-out — long gentle start and an overshoot-free settle. */
  cinematic: powInOut(5),
  /** Soft settle used for UI release. */
  spring: (t: number) => 1 - Math.cos(t * Math.PI * 2.5) * Math.exp(-t * 6),
} as const satisfies Record<string, EaseFn>;

export type EaseName = keyof typeof EASE;
export type EaseLike = EaseName | EaseFn;

export function resolveEase(e: EaseLike | undefined, fallback: EaseFn = EASE['power2.out']): EaseFn {
  if (e === undefined) return fallback;
  return typeof e === 'function' ? e : EASE[e];
}

/** Frame-rate independent exponential smoothing toward `target` (λ = responsiveness in 1/s). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export interface TweenOptions {
  /** Seconds. Default 0.5. */
  duration?: number;
  ease?: EaseLike;
  /** Seconds before the tween starts (start values are captured when the delay has elapsed). */
  delay?: number;
  onStart?: () => void;
  /** Called after values were applied; `progress` is the eased 0…1 position. */
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

type NumericKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];
export type NumericProps<T> = { [K in NumericKeys<T>]?: number };

/** Target→property→owning tween, used for automatic overwrite. */
const owners = new WeakMap<object, Map<string, Tween>>();

export class Tween {
  /** True once the tween has completed or was killed. */
  done = false;
  /** True only if the tween ran to its end (false if killed). */
  completed = false;
  private elapsed: number;
  private started = false;
  private readonly duration: number;
  private readonly easeFn: EaseFn;
  private keys: string[] = [];
  private from: number[] = [];
  private to: number[] = [];
  private resolvers: ((completed: boolean) => void)[] | null = null;

  constructor(
    private readonly target: Record<string, number> | null,
    private readonly props: Record<string, number> | null,
    private readonly opts: TweenOptions,
  ) {
    this.duration = Math.max(opts.duration ?? 0.5, 0);
    this.easeFn = resolveEase(opts.ease);
    this.elapsed = -(opts.delay ?? 0);
  }

  /** Resolves `true` when the tween completes, `false` if it is killed first. */
  get finished(): Promise<boolean> {
    if (this.done) return Promise.resolve(this.completed);
    return new Promise((resolve) => {
      (this.resolvers ??= []).push(resolve);
    });
  }

  /** Stop without applying the end values and without calling `onComplete`. */
  kill(): void {
    if (this.done) return;
    this.finish(false);
  }

  /** @internal Releases one property (another tween took it over). */
  release(key: string): void {
    const i = this.keys.indexOf(key);
    if (i < 0) return;
    this.keys.splice(i, 1);
    this.from.splice(i, 1);
    this.to.splice(i, 1);
    // A property tween with nothing left to drive is dead weight (callbacks included): retire it quietly.
    if (this.keys.length === 0 && this.target) this.finish(false);
  }

  /**
   * @internal A tween without delay takes over its properties the moment it is created, so the value it
   * starts from is exactly the one on screen (not one more step of an older tween).
   */
  begin(): void {
    if (!this.done && !this.started && this.elapsed >= 0) this.start();
  }

  /** @internal */
  advance(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;
    if (this.elapsed < 0) return;
    if (!this.started) this.start();
    const raw = this.duration <= 0 ? 1 : Math.min(this.elapsed / this.duration, 1);
    const k = this.easeFn(raw);
    const target = this.target;
    if (target) {
      for (let i = 0; i < this.keys.length; i++) {
        target[this.keys[i]!] = this.from[i]! + (this.to[i]! - this.from[i]!) * k;
      }
    }
    this.opts.onUpdate?.(k);
    if (raw >= 1) {
      if (target) for (let i = 0; i < this.keys.length; i++) target[this.keys[i]!] = this.to[i]!;
      this.finish(true);
    }
  }

  private start(): void {
    this.started = true;
    const { target, props } = this;
    if (target && props) {
      let map = owners.get(target);
      if (!map) {
        map = new Map();
        owners.set(target, map);
      }
      for (const key of Object.keys(props)) {
        const end = props[key];
        if (end === undefined) continue;
        const previous = map.get(key);
        if (previous && previous !== this) previous.release(key);
        map.set(key, this);
        this.keys.push(key);
        this.from.push(target[key] ?? 0);
        this.to.push(end);
      }
    }
    this.opts.onStart?.();
  }

  private finish(completed: boolean): void {
    this.done = true;
    this.completed = completed;
    if (this.target) {
      const map = owners.get(this.target);
      if (map) for (const key of this.keys) if (map.get(key) === this) map.delete(key);
    }
    if (completed) this.opts.onComplete?.();
    if (this.resolvers) {
      for (const r of this.resolvers) r(completed);
      this.resolvers = null;
    }
  }
}

/** Position of a timeline entry: absolute seconds, `'<'` (start of the previous entry) or `'>'` (its end, default), optionally with an offset `'<+0.1'`, `'>-0.2'`. */
export type TimelinePosition = number | `<${string}` | `>${string}`;

/** A sequence of tweens/callbacks laid out on the shared engine clock. */
export class Timeline {
  private cursor = 0;
  private prevStart = 0;
  private readonly tweens: Tween[] = [];

  constructor(
    private readonly scope: TweenScope,
    startDelay = 0,
  ) {
    this.cursor = startDelay;
    this.prevStart = startDelay;
  }

  /** Total length in seconds of everything scheduled so far. */
  get duration(): number {
    return this.cursor;
  }

  to<T extends object>(
    target: T,
    props: NumericProps<T>,
    opts: TweenOptions = {},
    position?: TimelinePosition,
  ): this {
    const at = this.resolve(position);
    const duration = opts.duration ?? 0.5;
    this.tweens.push(this.scope.to(target, props, { ...opts, delay: at + (opts.delay ?? 0) }));
    this.place(at + (opts.delay ?? 0), duration);
    return this;
  }

  call(fn: () => void, position?: TimelinePosition): this {
    const at = this.resolve(position);
    this.tweens.push(this.scope.delay(at, fn));
    this.place(at, 0);
    return this;
  }

  wait(seconds: number): this {
    this.cursor += seconds;
    return this;
  }

  kill(): void {
    for (const t of this.tweens) t.kill();
  }

  /** Resolves when every entry has completed or been killed. */
  get finished(): Promise<void> {
    return Promise.all(this.tweens.map((t) => t.finished)).then(() => undefined);
  }

  private place(start: number, duration: number): void {
    this.prevStart = start;
    this.cursor = Math.max(this.cursor, start + duration);
  }

  private resolve(position: TimelinePosition | undefined): number {
    if (position === undefined) return this.cursor;
    if (typeof position === 'number') return position;
    const base = position[0] === '<' ? this.prevStart : this.cursor;
    const offset = position.length > 1 ? Number(position.slice(1)) : 0;
    return base + (Number.isFinite(offset) ? offset : 0);
  }
}

/** Where scopes hand their tweens over to be advanced. */
export interface TweenSink {
  register(t: Tween): void;
}

/**
 * A group of tweens that can be killed together. Chapters get one scope for their lifetime (`ctx.tweens`) and
 * one per step (`info.scope`), so nothing a chapter starts can outlive it.
 */
export class TweenScope {
  private readonly own = new Set<Tween>();
  private readonly children = new Set<TweenScope>();
  private dead = false;

  constructor(
    private readonly sink: TweenSink,
    private readonly parent: TweenScope | null = null,
  ) {}

  /** Tween numeric properties of `target` from their current values to `props`. */
  to<T extends object>(target: T, props: NumericProps<T>, opts: TweenOptions = {}): Tween {
    return this.add(
      new Tween(target as unknown as Record<string, number>, props as Record<string, number>, opts),
    );
  }

  /** Tween a detached number; `fn` receives the interpolated value each update. */
  value(from: number, to: number, opts: TweenOptions, fn: (value: number) => void): Tween {
    const user = opts.onUpdate;
    return this.add(
      new Tween(null, null, {
        ...opts,
        onUpdate: (k) => {
          fn(from + (to - from) * k);
          user?.(k);
        },
      }),
    );
  }

  /** Call `fn` after `seconds` of engine time. */
  delay(seconds: number, fn: () => void): Tween {
    return this.add(new Tween(null, null, { duration: 0, delay: seconds, onComplete: fn }));
  }

  /** Resolves after `seconds` of engine time (`false` if the scope was killed first). */
  wait(seconds: number): Promise<boolean> {
    return this.delay(seconds, () => undefined).finished;
  }

  timeline(startDelay = 0): Timeline {
    return new Timeline(this, startDelay);
  }

  /** Create a child scope (killed together with this one). */
  scope(): TweenScope {
    const child = new TweenScope(this.sink, this);
    this.children.add(child);
    return child;
  }

  /** Kill every tween started through this scope (and its child scopes). The scope stays usable. */
  killAll(): void {
    for (const t of this.own) t.kill();
    this.own.clear();
    for (const c of this.children) c.killAll();
  }

  /** Kill everything and detach from the parent; further tweens created here are killed immediately. */
  dispose(): void {
    this.killAll();
    for (const c of [...this.children]) c.dispose();
    this.dead = true;
    this.parent?.children.delete(this);
  }

  /** Number of live tweens in this scope (not counting children). */
  get activeCount(): number {
    this.prune();
    return this.own.size;
  }

  private add(t: Tween): Tween {
    if (this.dead) {
      t.kill();
      return t;
    }
    if (this.own.size > 256) this.prune();
    this.own.add(t);
    this.sink.register(t);
    t.begin();
    return t;
  }

  private prune(): void {
    for (const t of this.own) if (t.done) this.own.delete(t);
  }
}

/** Root tween manager — owned by the engine, advanced once per engine update. */
export class Tweens implements TweenSink {
  private active: Tween[] = [];
  /** Engine-level scope; chapters receive child scopes of it. */
  readonly root = new TweenScope(this);

  /** @internal */
  register(t: Tween): void {
    this.active.push(t);
  }

  /** Advance all tweens by `dt` seconds in creation order (deterministic). */
  update(dt: number): void {
    const list = this.active;
    const n = list.length; // tweens created during this update start advancing on the next one
    let alive = 0;
    for (let i = 0; i < n; i++) {
      const t = list[i]!;
      t.advance(dt);
      if (!t.done) list[alive++] = t;
    }
    for (let i = n; i < list.length; i++) list[alive++] = list[i]!;
    list.length = alive;
  }

  /** Total number of live tweens (debug stats). */
  get liveCount(): number {
    return this.active.length;
  }
}
