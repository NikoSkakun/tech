/**
 * Stage — the declarative step-state helper (ARCHITECTURE §3: "random access is mandatory").
 *
 * A chapter registers the things that differ between steps:
 *   - actors  — objects that are shown or hidden (animated appear/disappear),
 *   - params  — named numbers (simulation parameters, blend factors, intensities),
 *   - colors  — named colours,
 *   - poses   — named object transforms,
 * and then describes every step as a complete target state. Whatever a step does not mention returns to its
 * default (actors: hidden; params/colors/poses: the value they were registered with; camera/env/post: the
 * chapter defaults). Entering a step tweens everything from its *current* value toward the step's target, so
 * any step can be entered from any other step, from nothing (deep link), or in the middle of another
 * transition — there is no "previous step" to depend on.
 */
import { type Color, Quaternion, Vector3, type Object3D } from 'three';
import { col, type ColorLike } from '@/style/palette';
import { MOTION, STAGGER } from '@/style/motion';
import type { EnvOverrides, EnvPresetName } from '@/style/env/presets';
import type { MoveOptions, Shot } from './camera/director';
import type { StepInfo } from './chapter';
import type { PostOverrides } from './pipeline/post-params';
import type { EaseLike, Tween, TweenScope } from './tween';

/** How an actor appears/disappears. */
export type AppearMode =
  /** Scale up with overshoot (`back.out`), scale down fast. The default (STYLE_GUIDE §5). */
  | 'pop'
  /** Like `pop` but only along Y — things that rise from the ground. */
  | 'grow'
  /** Dissolve: drives `fade` of K materials / `Text3D` under the object. */
  | 'fade'
  /** No animation: just toggles `visible`. */
  | 'none';

export interface ActorOptions {
  appear?: AppearMode | ((object: Object3D, value: number) => void);
  /** Seconds for showing. Default `MOTION.appear.duration`. */
  inDuration?: number;
  /** Seconds for hiding. Default `MOTION.disappear.duration`. */
  outDuration?: number;
}

interface Fadable {
  fade: number;
}

function collectFadables(object: Object3D): Fadable[] {
  const out = new Set<Fadable>();
  object.traverse((o) => {
    const self = o as unknown as Partial<Fadable>;
    if (typeof self.fade === 'number') {
      out.add(self as Fadable);
      return;
    }
    const material = (o as unknown as { material?: unknown }).material;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of list) if (typeof (m as Partial<Fadable>).fade === 'number') out.add(m as Fadable);
  });
  return [...out];
}

/** An object whose visibility is controlled by the stage. */
export class Actor {
  /** Current visibility 0…1 (may overshoot slightly above 1 during `pop`). */
  value = 0;
  /** @internal */
  target = 0;
  /** @internal */
  tween: Tween | null = null;
  /**
   * @internal The object's scale when fully shown. `pop` / `grow` actors own `object.scale` (scale = base × value),
   * so a stage pose of the same object writes its scale here instead of fighting the actor (M3).
   */
  readonly baseScale = new Vector3();
  private readonly fadables: Fadable[];
  private readonly mode: AppearMode | ((object: Object3D, value: number) => void);
  readonly inDuration: number;
  readonly outDuration: number;

  constructor(
    readonly object: Object3D,
    opts: ActorOptions = {},
  ) {
    this.mode = opts.appear ?? 'pop';
    this.inDuration = opts.inDuration ?? MOTION.appear.duration;
    this.outDuration = opts.outDuration ?? MOTION.disappear.duration;
    this.baseScale.copy(object.scale);
    this.fadables = this.mode === 'fade' ? collectFadables(object) : [];
    this.apply();
  }

  /** True when the actor is (or is becoming) visible in the current step. */
  get shown(): boolean {
    return this.target > 0.5;
  }

  /** True for `pop` / `grow`: the actor writes `object.scale` (see `baseScale`). */
  get ownsScale(): boolean {
    return this.mode === 'pop' || this.mode === 'grow';
  }

  /** @internal Write `value` to the object. */
  apply(): void {
    const v = this.value;
    const o = this.object;
    o.visible = v > 0.001;
    const mode = this.mode;
    if (typeof mode === 'function') mode(o, v);
    else if (mode === 'pop') o.scale.copy(this.baseScale).multiplyScalar(Math.max(v, 1e-4));
    else if (mode === 'grow')
      o.scale.set(this.baseScale.x, this.baseScale.y * Math.max(v, 1e-4), this.baseScale.z);
    else if (mode === 'fade') for (const f of this.fadables) f.fade = Math.min(Math.max(v, 0), 1);
  }
}

