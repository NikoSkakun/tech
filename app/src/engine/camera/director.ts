/**
 * Camera director (ARCHITECTURE §4, STYLE_GUIDE §5): named shots, eased arcing moves, damped constrained
 * orbit/zoom around the current shot, idle drift, focus-on-object, DOF focus tracking and HUD-aware framing.
 *
 * HUD-aware framing: a shot is composed for a "safe frame" (aspect `frameAspect`, vertical field of view
 * `fov`). The director fits that frame into the part of the viewport the HUD leaves free and shifts the
 * projection centre there (off-axis projection, like a lens shift) — so the subject stays fully visible and
 * centred in the free area at any window aspect ratio, without changing perspective.
 */
import { Box3, MathUtils, PerspectiveCamera, Quaternion, Sphere, Vector3, type Object3D } from 'three';
import { MOTION, REDUCED_MOTION } from '@/style/motion';
import { worldBounds } from '../layers';
import { damp, resolveEase, type EaseFn, type EaseLike } from '../tween';

export type Vec3Like = Vector3 | readonly [number, number, number];

export interface OrbitLimits {
  /** Max horizontal deviation from the shot direction, radians (±). Default 0.7. */
  azimuth?: number;
  /** Max vertical deviation, radians (±). Default 0.35. */
  polar?: number;
  /** Allowed distance multipliers [closest, farthest]. Default [0.65, 1.5]. */
  zoom?: readonly [number, number];
  /** Set false to lock the camera for this shot. */
  enabled?: boolean;
}

export interface Shot {
  /** Camera position (world). */
  position: Vec3Like;
  /** Point the camera looks at and orbits around. */
  target: Vec3Like;
  /** Vertical field of view of the safe frame, degrees. Default 32. */
  fov?: number;
  /** Aspect ratio (w/h) of the safe frame the shot is composed for. Default 1.5. */
  frameAspect?: number;
  /** Depth-of-field focus point (world) or object to track. Default: `target`. */
  focus?: Vec3Like | Object3D;
  orbit?: OrbitLimits;
  /** Idle drift amplitude multiplier (0 = perfectly still). Default 1. */
  drift?: number;
  near?: number;
  far?: number;
  /**
   * Subject bounds of the shot (M3, DECISIONS §57): what must stay in frame when the viewport is narrow / tall
   * (phones, portrait). A world-space sphere `{ center, radius }` or an object (its bounding box). **Currently a
   * hint only** — the director ignores it; F5 (mobile) will reframe from it. Declare it on every shot now.
   */
  fit?: ShotFit;
}

/** Subject bounds of a shot (`Shot.fit`). */
export type ShotFit = { center: Vec3Like; radius: number } | Object3D;

export interface MoveOptions {
  /** Seconds. Default `MOTION.camera` (1.8 s; shortened automatically for reduced motion). */
  duration?: number;
  ease?: EaseLike;
  /** Jump without animation (deep links, QA). */
  instant?: boolean;
}

export interface FocusOptions extends MoveOptions {
  /** 1 = object fills the safe frame; larger = more margin. Default 1.35. */
  padding?: number;
  /** View direction from the object towards the camera. Default: keep the current direction. */
  direction?: Vec3Like;
  fov?: number;
}

/** Fractions (0…1) of the viewport covered by HUD panels on each side. */
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const DEFAULT_FOV = 32;
const DEFAULT_FRAME_ASPECT = 1.5;

function toVec3(v: Vec3Like, out = new Vector3()): Vector3 {
  return Array.isArray(v) ? out.set(v[0]!, v[1]!, v[2]!) : out.copy(v as Vector3);
}

