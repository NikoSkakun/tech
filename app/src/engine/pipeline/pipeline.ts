/**
 * Render pipeline (ARCHITECTURE §4, STYLE_GUIDE §4).
 *
 *   world scene ──► rtScene (MSAA, RGBA16F linear HDR, depth texture)
 *                    ├─► AO (depth only, half-res, bilateral blur)
 *                    └─► prep (colour × tinted AO, alpha = signed circle of confusion)
 *                          └─► DOF / tilt-shift ──► [transition mix with frozen frame] ──► rtHud
 *   HUD scene (own camera) ───────────────────────────────────────────────────────────────► rtHud (MSAA, on top)
 *   rtHud ─► bloom mips ─► final (bloom, display transform, grade, vignette, grain, sRGB) ─► FXAA ─► canvas
 *
 * So the HUD receives bloom, grade and grain, but is never blurred by depth of field.
 * Everything before the final pass is linear HDR; only values above 1 (emissive / K.glow) feed bloom.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DepthStencilFormat,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PCFShadowMap,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedInt248Type,
  UnsignedIntType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type PerspectiveCamera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { col } from '@/style/palette';
import { kGlobals } from '@/style/materials/globals';
import { OVERLAY_LAYER, WORLD_LAYER } from '../layers';
import type { QualityProfile } from '../quality';
import { POST_BASE, type PostParams } from './post-params';
import {
  AO_BLUR_FRAGMENT,
  AO_FRAGMENT,
  BLOOM_DOWN_FRAGMENT,
  BLOOM_UP_FRAGMENT,
  COPY_FRAGMENT,
  DOF_FRAGMENT,
  FINAL_FRAGMENT,
  FULLSCREEN_VERTEX,
  FXAA_FRAGMENT,
  PREP_FRAGMENT,
  TRANSITION_FRAGMENT,
} from './shaders';

/** Scene-level style values that are not three.js lights (see `kGlobals`). */
export interface StyleRig {
  rimColor: Color;
  /** Direction towards the rim light, world space. */
  rimDir: Vector3;
  /** World-unit look factor of the scene (`env.lookScale`); → `kGlobals.uKLookScale`. Default 1. */
  lookScale?: number;
}

/** Mood grade of the active environment (display-space colours). Null / zero amounts = neutral. */
export interface MoodGrade {
  tint: Color;
  tintAmount: number;
  harmonyColor: Color;
  harmony: number;
  accentColor: Color;
}

export interface WorldView {
  scene: Scene;
  camera: PerspectiveCamera;
  rig: StyleRig | null;
  mood?: MoodGrade | null;
}

export interface HudView {
  scene: Scene;
  camera: Camera;
  rig: StyleRig | null;
}

export interface TransitionUniforms {
  active: boolean;
  /** 0…1, eased by the caller. */
  progress: number;
  /** +1 zoom in, −1 zoom out. */
  direction: 1 | -1;
  /** Focus point in uv (centre of the free viewport area). */
  center: Vector2;
  accent: Color;
  /** Plain cross-fade (reduced motion). */
  simple: boolean;
}

function fsMaterial(
  fragmentShader: string,
  uniforms: ShaderMaterial['uniforms'],
  defines: Record<string, string | number> = {},
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    toneMapped: false,
  });
}

function hdrTarget(
  w: number,
  h: number,
  opts: { samples?: number; depth?: boolean; depthTexture?: boolean; stencil?: boolean } = {},
): WebGLRenderTarget {
  const rt = new WebGLRenderTarget(w, h, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: opts.depth ?? false,
    stencilBuffer: opts.stencil ?? false,
    samples: opts.samples ?? 0,
    generateMipmaps: false,
  });
  if (opts.depthTexture) {
    // with stencil: DEPTH24_STENCIL8 — the same 24-bit depth as DEPTH_COMPONENT24, plus 8 stencil bits
    const dt = new DepthTexture(w, h, opts.stencil ? UnsignedInt248Type : UnsignedIntType);
    if (opts.stencil) dt.format = DepthStencilFormat;
    dt.minFilter = NearestFilter;
    dt.magFilter = NearestFilter;
    rt.depthTexture = dt;
  }
  return rt;
}