/** A named number tweened per step. Read `.value` in `update()`, or pass `onChange`. */
export class Param {
  value: number;
  /** @internal */
  tween: Tween | null = null;
  constructor(
    readonly name: string,
    readonly initial: number,
    readonly duration: number | undefined,
    readonly ease: EaseLike | undefined,
    readonly onChange: ((value: number) => void) | undefined,
  ) {
    this.value = initial;
  }
}

/** A named colour tweened per step (`.value` is a live `THREE.Color` — bind it to a uniform once). */
export class ColorParam {
  readonly value: Color;
  readonly initial: Color;
  /** @internal */
  tween: Tween | null = null;
  constructor(
    readonly name: string,
    initial: ColorLike,
    readonly onChange: ((value: Color) => void) | undefined,
  ) {
    this.initial = col(initial);
    this.value = this.initial.clone();
  }
}

export interface PoseSpec {
  position?: readonly [number, number, number];
  /** Euler angles in radians, XYZ order. */
  rotation?: readonly [number, number, number];
  scale?: number | readonly [number, number, number];
}

class PoseHandle {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly scale: Vector3;
  tween: Tween | null = null;
  constructor(
    readonly object: Object3D,
    scale: Vector3,
  ) {
    this.position = object.position.clone();
    this.quaternion = object.quaternion.clone();
    this.scale = scale.clone();
  }
}

/** Complete target state of one step. Everything omitted returns to its default. */
export interface StepSpec {
  /** Actors (or objects registered as actors) visible in this step. All other actors are hidden. */
  show?: readonly (Actor | Object3D)[];
  /** Targets for named params; unspecified params return to their initial value. */
  params?: Readonly<Record<string, number>>;
  colors?: Readonly<Record<string, ColorLike>>;
  poses?: Readonly<Record<string, PoseSpec>>;
  /** Camera shot (name registered with `ctx.camera.shots()` or inline). Specify one for every step. */
  camera?: string | Shot;
  cameraMove?: MoveOptions;
  /** Environment preset for this step (same backdrop kind as the chapter's). Default: `manifest.theme.sky`. */
  env?: EnvPresetName;
  /**
   * Per-step environment overrides on top of `env` and the chapter base (`ctx.env.base()`); omitted = none.
   * Applied on every entry (deep link included), so the look never depends on the previous step (M3).
   */
  envTune?: EnvOverrides;
  /** Post overrides for this step, on top of mood + chapter base. */
  post?: PostOverrides;
  /** Duration for param / colour / pose changes in this step. Default `MOTION.state`. */
  duration?: number;
  ease?: EaseLike;
  /** Imperative extras, after the declarative state was applied. Use `info.scope` for sequences. */
  enter?(info: StepInfo): void;
  /** Called when the step is left (before the next step is applied). */
  leave?(): void;
}

/** Services the stage drives. All optional so the helper is unit-testable without WebGL. */
export interface StageDeps {
  tweens: TweenScope;
  camera?: { go(shot: string | Shot, opts?: MoveOptions): void };
  env?: {
    set(preset: EnvPresetName, opts?: { duration?: number; overrides?: EnvOverrides }): void;
    readonly preset: EnvPresetName;
  };
  post?: { apply(overrides?: PostOverrides, opts?: { duration?: number; instant?: boolean }): void };
  /** Environment preset used by steps that do not name one. */
  defaultEnv?: EnvPresetName;
}

const _q = new Quaternion();
const _e = new Vector3();

export class Stage {
  private readonly actorList: Actor[] = [];
  private readonly actorByObject = new Map<Object3D, Actor>();
  private readonly params = new Map<string, Param>();
  private readonly colors = new Map<string, ColorParam>();
  private readonly poses = new Map<string, PoseHandle>();
  private steps: Record<string, StepSpec> = {};
  private currentId: string | null = null;
  private stepScope: TweenScope | null = null;
  private envTuneKey = '';
  private readonly own: TweenScope;