/** Perspective camera whose projection fits a safe frame into the free viewport area (see file header). */
export class DirectedCamera extends PerspectiveCamera {
  /** Vertical FOV of the safe frame in degrees. */
  frameFov = DEFAULT_FOV;
  frameAspect = DEFAULT_FRAME_ASPECT;
  /** Viewport size in CSS px. */
  viewWidth = 1;
  viewHeight = 1;
  readonly insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };

  /** Centre of the free area in uv (0…1, origin bottom-left) — the screen position of the shot target. */
  freeCenter(out: { x: number; y: number }): { x: number; y: number } {
    const i = this.insets;
    out.x = (i.left + (1 - i.right)) / 2;
    out.y = 1 - (i.top + (1 - i.bottom)) / 2;
    return out;
  }

  override updateProjectionMatrix(): void {
    // PerspectiveCamera's constructor calls this before our fields exist
    if (this.insets === undefined) {
      super.updateProjectionMatrix();
      return;
    }
    const W = this.viewWidth;
    const H = this.viewHeight;
    const i = this.insets;
    const fw = Math.max(1 - i.left - i.right, 0.1) * W;
    const fh = Math.max(1 - i.top - i.bottom, 0.1) * H;
    const tanV = Math.tan(MathUtils.degToRad(this.frameFov) / 2);
    // "contain": the whole safe frame must fit into the free rectangle
    const frameHeightPx = fw / fh >= this.frameAspect ? fh : fw / this.frameAspect;
    const pxPerTan = frameHeightPx / 2 / tanV;
    const cx = (i.left + (1 - i.right)) * 0.5 * W;
    const cy = (i.top + (1 - i.bottom)) * 0.5 * H; // from the top edge
    const n = this.near;
    const left = (-cx / pxPerTan) * n;
    const right = ((W - cx) / pxPerTan) * n;
    const top = (cy / pxPerTan) * n;
    const bottom = (-(H - cy) / pxPerTan) * n;
    this.projectionMatrix.makePerspective(
      left,
      right,
      top,
      bottom,
      n,
      this.far,
      this.coordinateSystem,
      this.reversedDepth,
    );
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
    // keep the stock fields meaningful for code that reads them
    this.aspect = W / H;
    this.fov = MathUtils.radToDeg(2 * Math.atan(H / 2 / pxPerTan));
  }
}

interface Pose {
  target: Vector3;
  /** Unit vector from target to camera. */
  dir: Vector3;
  distance: number;
  fov: number;
  frameAspect: number;
}

function clonePose(p: Pose): Pose {
  return {
    target: p.target.clone(),
    dir: p.dir.clone(),
    distance: p.distance,
    fov: p.fov,
    frameAspect: p.frameAspect,
  };
}

const _q = new Quaternion();
const _qIdentity = new Quaternion();
const _v = new Vector3();
const _right = new Vector3();
const _up = new Vector3(0, 1, 0);
const _box = new Box3();
const _sphere = new Sphere();

export class CameraDirector {
  readonly camera = new DirectedCamera(DEFAULT_FOV, 1, 0.1, 1000);
  /** Current look-at point (world) — after easing, before orbit. */
  readonly target = new Vector3();
  /** Distance from the camera to the DOF focus point along the view axis (world units). */
  focusDistance = 10;
  /** Master switch for user orbit/zoom (the input system checks it). */
  userControl = true;
  /** Shorter moves, no drift (set from the `reducedMotion` setting). */
  reducedMotion = false;

  private readonly named = new Map<string, Shot>();
  private from: Pose;
  private to: Pose;
  private readonly pose: Pose;
  private progress = 1;
  private duration = 0;
  private ease: EaseFn = resolveEase(MOTION.camera.ease);
  private shot: Shot;
  private focusObject: Object3D | null = null;
  private readonly focusPoint = new Vector3();
  private readonly focusFrom = new Vector3();
  private readonly focusCurrent = new Vector3();

  // user orbit state (radians / log-zoom), damped toward targets
  private orbitAz = 0;
  private orbitPol = 0;
  private orbitZoom = 0;
  private orbitAzTarget = 0;
  private orbitPolTarget = 0;
  private orbitZoomTarget = 0;
  // transition arrival: extra dolly factor easing to 1
  private arriveFrom = 1;
  private arriveProgress = 1;
  private arriveDuration = 0;
  private readonly insetsTarget: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  private time = 0;