const VOID = col('bg.void');

export class RenderPipeline {
  /** Live post parameters — tween these (through `PostControl`) rather than replacing the object. */
  readonly params: PostParams = { ...POST_BASE };
  readonly transition: TransitionUniforms = {
    active: false,
    progress: 0,
    direction: 1,
    center: new Vector2(0.5, 0.5),
    accent: col('cyan'),
    simple: false,
  };
  /** Resolved `PostParams.dofReference` for the active chapter (set by the runtime; 0 = no distance scaling). */
  dofReference = 0;
  /** World-unit factor of `aoRadius` / `dofRange` (set by the runtime from `env.lookScale`; 1 = as authored). */
  lookScale = 1;
  /** Internal render resolution in physical pixels. */
  width = 1;
  height = 1;

  private profile: QualityProfile;
  private readonly quad: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  private rtScene!: WebGLRenderTarget;
  private rtAO: WebGLRenderTarget | null = null;
  private rtAOBlur: WebGLRenderTarget | null = null;
  private rtPrep!: WebGLRenderTarget;
  private rtHud!: WebGLRenderTarget;
  private rtLive: WebGLRenderTarget | null = null;
  private rtFrozen: WebGLRenderTarget | null = null;
  private rtLdr: WebGLRenderTarget | null = null;
  private bloomDown: WebGLRenderTarget[] = [];
  private bloomUp: WebGLRenderTarget[] = [];

  private matAO!: ShaderMaterial;
  private matAOBlur!: ShaderMaterial;
  private matPrep!: ShaderMaterial;
  private matDof!: ShaderMaterial;
  private readonly matCopy: ShaderMaterial;
  private readonly matTransition: ShaderMaterial;
  private readonly matBloomDown: ShaderMaterial;
  private readonly matBloomUp: ShaderMaterial;
  private readonly matFinal: ShaderMaterial;
  private readonly matFxaa: ShaderMaterial;

  private captureRequested = false;
  private frozenValid = false;
  private readonly projInv = new Matrix4();

  constructor(
    private readonly renderer: WebGLRenderer,
    profile: QualityProfile,
  ) {
    this.profile = profile;
    const geometry = new BufferGeometry();
    // one oversized triangle covers the screen without a diagonal seam
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.matCopy = fsMaterial(COPY_FRAGMENT, { tMap: { value: null } });
    this.quad = new Mesh(geometry, this.matCopy);
    this.quad.frustumCulled = false;
    this.matTransition = fsMaterial(TRANSITION_FRAGMENT, {
      tLive: { value: null },
      tFrozen: { value: null },
      uProgress: { value: 0 },
      uDir: { value: 1 },
      uCenter: { value: this.transition.center },
      uAspect: { value: 1 },
      uAccent: { value: this.transition.accent },
      uSimple: { value: 0 },
    });
    this.matBloomDown = fsMaterial(BLOOM_DOWN_FRAGMENT, {
      tMap: { value: null },
      uTexel: { value: new Vector2() },
      uThreshold: { value: new Vector3(1, 0.25, 1) },
    });
    this.matBloomUp = fsMaterial(BLOOM_UP_FRAGMENT, {
      tLow: { value: null },
      tHigh: { value: null },
      uTexel: { value: new Vector2() },
      uRadius: { value: 0.75 },
    });
    this.matFinal = fsMaterial(FINAL_FRAGMENT, {
      tScene: { value: null },
      tBloom: { value: null },
      uBloom: { value: new Vector4(1, 0, 0, 0) },
      uExposure: { value: 1 },
      uGrade: { value: new Vector4() },
      uLiftColor: { value: new Color(0.42, 0.3, 1.0) },
      uVignette: { value: new Vector4() },
      uVignetteColor: { value: new Color(0.16, 0.13, 0.42) },
      uMoodTint: { value: new Vector4(1, 1, 1, 0) },
      uMoodHarmony: { value: new Vector4(1, 0.6, 0.3, 0) },
      uMoodAccent: { value: new Vector3(1, 0.85, 0.3) },
      uGrain: { value: new Vector3() },
      uChroma: { value: new Vector2() },
    });
    this.matFxaa = fsMaterial(FXAA_FRAGMENT, {
      tDiffuse: { value: null },
      resolution: { value: new Vector2() },
    });
    renderer.autoClear = false;
    renderer.info.autoReset = false;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    this.buildQualityMaterials();
    this.allocate(1, 1);
    this.applyProfileToRenderer();
    this.warmUp();
  }