  constructor(private readonly deps: StageDeps) {
    this.own = deps.tweens.scope();
  }

  /** Step currently applied (null before the first `apply`). */
  get current(): string | null {
    return this.currentId;
  }

  /**
   * Tween / timer scope of the *current* step (the same object as `info.scope` in `enter`). Use it in control
   * handlers and other code that runs later inside a step: everything started here is killed when the step is
   * left, so a delayed tween of a button never fires in the next step (M3). Read it at call time — do not
   * cache it across steps.
   */
  get scope(): TweenScope {
    return (this.stepScope ??= this.own.scope());
  }

  /**
   * Sub-state inside a step: show / hide an actor (animated like a step change) because a control asked for
   * it. The override lasts until the next step is entered, which restores the declared `show` list — no
   * `leave()` clean-up needed. `shown` omitted = toggle. Objects not yet registered become `pop` actors (hidden
   * in every step that does not list them). Returns the new state.
   */
  toggle(item: Actor | Object3D, shown?: boolean, opts: { instant?: boolean } = {}): boolean {
    const actor = item instanceof Actor ? item : this.actor(item);
    const target = (shown ?? !actor.shown) ? 1 : 0;
    actor.tween?.kill();
    actor.tween = null;
    actor.target = target;
    if (opts.instant) {
      actor.value = target;
      actor.apply();
    } else this.animateActor(actor, target, 0);
    return target === 1;
  }

  /** True if the actor (or registered object) is shown or appearing. */
  shown(item: Actor | Object3D): boolean {
    const actor = item instanceof Actor ? item : this.actorByObject.get(item);
    return actor?.shown ?? false;
  }

  /**
   * Sub-state inside a step: tween a registered param because a control asked for it (the sanctioned way —
   * never tween `param.value` yourself). Reverts to the step's declared value on the next step entry.
   */
  setParam(
    name: string,
    value: number,
    opts: { duration?: number; ease?: EaseLike; instant?: boolean } = {},
  ): void {
    const p = this.params.get(name);
    if (!p) throw new Error(`Stage: unknown param '${name}'`);
    p.tween?.kill();
    p.tween = null;
    if (opts.instant || p.value === value) {
      p.value = value;
      p.onChange?.(value);
      return;
    }
    p.tween = this.own.to(
      p,
      { value },
      {
        duration: opts.duration ?? p.duration ?? MOTION.state.duration,
        ease: opts.ease ?? p.ease ?? MOTION.state.ease,
        onUpdate: () => p.onChange?.(p.value),
      },
    );
  }

  /** Sub-state inside a step for a registered colour (see `setParam`). */
  setColor(name: string, value: ColorLike, opts: { duration?: number; instant?: boolean } = {}): void {
    const c = this.colors.get(name);
    if (!c) throw new Error(`Stage: unknown color '${name}'`);
    const target = col(value);
    c.tween?.kill();
    c.tween = null;
    if (opts.instant) {
      c.value.copy(target);
      c.onChange?.(c.value);
      return;
    }
    c.tween = this.own.to(
      c.value,
      { r: target.r, g: target.g, b: target.b },
      {
        duration: opts.duration ?? MOTION.state.duration,
        ease: MOTION.state.ease,
        onUpdate: () => c.onChange?.(c.value),
      },
    );
  }

  private animateActor(actor: Actor, target: number, delay: number): void {
    actor.tween = this.own.to(
      actor,
      { value: target },
      target === 1
        ? {
            duration: actor.inDuration,
            ease: MOTION.appear.ease,
            delay,
            onUpdate: () => actor.apply(),
            onComplete: () => (actor.tween = null),
          }
        : {
            duration: actor.outDuration,
            ease: MOTION.disappear.ease,
            onUpdate: () => actor.apply(),
            onComplete: () => (actor.tween = null),
          },
    );
  }

  /** Register an object whose visibility depends on the step. Actors start hidden. */
  actor(object: Object3D, opts?: ActorOptions): Actor {
    const existing = this.actorByObject.get(object);
    if (existing) return existing;
    const actor = new Actor(object, opts);
    this.actorList.push(actor);
    this.actorByObject.set(object, actor);
    return actor;
  }

  /** Register several actors with the same options. */
  actors(objects: readonly Object3D[], opts?: ActorOptions): Actor[] {
    return objects.map((o) => this.actor(o, opts));
  }