  constructor() {
    this.shot = { position: [0, 2, 10], target: [0, 0, 0] };
    this.pose = this.poseOf(this.shot);
    this.from = clonePose(this.pose);
    this.to = clonePose(this.pose);
    this.focusCurrent.copy(this.pose.target);
    this.focusPoint.copy(this.pose.target);
    this.applyToCamera(0);
  }

  /** Register named shots (merging with existing ones). */
  shots(map: Record<string, Shot>): void {
    for (const [name, shot] of Object.entries(map)) this.named.set(name, shot);
  }

  hasShot(name: string): boolean {
    return this.named.has(name);
  }

  /** The shot currently targeted. */
  get currentShot(): Shot {
    return this.shot;
  }

  /** True while a shot move is in progress. */
  get moving(): boolean {
    return this.progress < 1;
  }

  /** Move to a named or inline shot from wherever the camera currently is (interruption-safe). */
  go(shot: string | Shot, opts: MoveOptions = {}): void {
    const resolved = typeof shot === 'string' ? this.named.get(shot) : shot;
    if (!resolved) throw new Error(`CameraDirector: unknown shot '${String(shot)}'`);
    this.shot = resolved;
    this.to = this.poseOf(resolved);
    const focus = resolved.focus;
    this.focusObject = focus && (focus as Object3D).isObject3D ? (focus as Object3D) : null;
    if (!this.focusObject) toVec3((focus as Vec3Like | undefined) ?? resolved.target, this.focusPoint);
    // the user's orbit unwinds while the camera travels
    this.orbitAzTarget = 0;
    this.orbitPolTarget = 0;
    this.orbitZoomTarget = 0;
    let duration = opts.duration ?? MOTION.camera.duration;
    if (this.reducedMotion) duration = Math.min(duration, Math.max(0.3, duration * REDUCED_MOTION.camera));
    if (opts.instant || duration <= 0) {
      this.copyPose(this.to, this.pose);
      this.progress = 1;
      this.orbitAz = this.orbitPol = this.orbitZoom = 0;
      this.resolveFocus(this.focusCurrent);
      this.applyToCamera(0);
      return;
    }
    // start from the pose currently on screen, including the user's orbit offset
    this.bakeOrbitInto(this.pose);
    this.from = clonePose(this.pose);
    this.focusFrom.copy(this.focusCurrent);
    this.progress = 0;
    this.duration = duration;
    this.ease = resolveEase(opts.ease ?? MOTION.camera.ease);
  }

  /** Frame an object (or point) so that it fills the safe frame, keeping the current view direction. */
  focusOn(subject: Object3D | Vec3Like, opts: FocusOptions = {}): void {
    const fov = opts.fov ?? this.shot.fov ?? DEFAULT_FOV;
    let radius = 1;
    const center = new Vector3();
    if ((subject as Object3D).isObject3D) {
      worldBounds(subject as Object3D, _box); // labels and invisible pick proxies do not count
      if (_box.isEmpty()) (subject as Object3D).getWorldPosition(center);
      else {
        _box.getBoundingSphere(_sphere);
        center.copy(_sphere.center);
        radius = Math.max(_sphere.radius, 1e-3);
      }
    } else {
      toVec3(subject as Vec3Like, center);
    }
    const dir = opts.direction ? toVec3(opts.direction).normalize() : this.pose.dir.clone();
    // distance at which a sphere of `radius` touches the frame's top/bottom (or sides if the frame is narrow)
    const half = MathUtils.degToRad(fov) / 2;
    const frameAspect = this.shot.frameAspect ?? DEFAULT_FRAME_ASPECT;
    const fit = Math.min(Math.sin(half), Math.sin(Math.atan(Math.tan(half) * frameAspect)));
    const distance = (radius / Math.max(fit, 1e-3)) * (opts.padding ?? 1.35);
    this.go(
      {
        ...this.shot,
        position: center.clone().addScaledVector(dir, distance),
        target: center,
        focus: center,
        fov,
      },
      opts,
    );
  }