  /**
   * Compile every pass program now (one draw into a 2×2 target each). Otherwise the transition, DOF or AO
   * shader would be compiled in the middle of the first chapter transition — a visible hitch on slow drivers.
   */
  private warmUp(): void {
    const target = hdrTarget(2, 2);
    const previous = this.renderer.getRenderTarget();
    for (const m of [
      this.matAO,
      this.matAOBlur,
      this.matPrep,
      this.matDof,
      this.matCopy,
      this.matTransition,
      this.matBloomDown,
      this.matBloomUp,
      this.matFinal,
      this.matFxaa,
    ]) {
      this.pass(m, target);
    }
    this.renderer.setRenderTarget(previous);
    target.dispose();
  }

  /** Switch quality tier: rebuilds tier-dependent shaders and render targets. */
  setProfile(profile: QualityProfile): void {
    this.profile = profile;
    this.disposeQualityMaterials();
    this.buildQualityMaterials();
    this.disposeTargets();
    this.allocate(this.width, this.height);
    this.applyProfileToRenderer();
    this.warmUp();
  }

  /** Resize the internal buffers (physical pixels). */
  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.width && h === this.height) return;
    this.disposeTargets();
    this.allocate(w, h);
  }

  /**
   * Freeze the current world image: the next `render()` stores its world result (after DOF, before HUD) as
   * the "outgoing" frame of a chapter transition. Until the transition ends, `transition.active` mixes it
   * with the live world.
   */
  requestFreeze(): void {
    this.captureRequested = true;
  }

  /** Release the transition buffers once a transition has finished. */
  endTransition(): void {
    this.transition.active = false;
    this.transition.progress = 0;
    this.frozenValid = false;
    this.rtLive?.dispose();
    this.rtFrozen?.dispose();
    this.rtLive = null;
    this.rtFrozen = null;
  }

  /** Render one frame. `world` may be null while nothing is loaded yet (the HUD still renders). */
  render(world: WorldView | null, hud: HudView | null, time: number): void {
    const r = this.renderer;
    const p = this.params;
    const w = this.width;
    const h = this.height;
    r.info.reset();
    kGlobals.uKTime.value = time;

    const needLive = this.transition.active || this.captureRequested;
    if (needLive) this.ensureTransitionTargets();
    const worldOut = needLive ? this.rtLive! : this.rtHud;

    if (world) {
      this.applyRig(world.rig);
      r.setRenderTarget(this.rtScene);
      r.setClearColor(VOID, 1);
      r.clear(true, true, true); // stencil: free with the combined depth-stencil clear
      r.render(world.scene, world.camera);

      const cam = world.camera;
      this.projInv.copy(cam.projectionMatrixInverse);
      const useAO = this.profile.aoSamples > 0 && p.aoIntensity > 0.001 && this.rtAO !== null;
      if (useAO) {
        const ao = this.matAO.uniforms;
        ao.tDepth!.value = this.rtScene.depthTexture;
        (ao.uProj!.value as Matrix4).copy(cam.projectionMatrix);
        (ao.uProjInv!.value as Matrix4).copy(this.projInv);
        (ao.uTexel!.value as Vector2).set(1 / w, 1 / h);
        (ao.uAO!.value as Vector3).set(p.aoRadius * this.lookScale, 0.012, 1 / cam.far);
        this.pass(this.matAO, this.rtAO);
        const blur = this.matAOBlur.uniforms;
        blur.tAO!.value = this.rtAO!.texture;
        (blur.uStep!.value as Vector2).set(1 / this.rtAO!.width, 0);
        this.pass(this.matAOBlur, this.rtAOBlur);
        blur.tAO!.value = this.rtAOBlur!.texture;
        (blur.uStep!.value as Vector2).set(0, 1 / this.rtAO!.height);
        this.pass(this.matAOBlur, this.rtAO);
      }
      const scale = h / 1080;
      const maxBlur = p.dofMaxBlur * scale;
      const useDof = this.profile.dofTaps > 0 && p.dofAmount > 0.01 && maxBlur > 0.6;
      const prep = this.matPrep.uniforms;
      prep.tColor!.value = this.rtScene.texture;
      prep.tDepth!.value = this.rtScene.depthTexture;
      prep.tAO!.value = useAO ? this.rtAO!.texture : null;
      prep.uAOIntensity!.value = useAO ? p.aoIntensity : 0;
      (prep.uProjInv!.value as Matrix4).copy(this.projInv);
      // close-ups get milder DOF and no tilt-shift band (see PostParams.dofReference)
      const closeness = this.dofReference > 0 ? p.dofFocus / this.dofReference : 1;
      const apertureScale = Math.min(Math.max(closeness, p.dofCloseup), 1);
      const tiltScale = Math.min(Math.max((closeness - 0.55) / 0.4, 0), 1);
      (prep.uDof!.value as Vector4).set(
        p.dofFocus,
        p.dofRange * this.lookScale,
        p.dofAperture * apertureScale,
        useDof ? p.dofAmount : 0,
      );
      prep.uNearMax!.value = Math.min(Math.max(p.dofNearMax, 0), 1);
      (prep.uTilt!.value as Vector4).set(
        p.tiltAmount * tiltScale,
        p.tiltCenter,
        p.tiltSpread,
        Math.max(p.tiltFalloff, 1e-3),
      );
      if (useDof) {
        this.pass(this.matPrep, this.rtPrep);
        const dof = this.matDof.uniforms;
        dof.tPrep!.value = this.rtPrep.texture;
        (dof.uTexel!.value as Vector2).set(1 / w, 1 / h);
        dof.uMaxBlur!.value = maxBlur;
        this.pass(this.matDof, worldOut);
      } else {
        this.pass(this.matPrep, worldOut);
      }
      // overlay layer: labels / markers on top of the finished world image, untouched by DOF and AO
      const autoShadows = r.shadowMap.autoUpdate;
      r.shadowMap.autoUpdate = false; // the shadow map of this frame is already up to date
      cam.layers.set(OVERLAY_LAYER);
      r.setRenderTarget(worldOut);
      r.clear(false, true, false);
      r.render(world.scene, cam);
      cam.layers.set(WORLD_LAYER);
      r.shadowMap.autoUpdate = autoShadows;
    } else {
      r.setRenderTarget(worldOut);
      r.setClearColor(VOID, 1);
      r.clear(true, false, false);
    }

    if (this.captureRequested) {
      // this frame's world image becomes the frozen outgoing frame; show it unchanged
      const t = this.rtFrozen!;
      this.rtFrozen = this.rtLive;
      this.rtLive = t;
      this.captureRequested = false;
      this.frozenValid = true;
      this.matCopy.uniforms.tMap!.value = this.rtFrozen!.texture;
      this.pass(this.matCopy, this.rtHud);
    } else if (needLive) {
      const tr = this.matTransition.uniforms;
      tr.tLive!.value = this.rtLive!.texture;
      tr.tFrozen!.value = this.frozenValid ? this.rtFrozen!.texture : this.rtLive!.texture;
      tr.uProgress!.value = this.frozenValid ? this.transition.progress : 1;
      tr.uDir!.value = this.transition.direction;
      tr.uAspect!.value = w / h;
      tr.uSimple!.value = this.transition.simple ? 1 : 0;
      this.pass(this.matTransition, this.rtHud);
    }

    if (hud) {
      this.applyRig(hud.rig);
      r.setRenderTarget(this.rtHud);
      r.clear(false, true, false);
      r.render(hud.scene, hud.camera);
    }

    // bloom: bright-pass + mip chain down, tent filter back up
    const levels = this.bloomDown.length;
    let bloomTexture: Texture | null = null;
    if (levels > 0 && p.bloomIntensity > 0.001) {
      const down = this.matBloomDown.uniforms;
      (down.uThreshold!.value as Vector3).set(p.bloomThreshold, Math.max(p.bloomKnee, 1e-3), 1);
      let src: WebGLRenderTarget = this.rtHud;
      for (let i = 0; i < levels; i++) {
        down.tMap!.value = src.texture;
        (down.uTexel!.value as Vector2).set(1 / src.width, 1 / src.height);
        this.pass(this.matBloomDown, this.bloomDown[i]!);
        (down.uThreshold!.value as Vector3).z = 0;
        src = this.bloomDown[i]!;
      }
      const up = this.matBloomUp.uniforms;
      up.uRadius!.value = p.bloomRadius;
      let low: WebGLRenderTarget = this.bloomDown[levels - 1]!;
      for (let i = levels - 2; i >= 0; i--) {
        up.tLow!.value = low.texture;
        up.tHigh!.value = this.bloomDown[i]!.texture;
        (up.uTexel!.value as Vector2).set(1 / low.width, 1 / low.height);
        this.pass(this.matBloomUp, this.bloomUp[i]!);
        low = this.bloomUp[i]!;
      }
      bloomTexture = low.texture;
    }

    const fin = this.matFinal.uniforms;
    fin.tScene!.value = this.rtHud.texture;
    fin.tBloom!.value = bloomTexture ?? this.rtHud.texture;
    // normalise by the geometric weight sum of the mip chain so `bloomRadius` changes width, not energy
    let weight = 0;
    for (let i = 0; i < levels; i++) weight += Math.pow(p.bloomRadius, i);
    (fin.uBloom!.value as Vector4).x = bloomTexture ? p.bloomIntensity / Math.max(weight, 1e-3) : 0;
    fin.uExposure!.value = p.exposure;
    (fin.uGrade!.value as Vector4).set(p.gradeLift, p.gradeContrast, p.gradeVibrance, p.gradeSaturation);
    const mood = world?.mood ?? null;
    if (mood) {
      (fin.uMoodTint!.value as Vector4).set(mood.tint.r, mood.tint.g, mood.tint.b, mood.tintAmount);
      (fin.uMoodHarmony!.value as Vector4).set(
        mood.harmonyColor.r,
        mood.harmonyColor.g,
        mood.harmonyColor.b,
        mood.harmony,
      );
      (fin.uMoodAccent!.value as Vector3).set(mood.accentColor.r, mood.accentColor.g, mood.accentColor.b);
    } else {
      (fin.uMoodTint!.value as Vector4).w = 0;
      (fin.uMoodHarmony!.value as Vector4).w = 0;
    }
    (fin.uVignette!.value as Vector4).set(
      p.vignette,
      p.vignetteRadius,
      Math.max(p.vignetteSoftness, 1e-3),
      w / h,
    );
    (fin.uGrain!.value as Vector3).set(p.grain, time, 0);
    (fin.uChroma!.value as Vector2).x = p.chroma;
    if (this.rtLdr) {
      this.pass(this.matFinal, this.rtLdr);
      this.matFxaa.uniforms.tDiffuse!.value = this.rtLdr.texture;
      (this.matFxaa.uniforms.resolution!.value as Vector2).set(1 / w, 1 / h);
      this.pass(this.matFxaa, null);
    } else {
      this.pass(this.matFinal, null);
    }
  }

  dispose(): void {
    this.disposeTargets();
    this.disposeQualityMaterials();
    for (const m of [
      this.matCopy,
      this.matTransition,
      this.matBloomDown,
      this.matBloomUp,
      this.matFinal,
      this.matFxaa,
    ]) {
      m.dispose();
    }
    this.quad.geometry.dispose();
  }

  private pass(material: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quad, this.quadCamera);
  }

  private applyRig(rig: StyleRig | null): void {
    if (!rig) return;
    kGlobals.uKRimColor.value.copy(rig.rimColor);
    kGlobals.uKRimDir.value.copy(rig.rimDir).normalize();
    kGlobals.uKLookScale.value = rig.lookScale ?? 1;
  }

  private applyProfileToRenderer(): void {
    this.renderer.shadowMap.enabled = this.profile.shadowMapSize > 0;
  }

  private buildQualityMaterials(): void {
    const q = this.profile;
    this.matAO = fsMaterial(
      AO_FRAGMENT,
      {
        tDepth: { value: null },
        uProj: { value: new Matrix4() },
        uProjInv: { value: new Matrix4() },
        uTexel: { value: new Vector2() },
        uAO: { value: new Vector3() },
      },
      { AO_SAMPLES: Math.max(q.aoSamples, 1) },
    );
    this.matAOBlur = fsMaterial(AO_BLUR_FRAGMENT, { tAO: { value: null }, uStep: { value: new Vector2() } });
    this.matPrep = fsMaterial(
      PREP_FRAGMENT,
      {
        tColor: { value: null },
        tDepth: { value: null },
        tAO: { value: null },
        uProjInv: { value: new Matrix4() },
        uAOColor: { value: new Color(0.3, 0.25, 0.62) },
        uAOIntensity: { value: 0 },
        uDof: { value: new Vector4() },
        uTilt: { value: new Vector4() },
        uNearMax: { value: 0.3 },
      },
      q.aoSamples > 0 ? { USE_AO: '' } : {},
    );
    this.matDof = fsMaterial(
      DOF_FRAGMENT,
      { tPrep: { value: null }, uTexel: { value: new Vector2() }, uMaxBlur: { value: 0 } },
      { DOF_TAPS: Math.max(q.dofTaps, 1) },
    );
  }

  private disposeQualityMaterials(): void {
    this.matAO.dispose();
    this.matAOBlur.dispose();
    this.matPrep.dispose();
    this.matDof.dispose();
  }

  private allocate(w: number, h: number): void {
    const q = this.profile;
    this.width = w;
    this.height = h;
    this.rtScene = hdrTarget(w, h, { samples: q.msaa, depth: true, depthTexture: true, stencil: true });
    this.rtPrep = hdrTarget(w, h);
    this.rtHud = hdrTarget(w, h, { samples: q.hudMsaa, depth: true });
    if (q.aoSamples > 0) {
      const aw = Math.max(1, Math.round(w * q.aoScale));
      const ah = Math.max(1, Math.round(h * q.aoScale));
      const make = (): WebGLRenderTarget =>
        new WebGLRenderTarget(aw, ah, {
          type: UnsignedByteType,
          minFilter: LinearFilter,
          magFilter: LinearFilter,
          depthBuffer: false,
        });
      this.rtAO = make();
      this.rtAOBlur = make();
    }
    if (q.fxaa) {
      this.rtLdr = new WebGLRenderTarget(w, h, {
        type: UnsignedByteType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: false,
      });
    }
    let bw = Math.max(1, Math.floor(w / 2));
    let bh = Math.max(1, Math.floor(h / 2));
    for (let i = 0; i < q.bloomLevels && bw >= 2 && bh >= 2; i++) {
      this.bloomDown.push(hdrTarget(bw, bh));
      this.bloomUp.push(hdrTarget(bw, bh));
      bw = Math.floor(bw / 2);
      bh = Math.floor(bh / 2);
    }
  }

  private ensureTransitionTargets(): void {
    if (!this.rtLive) this.rtLive = hdrTarget(this.width, this.height);
    if (!this.rtFrozen) {
      this.rtFrozen = hdrTarget(this.width, this.height);
      this.frozenValid = false;
    }
  }

  private disposeTargets(): void {
    const all = [
      this.rtScene,
      this.rtPrep,
      this.rtHud,
      this.rtAO,
      this.rtAOBlur,
      this.rtLdr,
      this.rtLive,
      this.rtFrozen,
    ];
    for (const rt of all) {
      if (!rt) continue;
      rt.depthTexture?.dispose();
      rt.dispose();
    }
    for (const rt of [...this.bloomDown, ...this.bloomUp]) rt.dispose();
    this.bloomDown = [];
    this.bloomUp = [];
    this.rtAO = this.rtAOBlur = this.rtLdr = this.rtLive = this.rtFrozen = null;
    this.frozenValid = false;
  }
}
