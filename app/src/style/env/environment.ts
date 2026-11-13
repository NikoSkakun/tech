/**
 * Environment = backdrop + light rig + fog of one world scene, driven by an `EnvParams` set.
 * The chapter runtime creates one per chapter from `manifest.theme.sky`; chapters reach it as `ctx.env`.
 */
import {
  AdditiveBlending,
  BackSide,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Sphere,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  Vector4,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import { OVERLAY_LAYER, worldBounds } from '@/engine/layers';
import { Rng } from '@/engine/random';
import { resolveEase, type EaseLike } from '@/engine/tween';
import type { QualityProfile } from '@/engine/quality';
import { col, type AccentName } from '../palette';
import { MOTION } from '../motion';
import { kGlobals, linkGlobals } from '../materials/globals';
import {
  cloneEnv,
  envKind,
  envPreset,
  lerpEnv,
  type EnvKind,
  type EnvOverrides,
  type EnvParams,
  type EnvPresetName,
} from './presets';
import {
  BOKEH_FRAGMENT,
  BOKEH_VERTEX,
  DOME_FRAGMENT,
  DOME_VERTEX,
  FLOOR_FRAGMENT,
  FLOOR_VERTEX,
  MOTES_FRAGMENT,
  MOTES_VERTEX,
} from './shaders';

/**
 * Subject radii (world units) at which the env presets and post moods were tuned — the F1 reference sandboxes.
 * Pass one as `setScale(r, { adaptFrom })` when a scene is built at another unit scale (kit models in metres).
 */
export const LOOK_SCALE = { studio: 3.4, micro: 6, diorama: 11 } as const;

export interface EnvironmentOptions {
  preset: EnvPresetName;
  /** Chapter accent: tints bokeh and rim so every chapter has its own flavour. */
  accent: AccentName;
  /**
   * Approximate radius of the subject in world units. Scales bokeh/mote volumes, the studio floor and the
   * default shadow frustum. Default 6.
   */
  scale?: number;
}

export interface ShadowSetup {
  /** Half-size of the orthographic shadow frustum in world units. */
  extent: number;
  /** Centre of the shadow frustum (world). Default origin. */
  center?: [number, number, number];
  /** Blur radius in shadow-map texels (softness). Default 3.5. */
  softness?: number;
}

export interface SetEnvOptions {
  /** Seconds; 0 = instant. Default `MOTION.mood`. */
  duration?: number;
  ease?: EaseLike;
}

/** Radius of the studio floor disc in units of the subject scale. */
const FLOOR_SCALE = 2.8;

const BOKEH_ACCENTS: AccentName[] = ['violet', 'blue', 'magenta', 'cyan', 'pink'];

export class Environment {
  /** Lights and backdrop objects live here (added to the scene by the constructor). */
  readonly group = new Group();
  readonly key: DirectionalLight;
  readonly fill: HemisphereLight;
  readonly kind: EnvKind;
  /** Current (possibly mid-blend) parameters. Read-only for chapters; change through `set()` / `tune()`. */
  readonly params: EnvParams;
  /** Mood grade consumed by the render pipeline's final pass (display-space colours). */
  readonly mood = {
    tint: new Color(1, 1, 1),
    tintAmount: 0,
    harmonyColor: new Color(1, 0.6, 0.3),
    harmony: 0,
    accentColor: new Color(1, 0.85, 0.3),
  };
  /** Rim values consumed by the render pipeline (→ `kGlobals`). */
  readonly rig = { rimColor: new Color(), rimDir: new Vector3(), lookScale: 1 };

  private readonly dome: Mesh<IcosahedronGeometry, ShaderMaterial>;
  private bokeh: InstancedMesh<PlaneGeometry, ShaderMaterial> | null = null;
  private motes: Points<BufferGeometry, ShaderMaterial> | null = null;
  private floor: Mesh<CircleGeometry, ShaderMaterial> | null = null;
  private readonly fog: FogExp2;
  private from: EnvParams;
  private to: EnvParams;
  private blend = 1;
  private blendDuration = 0;
  private blendEase = resolveEase(MOTION.mood.ease);
  private presetName: EnvPresetName;
  private baseOverrides: EnvOverrides = {};
  private scale: number;
  private look = 1;
  private readonly accent: AccentName;
  private shadow: Required<ShadowSetup>;
  private shadowMapSize = 2048;
  private grounding = { radius: 0, strength: 0 };
  private readonly viewDir = new Vector3(0, 0, -1);

  constructor(
    private readonly scene: Scene,
    opts: EnvironmentOptions,
    profile: QualityProfile,
  ) {
    this.presetName = opts.preset;
    this.accent = opts.accent;
    this.kind = envKind(opts.preset);
    this.scale = opts.scale ?? 6;
    this.params = this.resolve(opts.preset);
    this.from = cloneEnv(this.params);
    this.to = cloneEnv(this.params);
    this.shadow = { extent: this.scale * 1.6, center: [0, 0, 0], softness: 3.5 };
    this.group.name = 'environment';

    this.dome = new Mesh(
      new IcosahedronGeometry(1, 4),
      new ShaderMaterial({
        vertexShader: DOME_VERTEX,
        fragmentShader: DOME_FRAGMENT,
        defines: this.kind === 'space' ? { ENV_SPACE: '' } : this.kind === 'studio' ? { ENV_STUDIO: '' } : {},
        uniforms: {
          uTop: { value: new Color() },
          uMid: { value: new Color() },
          uBottom: { value: new Color() },
          uHorizon: { value: new Vector2() },
          uSunDir: { value: new Vector3() },
          uSunColor: { value: new Color() },
          uSun: { value: new Vector4() },
          uStars: { value: 0 },
          uClouds: { value: 0 },
          uCloudColor: { value: new Color() },
          uCloudColorB: { value: new Color() },
          uSilhouettes: { value: 0 },
          uSilhouetteColor: { value: new Color() },
          uViewDir: { value: this.viewDir },
          uKTime: kGlobals.uKTime,
        },
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    this.dome.name = 'env-dome';
    this.dome.frustumCulled = false;
    this.dome.renderOrder = 1000; // after all opaque geometry: early-z rejects hidden sky pixels
    this.dome.matrixAutoUpdate = false;
    this.group.add(this.dome);

    this.key = new DirectionalLight(0xffffff, 1);
    this.key.name = 'env-key';
    this.key.castShadow = true;
    this.group.add(this.key, this.key.target);
    this.fill = new HemisphereLight(0xffffff, 0xffffff, 1);
    this.fill.name = 'env-fill';
    // lit materials on the overlay layer (labels, markers) see the same rig
    this.key.layers.enable(OVERLAY_LAYER);
    this.fill.layers.enable(OVERLAY_LAYER);
    this.group.add(this.fill);

    this.fog = new FogExp2(0x000000, 0);
    scene.fog = this.fog;
    this.buildParticles(profile);
    if (this.kind === 'studio') this.buildFloor();
    scene.add(this.group);
    this.setQuality(profile);
    this.apply();
  }

  /** Name of the preset last targeted with `set()`. */
  get preset(): EnvPresetName {
    return this.presetName;
  }

  /**
   * Blend to another preset of the same backdrop kind (e.g. `day` → `dusk`), optionally with overrides.
   * Interruption-safe: starts from whatever the current blended state is.
   */
  set(preset: EnvPresetName, opts: SetEnvOptions & { overrides?: EnvOverrides } = {}): void {
    if (envKind(preset) !== this.kind) {
      throw new Error(
        `Environment: cannot blend from a '${this.kind}' backdrop to preset '${preset}' (${envKind(preset)}). ` +
          'The backdrop kind is fixed per chapter (manifest.theme.sky).',
      );
    }
    this.presetName = preset;
    this.blendTo(this.resolve(preset, opts.overrides), opts);
  }

  /** Blend individual parameters of the current target (colours as tokens), keeping the rest. */
  tune(overrides: EnvOverrides, opts: SetEnvOptions = {}): void {
    this.blendTo(this.resolve(this.presetName, overrides), opts);
  }

  /**
   * Chapter-level look tuning that survives every `set()` / `tune()` / step change (M3): the overrides are
   * layered under whatever a step asks for (`StepSpec.envTune`, `set(…, { overrides })`, `tune()`), so a deep
   * link and a sequential entry give the same look. Call once in the scene factory; a later call replaces the
   * base. Applied instantly by default (factory time).
   */
  base(overrides: EnvOverrides, opts: SetEnvOptions = {}): void {
    this.baseOverrides = { ...overrides };
    this.blendTo(this.resolve(this.presetName), { duration: 0, ...opts });
  }

  /** The overrides installed with `base()` (empty by default). */
  get baseTune(): Readonly<EnvOverrides> {
    return this.baseOverrides;
  }

  /** Configure the key-light shadow frustum to fit the subject. */
  setShadow(setup: ShadowSetup): void {
    this.shadow = {
      extent: setup.extent,
      center: setup.center ?? [0, 0, 0],
      softness: setup.softness ?? 3.5,
    };
    this.applyShadow();
  }

  /**
   * `studio` floor only: soft contact shadow under the subject. `radius` = footprint radius of whatever
   * stands on the floor (world units), `strength` 0…1 (default 0.55). Complements the shadow map, which cannot
   * ground low, wide bases.
   */
  setGrounding(radius: number, strength = 0.55): void {
    this.grounding = { radius, strength };
    this.applyGrounding();
  }

  /** Factor applied to world-unit look parameters (1 unless `setScale(…, { adaptFrom })`). */
  get lookScale(): number {
    return this.look;
  }

  /** Approximate subject radius in world units (see `setScale`). */
  get subjectScale(): number {
    return this.scale;
  }

  /**
   * Fit the key-light shadow frustum around an object (its world bounding sphere × `padding`). The tighter the
   * fit, the crisper and better grounded the shadows of small props — call it once the scene is built.
   */
  fitShadow(object: Object3D, padding = 1.1, softness = 3): void {
    const box = worldBounds(object, new Box3());
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new Sphere());
    this.setShadow({
      extent: Math.max(sphere.radius * padding, 1e-3),
      center: [sphere.center.x, sphere.center.y, sphere.center.z],
      softness,
    });
  }

  /**
   * Change the subject scale (bokeh/mote volume, floor radius, shadow-fit default, DOF close-up reference).
   *
   * `adaptFrom` (M1): the subject radius the look was tuned at (`LOOK_SCALE.micro / studio / diorama`). When
   * given, the world-unit look parameters follow the scale: fog density ÷ k, AO radius and DOF sharp range × k,
   * with k = scale / adaptFrom — so a scene built in metres (kit models: a 60 m island) looks like the reference
   * diorama instead of fogging out. Without it (default) only the items above change, as before.
   */
  setScale(scale: number, opts: { adaptFrom?: number } = {}): void {
    this.scale = scale;
    this.look = opts.adaptFrom !== undefined && opts.adaptFrom > 0 ? scale / opts.adaptFrom : 1;
    this.rig.lookScale = this.look;
    this.fog.density = this.params.fogDensity / this.look;
    if (this.bokeh) this.bokeh.material.uniforms.uScale!.value = scale;
    if (this.motes) this.motes.material.uniforms.uScale!.value = scale;
    if (this.floor) this.floor.scale.setScalar(scale * FLOOR_SCALE);
    this.applyGrounding();
  }

  /** @internal Quality tier changed. */
  setQuality(profile: QualityProfile): void {
    this.shadowMapSize = profile.shadowMapSize;
    this.key.castShadow = profile.shadowMapSize > 0;
    if (profile.shadowMapSize > 0 && this.key.shadow.mapSize.x !== profile.shadowMapSize) {
      this.key.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
    }
    this.applyShadow();
  }

  /** @internal Called once per frame by the runtime. */
  update(dt: number, camera: PerspectiveCamera, target: Vector3, viewportHeightPx: number): void {
    if (this.blend < 1) {
      this.blend = this.blendDuration <= 0 ? 1 : Math.min(1, this.blend + dt / this.blendDuration);
      lerpEnv(this.from, this.to, this.blendEase(this.blend), this.params);
      this.apply();
    }
    camera.getWorldDirection(this.viewDir);
    if (this.motes) {
      const u = this.motes.material.uniforms;
      (u.uCenter!.value as Vector3).copy(target);
      // perspective point size: px = size · projectionScale · viewportHeight / distance
      u.uPixelScale!.value = 0.5 * viewportHeightPx * camera.projectionMatrix.elements[5]!;
    }
  }

  dispose(): void {
    this.scene.remove(this.group);
    if (this.scene.fog === this.fog) this.scene.fog = null;
    this.dome.geometry.dispose();
    this.dome.material.dispose();
    this.bokeh?.geometry.dispose();
    this.bokeh?.material.dispose();
    this.bokeh?.dispose();
    this.motes?.geometry.dispose();
    this.motes?.material.dispose();
    this.floor?.geometry.dispose();
    this.floor?.material.dispose();
    this.key.dispose();
    this.fill.dispose();
  }

  private resolve(preset: EnvPresetName, stepOverrides: EnvOverrides = {}): EnvParams {
    const overrides = { ...this.baseOverrides, ...stepOverrides };
    const p = envPreset(preset, overrides);
    // a touch of the chapter accent in the rim light ties the lighting to the chapter's colour identity
    if (overrides.rimColor === undefined) p.rimColor.lerp(col(this.accent), 0.25);
    return p;
  }

  private blendTo(target: EnvParams, opts: SetEnvOptions): void {
    const duration = opts.duration ?? MOTION.mood.duration;
    this.to = target;
    if (duration <= 0) {
      lerpEnv(target, target, 1, this.params);
      this.blend = 1;
      this.apply();
      return;
    }
    this.from = cloneEnv(this.params);
    this.blend = 0;
    this.blendDuration = duration;
    this.blendEase = resolveEase(opts.ease ?? MOTION.mood.ease);
  }

  private apply(): void {
    const p = this.params;
    const u = this.dome.material.uniforms;
    (u.uTop!.value as Color).copy(p.top);
    (u.uMid!.value as Color).copy(p.mid);
    (u.uBottom!.value as Color).copy(p.bottom);
    (u.uHorizon!.value as Vector2).set(p.horizon, Math.max(p.horizonWidth, 0.02));
    (u.uSunDir!.value as Vector3).copy(p.sunDir);
    (u.uSunColor!.value as Color).copy(p.sunColor);
    (u.uSun!.value as Vector4).set(p.sunSize, p.sunGlow, 0, 0);
    u.uStars!.value = p.stars;
    u.uClouds!.value = p.clouds;
    (u.uCloudColor!.value as Color).copy(p.cloudColor);
    (u.uCloudColorB!.value as Color).copy(p.cloudColorB);
    u.uSilhouettes!.value = p.silhouettes;
    (u.uSilhouetteColor!.value as Color).copy(p.silhouetteColor);

    this.key.color.copy(p.keyColor);
    this.key.intensity = p.keyIntensity;
    this.key.shadow.intensity = p.shadowStrength;
    this.fill.color.copy(p.fillSky);
    this.fill.groundColor.copy(p.fillGround);
    this.fill.intensity = p.fillIntensity;
    this.rig.rimColor.copy(p.rimColor).multiplyScalar(p.rimIntensity);
    this.rig.rimDir.copy(p.rimDir);
    // the grade works in display space: hand it sRGB-encoded hue references
    this.mood.tint.copy(p.gradeTint); // already a display-space multiplier
    this.mood.tintAmount = p.gradeTintAmount;
    this.mood.harmonyColor.copy(p.harmonyColor).convertLinearToSRGB();
    this.mood.harmony = p.harmony;
    this.mood.accentColor.copy(p.accentColor).convertLinearToSRGB();
    this.fog.color.copy(p.fogColor);
    this.fog.density = p.fogDensity / this.look; // exp² fog: distances × k ⇔ density ÷ k
    if (this.bokeh) {
      this.bokeh.material.uniforms.uAmount!.value = p.bokeh;
      this.bokeh.visible = p.bokeh > 0.002;
    }
    if (this.motes) {
      this.motes.material.uniforms.uAmount!.value = p.motes;
      (this.motes.material.uniforms.uColor!.value as Color).copy(p.moteColor);
      this.motes.visible = p.motes > 0.002;
    }
    if (this.floor) {
      this.floor.material.uniforms.uFloor!.value = p.floor;
      (this.floor.material.uniforms.uFloorColor!.value as Color).copy(p.floorColor);
      this.floor.visible = p.floor > 0.002;
    }
    this.applyShadow();
  }

  private applyGrounding(): void {
    if (!this.floor) return;
    (this.floor.material.uniforms.uContact!.value as Vector3).set(
      this.grounding.radius / (this.scale * FLOOR_SCALE),
      this.grounding.strength,
      0,
    );
  }

  private applyShadow(): void {
    const { extent, center, softness } = this.shadow;
    const c = new Vector3(center[0], center[1], center[2]);
    this.key.target.position.copy(c);
    this.key.position.copy(c).addScaledVector(this.params.sunDir, extent * 3);
    this.key.target.updateMatrixWorld();
    const cam = this.key.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 0.1;
    cam.far = extent * 6;
    cam.updateProjectionMatrix();
    const texel = (2 * extent) / Math.max(this.shadowMapSize, 1);
    this.key.shadow.radius = softness;
    // biases scale with the world size of a shadow texel, so acne/peter-panning stay away at any scene scale
    // Offsets of about one shadow texel: enough against acne, small enough that thin props (lamp posts,
    // fences) keep a shadow that touches their base instead of floating away ("peter-panning").
    this.key.shadow.bias = (-texel * 0.5) / (extent * 6);
    this.key.shadow.normalBias = texel * 1.1;
  }

  private buildParticles(profile: QualityProfile): void {
    const rng = new Rng(`env:${this.presetName}`);
    if (this.kind !== 'sky') {
      const count = Math.max(8, Math.round(46 * profile.particles));
      const mat = new ShaderMaterial({
        vertexShader: BOKEH_VERTEX,
        fragmentShader: BOKEH_FRAGMENT,
        uniforms: { uKTime: kGlobals.uKTime, uScale: { value: this.scale }, uAmount: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      });
      const mesh = new InstancedMesh(new PlaneGeometry(1, 1), mat, count);
      const seed = new Float32Array(count * 4);
      const color = new Float32Array(count * 3);
      const m = new Matrix4();
      const palette = [this.accent, ...BOKEH_ACCENTS];
      for (let i = 0; i < count; i++) {
        // a shell well behind/around the subject, biased away from the vertical poles
        const [x, y, z] = rng.onSphere();
        const radius = rng.range(4.5, 11);
        m.makeTranslation(x * radius, y * radius * 0.6, z * radius);
        mesh.setMatrixAt(i, m);
        seed.set(
          [rng.range(0, 6.28), rng.range(0.03, 0.12), rng.range(0.35, 1.5), rng.range(0.03, 0.12)],
          i * 4,
        );
        const c = col(rng.pick(palette));
        color.set([c.r, c.g, c.b], i * 3);
      }
      // instance transforms are in units of `scale`
      mesh.scale.setScalar(this.scale);
      mesh.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seed, 4));
      mesh.geometry.setAttribute('aColor', new InstancedBufferAttribute(color, 3));
      mesh.frustumCulled = false;
      mesh.name = 'env-bokeh';
      mesh.renderOrder = 1001;
      this.bokeh = mesh;
      this.group.add(mesh);
    }
    const count = Math.max(24, Math.round(260 * profile.particles));
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos.set([rng.signed(), rng.signed(), rng.signed()], i * 3);
      seed.set([rng.next(), rng.next(), rng.range(0.012, 0.05), rng.range(0.25, 1)], i * 4);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(pos, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));
    const motes = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: MOTES_VERTEX,
        fragmentShader: MOTES_FRAGMENT,
        uniforms: {
          uKTime: kGlobals.uKTime,
          uScale: { value: this.scale },
          uAmount: { value: 1 },
          uPixelScale: { value: 500 },
          uCenter: { value: new Vector3() },
          uColor: { value: new Color() },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      }),
    );
    motes.frustumCulled = false;
    motes.name = 'env-motes';
    motes.renderOrder = 1002;
    this.motes = motes;
    this.group.add(motes);
  }

  private buildFloor(): void {
    const uniforms = UniformsUtils.merge([
      UniformsLib.lights,
      UniformsLib.fog,
      {
        opacity: { value: 1 },
        uFade: { value: 1 },
        uFloorColor: { value: new Color() },
        uFloor: { value: 1 },
        uContact: { value: new Vector3(0, 0, 0) },
        uBand: { value: new Vector4(0, 0.2, 2, 0) },
        uRim: { value: new Vector3(0, 0.6, 0.1) },
      },
    ]);
    linkGlobals(uniforms);
    const material = new ShaderMaterial({
      vertexShader: FLOOR_VERTEX,
      fragmentShader: FLOOR_FRAGMENT,
      uniforms,
      lights: true,
      fog: true,
      transparent: true,
      depthWrite: true,
    });
    const floor = new Mesh(new CircleGeometry(1, 96), material);
    floor.rotation.x = -Math.PI / 2;
    floor.scale.setScalar(this.scale * FLOOR_SCALE);
    floor.receiveShadow = true;
    floor.name = 'env-floor';
    floor.renderOrder = -10;
    this.floor = floor;
    this.group.add(floor);
  }
}