  /** HUD reports how much of the viewport its panels cover (fractions 0…1). Eased internally. */
  setInsets(insets: Partial<Insets>, instant = false): void {
    Object.assign(this.insetsTarget, insets);
    if (instant) Object.assign(this.camera.insets, this.insetsTarget);
  }

  setViewport(cssWidth: number, cssHeight: number): void {
    this.camera.viewWidth = Math.max(cssWidth, 1);
    this.camera.viewHeight = Math.max(cssHeight, 1);
    this.camera.updateProjectionMatrix();
  }

  /** User orbit: pointer deltas in CSS px. */
  orbitBy(dxPx: number, dyPx: number): void {
    if (!this.userControl || this.shot.orbit?.enabled === false) return;
    const k = 2.6 / this.camera.viewHeight;
    const maxAz = this.shot.orbit?.azimuth ?? 0.7;
    const maxPol = this.shot.orbit?.polar ?? 0.35;
    this.orbitAzTarget = MathUtils.clamp(this.orbitAzTarget - dxPx * k, -maxAz, maxAz);
    this.orbitPolTarget = MathUtils.clamp(this.orbitPolTarget + dyPx * k, -maxPol, maxPol);
  }

  /** User zoom: factor > 1 moves away, < 1 moves closer (wheel / pinch). */
  zoomBy(factor: number): void {
    if (!this.userControl || this.shot.orbit?.enabled === false) return;
    const [zMin, zMax] = this.shot.orbit?.zoom ?? [0.65, 1.5];
    this.orbitZoomTarget = MathUtils.clamp(
      this.orbitZoomTarget + Math.log(factor),
      Math.log(zMin),
      Math.log(zMax),
    );
  }

  /** Ease the user's orbit/zoom back to the shot. */
  resetOrbit(): void {
    this.orbitAzTarget = this.orbitPolTarget = this.orbitZoomTarget = 0;
  }

  /**
   * Chapter-transition arrival: start with the camera `factor`× farther (>1) or closer (<1) than the shot and
   * ease in, so the incoming world really moves in depth while the engine's iris opens.
   */
  arrive(factor: number, duration: number): void {
    if (this.reducedMotion || duration <= 0) return;
    this.arriveFrom = factor;
    this.arriveProgress = 0;
    this.arriveDuration = duration;
  }