  /** Register a named number with its default value. */
  param(
    name: string,
    initial: number,
    opts: { duration?: number; ease?: EaseLike; onChange?: (value: number) => void } = {},
  ): Param {
    if (this.params.has(name)) throw new Error(`Stage: param '${name}' is already registered`);
    const p = new Param(name, initial, opts.duration, opts.ease, opts.onChange);
    this.params.set(name, p);
    opts.onChange?.(initial);
    return p;
  }

  /** Register a named colour with its default value. */
  color(name: string, initial: ColorLike, opts: { onChange?: (value: Color) => void } = {}): ColorParam {
    if (this.colors.has(name)) throw new Error(`Stage: color '${name}' is already registered`);
    const c = new ColorParam(name, initial, opts.onChange);
    this.colors.set(name, c);
    opts.onChange?.(c.value);
    return c;
  }

  /** Register an object whose transform depends on the step; its current transform becomes the default pose. */
  pose(name: string, object: Object3D): void {
    if (this.poses.has(name)) throw new Error(`Stage: pose '${name}' is already registered`);
    // an actor registered first has already shrunk the object to "hidden": its full-size scale is the default
    const actor = this.actorByObject.get(object);
    this.poses.set(name, new PoseHandle(object, actor?.ownsScale ? actor.baseScale : object.scale));
  }

  /**
   * Describe every step. Objects listed in `show` are auto-registered as `pop` actors if they were not
   * registered explicitly. Names used in `params` / `colors` / `poses` must have been registered.
   */
  define(steps: Record<string, StepSpec>): void {
    for (const [id, spec] of Object.entries(steps)) {
      for (const item of spec.show ?? []) if (!(item instanceof Actor)) this.actor(item);
      for (const name of Object.keys(spec.params ?? {})) {
        if (!this.params.has(name)) throw new Error(`Stage: step '${id}' uses unknown param '${name}'`);
      }
      for (const name of Object.keys(spec.colors ?? {})) {
        if (!this.colors.has(name)) throw new Error(`Stage: step '${id}' uses unknown color '${name}'`);
      }
      for (const name of Object.keys(spec.poses ?? {})) {
        if (!this.poses.has(name)) throw new Error(`Stage: step '${id}' uses unknown pose '${name}'`);
      }
    }
    this.steps = { ...this.steps, ...steps };
  }

  /** True if at least one step was defined (chapters may also handle steps fully by hand). */
  get hasSteps(): boolean {
    return Object.keys(this.steps).length > 0;
  }

  /** Throw if the defined steps do not match the manifest (called by the runtime after `init`). */
  validate(stepIds: readonly string[], chapterId: string): void {
    if (!this.hasSteps) return;
    const missing = stepIds.filter((id) => !(id in this.steps));
    const extra = Object.keys(this.steps).filter((id) => !stepIds.includes(id));
    if (missing.length || extra.length) {
      throw new Error(
        `Stage(${chapterId}): step definitions do not match the manifest` +
          (missing.length ? ` — missing: ${missing.join(', ')}` : '') +
          (extra.length ? ` — not in manifest: ${extra.join(', ')}` : ''),
      );
    }
  }

