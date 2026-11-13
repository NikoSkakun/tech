/**
 * Quality tiers. A tier scales resolution, anti-aliasing, shadows, post effects and particle budgets.
 * The tier is auto-picked on first run by a short GPU benchmark, can be overridden by the user (persisted in
 * settings) or per session with `?q=<tier>`.
 */
import {
  Mesh,
  PlaneGeometry,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { Emitter, type Unsubscribe } from './events';

/**
 * `mobile` (F5) is the tier of phones and tablets: picked automatically there instead of the benchmark result,
 * selectable anywhere with `?q=mobile`. The four desktop tiers are unchanged.
 */
export const QUALITY_TIERS = ['low', 'medium', 'high', 'ultra', 'mobile'] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

export function isQualityTier(v: unknown): v is QualityTier {
  return typeof v === 'string' && (QUALITY_TIERS as readonly string[]).includes(v);
}

export interface QualityProfile {
  readonly tier: QualityTier;
  /** Upper bound for the device pixel ratio used for the internal render resolution. */
  readonly maxDpr: number;
  /** MSAA samples of the world pass (0 = off; post AA still runs). */
  readonly msaa: number;
  /** MSAA samples of the HUD pass. */
  readonly hudMsaa: number;
  /** Shadow map resolution of the key light (0 = shadows off). */
  readonly shadowMapSize: number;
  /** Ambient occlusion: 0 = off, otherwise number of samples per pixel. */
  readonly aoSamples: number;
  /** AO buffer scale relative to the render resolution. */
  readonly aoScale: number;
  /** Bloom mip levels. */
  readonly bloomLevels: number;
  /** Depth of field: 0 = off, otherwise bokeh taps. */
  readonly dofTaps: number;
  /** Final FXAA pass. */
  readonly fxaa: boolean;
  /** Multiplier for particle counts / instanced detail (fx kit and chapters must respect it). */
  readonly particles: number;
  /** Anisotropic filtering for textures that ask for it. */
  readonly anisotropy: number;
  /** Size of the first bloom level relative to the render resolution (0.5 on desktop tiers, 0.25 on `mobile`). */
  readonly bloomScale: number;
  /**
   * "Low detail" signal (true on `mobile` only): kit models and chapters may drop optional set dressing,
   * use coarser tessellation and skip secondary effects. Purely advisory — nothing may break when it is ignored.
   */
  readonly lowDetail: boolean;
  /**
   * Render the world straight into the buffer the HUD is drawn on, skipping the full-screen "prep" pass
   * (which exists to merge ambient occlusion and to compute the depth-of-field blur). Only valid for a profile
   * without AO, DOF and MSAA — the `mobile` tier; false on every desktop tier.
   */
  readonly directWorld: boolean;
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  low: {
    tier: 'low',
    maxDpr: 1,
    msaa: 0,
    hudMsaa: 0,
    shadowMapSize: 1024,
    aoSamples: 0,
    aoScale: 0.5,
    bloomLevels: 4,
    dofTaps: 0,
    fxaa: true,
    particles: 0.35,
    anisotropy: 2,
    bloomScale: 0.5,
    lowDetail: false,
    directWorld: false,
  },
  medium: {
    tier: 'medium',
    maxDpr: 1.25,
    msaa: 2,
    hudMsaa: 2,
    shadowMapSize: 2048,
    aoSamples: 6,
    aoScale: 0.5,
    bloomLevels: 5,
    dofTaps: 16,
    fxaa: true,
    particles: 0.6,
    anisotropy: 4,
    bloomScale: 0.5,
    lowDetail: false,
    directWorld: false,
  },
  high: {
    tier: 'high',
    maxDpr: 1.5,
    msaa: 4,
    hudMsaa: 4,
    shadowMapSize: 2048,
    aoSamples: 10,
    aoScale: 0.5,
    bloomLevels: 6,
    dofTaps: 28,
    fxaa: true,
    particles: 1,
    anisotropy: 8,
    bloomScale: 0.5,
    lowDetail: false,
    directWorld: false,
  },
  ultra: {
    tier: 'ultra',
    maxDpr: 2,
    msaa: 4,
    hudMsaa: 4,
    shadowMapSize: 4096,
    aoSamples: 16,
    aoScale: 1,
    bloomLevels: 7,
    dofTaps: 44,
    fxaa: true,
    particles: 1.5,
    anisotropy: 16,
    bloomScale: 0.5,
    lowDetail: false,
    directWorld: false,
  },
  /**
   * Phones and tablets: fill-rate first. No MSAA (FXAA only), no AO, no depth of field / tilt-shift, bloom
   * from a short quarter-resolution chain, the world drawn straight into the HUD buffer (`directWorld`), a
   * 1024 shadow map, half the particles. The DPR cap works together with the device's pixel budget
   * (`device.ts`) and dynamic resolution.
   */
  mobile: {
    tier: 'mobile',
    maxDpr: 2,
    msaa: 0,
    hudMsaa: 0,
    shadowMapSize: 1024,
    aoSamples: 0,
    aoScale: 0.5,
    bloomLevels: 3,
    dofTaps: 0,
    fxaa: true,
    particles: 0.5,
    anisotropy: 2,
    bloomScale: 0.25,
    lowDetail: true,
    directWorld: true,
  },
};

/** Read-only view handed to chapters and kits. */
export interface QualityView {
  readonly tier: QualityTier;
  readonly profile: QualityProfile;
  /** Scale a nominal particle/instance count for the current tier (never below `min`). */
  count(nominal: number, min?: number): number;
  /** Subscribe to tier changes (chapters should rebuild or thin out heavy effects). */
  onChange(fn: (profile: QualityProfile) => void): Unsubscribe;
}

export class Quality implements QualityView {
  private current: QualityProfile = QUALITY_PROFILES.high;
  private readonly events = new Emitter<{ change: QualityProfile }>();

  get tier(): QualityTier {
    return this.current.tier;
  }

  get profile(): QualityProfile {
    return this.current;
  }

  set(tier: QualityTier): void {
    if (tier === this.current.tier) return;
    this.current = QUALITY_PROFILES[tier];
    this.events.emit('change', this.current);
  }

  count(nominal: number, min = 1): number {
    return Math.max(min, Math.round(nominal * this.current.particles));
  }

  onChange(fn: (profile: QualityProfile) => void): Unsubscribe {
    return this.events.on('change', fn);
  }
}

/**
 * Quick fill-rate benchmark: draws a deliberately expensive full-screen shader into an off-screen target and
 * waits for the GPU with a 1×1 `readPixels`. Returns milliseconds for the timed batch (lower = faster GPU).
 */
export function benchmarkGpu(renderer: WebGLRenderer): number {
  const size = 1024;
  const target = new WebGLRenderTarget(size, size, { depthBuffer: false });
  const material = new ShaderMaterial({
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      void main() {
        vec2 p = gl_FragCoord.xy * 0.01;
        float a = 0.0;
        for (int i = 0; i < 96; i++) {
          a += sin(p.x * float(i) * 0.37 + a) * cos(p.y * float(i) * 0.23 - a);
        }
        gl_FragColor = vec4(fract(a), 0.2, 0.3, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pixel = new Uint8Array(4);
  const previous = renderer.getRenderTarget();
  const run = (n: number): number => {
    const t0 = performance.now();
    renderer.setRenderTarget(target);
    for (let i = 0; i < n; i++) renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    return performance.now() - t0;
  };
  run(1); // compile + warm up
  const ms = run(24);
  renderer.setRenderTarget(previous);
  target.dispose();
  material.dispose();
  quad.geometry.dispose();
  return ms;
}

/**
 * Map a benchmark time to a tier. Calibration (24 passes of the 96-iteration shader at 1024²):
 * RTX 5060 ≈ 5–9 ms → `high`; integrated graphics typically 60–250 ms → `low`/`medium`.
 * `ultra` is reserved for clearly faster GPUs or explicit user choice.
 */
export function tierFromBenchmark(ms: number): QualityTier {
  if (ms < 4) return 'ultra';
  if (ms < 28) return 'high';
  if (ms < 90) return 'medium';
  return 'low';
}