  /** @internal Advance easing, orbit damping and drift; update the three.js camera. */
  update(dt: number): void {
    this.time += dt;
    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + dt / this.duration);
      this.lerpPose(this.from, this.to, this.ease(this.progress), this.pose);
    }
    const lambda = 9;
    this.orbitAz = damp(this.orbitAz, this.orbitAzTarget, lambda, dt);
    this.orbitPol = damp(this.orbitPol, this.orbitPolTarget, lambda, dt);
    this.orbitZoom = damp(this.orbitZoom, this.orbitZoomTarget, lambda, dt);
    if (this.arriveProgress < 1)
      this.arriveProgress = Math.min(1, this.arriveProgress + dt / this.arriveDuration);
    const ins = this.camera.insets;
    const tgt = this.insetsTarget;
    ins.left = damp(ins.left, tgt.left, 7, dt);
    ins.right = damp(ins.right, tgt.right, 7, dt);
    ins.top = damp(ins.top, tgt.top, 7, dt);
    ins.bottom = damp(ins.bottom, tgt.bottom, 7, dt);
    // focus point follows its object / eases between shots
    const k = this.progress < 1 ? this.ease(this.progress) : 1;
    this.resolveFocus(_v);
    this.focusCurrent.copy(this.focusFrom).lerp(_v, k);
    if (k >= 1) this.focusFrom.copy(this.focusCurrent);
    this.applyToCamera(dt);
  }

  private resolveFocus(out: Vector3): Vector3 {
    if (this.focusObject) return this.focusObject.getWorldPosition(out);
    return out.copy(this.focusPoint);
  }

  private poseOf(shot: Shot): Pose {
    const target = toVec3(shot.target);
    const offset = toVec3(shot.position).sub(target);
    const distance = Math.max(offset.length(), 1e-4);
    return {
      target,
      dir: offset.divideScalar(distance),
      distance,
      fov: shot.fov ?? DEFAULT_FOV,
      frameAspect: shot.frameAspect ?? DEFAULT_FRAME_ASPECT,
    };
  }

  private copyPose(src: Pose, dst: Pose): void {
    dst.target.copy(src.target);
    dst.dir.copy(src.dir);
    dst.distance = src.distance;
    dst.fov = src.fov;
    dst.frameAspect = src.frameAspect;
  }

  /** Arc interpolation: target lerps, view direction slerps, distance interpolates in log space. */
  private lerpPose(a: Pose, b: Pose, k: number, out: Pose): void {
    out.target.copy(a.target).lerp(b.target, k);
    _q.setFromUnitVectors(a.dir, b.dir);
    out.dir
      .copy(a.dir)
      .applyQuaternion(_q.slerp(_qIdentity, 1 - k))
      .normalize();
    out.distance = Math.exp(MathUtils.lerp(Math.log(a.distance), Math.log(b.distance), k));
    out.fov = MathUtils.lerp(a.fov, b.fov, k);
    out.frameAspect = MathUtils.lerp(a.frameAspect, b.frameAspect, k);
  }

  /** Direction/distance after applying orbit offsets (and optional drift) to a pose. */
  private orbited(pose: Pose, az: number, pol: number, zoomLog: number, outDir: Vector3): number {
    outDir.copy(pose.dir);
    // polar: rotate around the horizontal axis perpendicular to the view direction, clamped away from the poles
    _right.crossVectors(_up, outDir);
    if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
    _right.normalize();
    const elevation = Math.asin(MathUtils.clamp(outDir.y, -1, 1));
    const newElevation = MathUtils.clamp(elevation + pol, -1.45, 1.45);
    outDir.applyAxisAngle(_right, -(newElevation - elevation));
    outDir.applyAxisAngle(_up, az);
    return pose.distance * Math.exp(zoomLog);
  }

  private bakeOrbitInto(pose: Pose): void {
    const d = this.orbited(pose, this.orbitAz, this.orbitPol, this.orbitZoom, _v);
    pose.dir.copy(_v).normalize();
    pose.distance = d;
    this.orbitAz = this.orbitPol = this.orbitZoom = 0;
  }

  private applyToCamera(_dt: number): void {
    const cam = this.camera;
    const drift = this.reducedMotion ? REDUCED_MOTION.drift : (this.shot.drift ?? 1);
    const t = this.time;
    // idle drift: slow incommensurate sines — the frame is never perfectly still (STYLE_GUIDE §5)
    const az = this.orbitAz + Math.sin(t * 0.21) * 0.016 * drift;
    const pol = this.orbitPol + Math.sin(t * 0.17 + 1.3) * 0.009 * drift;
    const breathe = Math.sin(t * 0.13 + 0.7) * 0.008 * drift;
    let distance = this.orbited(this.pose, az, pol, this.orbitZoom + breathe, _v);
    if (this.arriveProgress < 1) {
      const e = 1 - Math.pow(1 - this.arriveProgress, 3);
      distance *= Math.exp(Math.log(this.arriveFrom) * (1 - e));
    }
    this.target.copy(this.pose.target);
    cam.position.copy(this.pose.target).addScaledVector(_v, distance);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.pose.target);
    cam.near = this.shot.near ?? MathUtils.clamp(distance * 0.03, 0.02, 2);
    cam.far = this.shot.far ?? Math.max(distance * 40, 600);
    cam.frameFov = this.pose.fov;
    cam.frameAspect = this.pose.frameAspect;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    // DOF focus tracking: distance of the focus point along the view axis
    cam.getWorldDirection(_right);
    this.focusDistance = Math.max(_v.copy(this.focusCurrent).sub(cam.position).dot(_right), cam.near);
  }
}