  /** @internal Apply a step's target state. Called by the chapter runtime. */
  apply(stepId: string, info: Omit<StepInfo, 'scope'>): StepInfo {
    const spec = this.steps[stepId] ?? {};
    const previous = this.currentId !== null ? this.steps[this.currentId] : undefined;
    previous?.leave?.();
    this.stepScope?.dispose();
    this.stepScope = this.own.scope();
    this.currentId = stepId;
    const full: StepInfo = { ...info, scope: this.stepScope };
    const instant = info.instant;
    const duration = spec.duration ?? MOTION.state.duration;
    const ease = spec.ease ?? MOTION.state.ease;

    // actors
    const visible = new Set<Actor>();
    for (const item of spec.show ?? []) {
      const actor = item instanceof Actor ? item : this.actorByObject.get(item);
      if (actor) visible.add(actor);
    }
    let appearing = 0;
    for (const actor of this.actorList) {
      const target = visible.has(actor) ? 1 : 0;
      if (instant) {
        actor.tween?.kill();
        actor.tween = null;
        actor.target = target;
        actor.value = target;
        actor.apply();
        continue;
      }
      if (actor.target === target && (actor.tween !== null || Math.abs(actor.value - target) < 1e-4))
        continue;
      actor.target = target;
      actor.tween?.kill();
      this.animateActor(actor, target, target === 1 ? Math.min(appearing++ * STAGGER, 0.6) : 0);
    }

    // params
    for (const p of this.params.values()) {
      const target = spec.params?.[p.name] ?? p.initial;
      p.tween?.kill();
      p.tween = null;
      if (instant) {
        p.value = target;
        p.onChange?.(target);
      } else if (p.value !== target) {
        p.tween = this.own.to(
          p,
          { value: target },
          { duration: p.duration ?? duration, ease: p.ease ?? ease, onUpdate: () => p.onChange?.(p.value) },
        );
      }
    }

    // colours
    for (const c of this.colors.values()) {
      const target = spec.colors?.[c.name] !== undefined ? col(spec.colors[c.name]!) : c.initial;
      c.tween?.kill();
      c.tween = null;
      if (instant) {
        c.value.copy(target);
        c.onChange?.(c.value);
      } else {
        c.tween = this.own.to(
          c.value,
          { r: target.r, g: target.g, b: target.b },
          { duration, ease, onUpdate: () => c.onChange?.(c.value) },
        );
      }
    }

    // poses
    for (const [name, h] of this.poses) {
      const s = spec.poses?.[name];
      const pos = s?.position ? _e.set(s.position[0], s.position[1], s.position[2]).clone() : h.position;
      const quat = s?.rotation
        ? new Quaternion().setFromEuler(
            h.object.rotation.clone().set(s.rotation[0], s.rotation[1], s.rotation[2]),
          )
        : h.quaternion;
      const scale =
        s?.scale === undefined
          ? h.scale
          : typeof s.scale === 'number'
            ? new Vector3(s.scale, s.scale, s.scale)
            : new Vector3(s.scale[0], s.scale[1], s.scale[2]);
      h.tween?.kill();
      h.tween = null;
      const o = h.object;
      // a pop / grow actor owns object.scale (scale = base × visibility): the pose scales its base instead
      const actor = this.actorByObject.get(o);
      const owner = actor?.ownsScale ? actor : null;
      const scaleOut = owner ? owner.baseScale : o.scale;
      if (instant) {
        o.position.copy(pos);
        o.quaternion.copy(quat);
        scaleOut.copy(scale);
        owner?.apply();
        continue;
      }
      const fromP = o.position.clone();
      const fromQ = o.quaternion.clone();
      const fromS = scaleOut.clone();
      const toP = pos.clone();
      const toQ = quat.clone();
      const toS = scale.clone();
      h.tween = this.own.value(0, 1, { duration, ease }, (k) => {
        o.position.lerpVectors(fromP, toP, k);
        o.quaternion.copy(_q.copy(fromQ).slerp(toQ, k));
        scaleOut.lerpVectors(fromS, toS, k);
        owner?.apply();
      });
    }

    // camera, environment, post
    if (spec.camera !== undefined)
      this.deps.camera?.go(spec.camera, { ...spec.cameraMove, instant: instant || spec.cameraMove?.instant });
    const env = spec.env ?? this.deps.defaultEnv;
    if (env !== undefined && this.deps.env) {
      // envTune: re-applied whenever it differs from what the stage applied last; with no step using it this
      // is exactly the old behaviour (set on instant entries and preset changes only)
      const tuneKey = spec.envTune ? JSON.stringify(spec.envTune) : '';
      const overrides = spec.envTune ? { overrides: spec.envTune } : {};
      if (instant) this.deps.env.set(env, { duration: 0, ...overrides });
      else if (this.deps.env.preset !== env || tuneKey !== this.envTuneKey)
        this.deps.env.set(env, overrides);
      this.envTuneKey = tuneKey;
    }
    this.deps.post?.apply(spec.post ?? {}, { instant });

    spec.enter?.(full);
    return full;
  }

  /** @internal */
  dispose(): void {
    if (this.currentId !== null) this.steps[this.currentId]?.leave?.();
    this.own.dispose();
    this.actorList.length = 0;
    this.actorByObject.clear();
    this.params.clear();
    this.colors.clear();
    this.poses.clear();
    this.steps = {};
  }
}
