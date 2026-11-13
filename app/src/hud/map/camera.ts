/**
 * Virtual camera of the Journey Map. The map lives in the HUD scene, whose real camera never moves; so the
 * "camera" is the inverse: a rig group that places, turns and scales the map in front of that camera.
 * All motion is damped toward a goal (smooth travel, interruptible at any time).
 */
import { Group, Vector3, type PerspectiveCamera } from 'three';

export interface MapView {
  /** Map point the view is centred on. */
  x: number;
  y: number;
  z: number;
  /** Zoom: apparent px-eq units per map unit at the focus point (before perspective). */
  zoom: number;
  /** Rotation of the map around its vertical axis / tilt toward the viewer, radians. */
  yaw: number;
  pitch: number;
  /** Where the focus point sits on screen, units from the centre (x right, y up). */
  sx: number;
  sy: number;
}

/** How far behind the UI plane the focus point floats (gives the map real perspective depth). */
const DEPTH = 1500;

const _v = new Vector3();

export class MapCamera {
  /** Add map objects to `content`; add `rig` to the HUD root. */
  readonly rig = new Group();
  readonly content = new Group();
  readonly view: MapView = { x: 0, y: 0, z: 0, zoom: 1, yaw: 0, pitch: 0.3, sx: 0, sy: 0 };
  readonly goal: MapView = { ...this.view };
  /** Responsiveness of the damping, 1/s. */
  stiffness = 4.2;

  constructor(private readonly hudCamera: PerspectiveCamera) {
    this.rig.name = 'journey-map';
    this.rig.rotation.order = 'XYZ';
    this.rig.add(this.content);
    this.apply();
  }

  /** Set (part of) the goal; `instant` jumps there. */
  go(goal: Partial<MapView>, instant = false): void {
    Object.assign(this.goal, goal);
    if (instant) {
      Object.assign(this.view, this.goal);
      this.apply();
    }
  }

  /** True while the view is still noticeably moving. */
  get travelling(): boolean {
    const v = this.view;
    const g = this.goal;
    return (
      Math.abs(v.x - g.x) + Math.abs(v.y - g.y) + Math.abs(v.z - g.z) > 3 ||
      Math.abs(v.zoom / g.zoom - 1) > 0.02
    );
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-this.stiffness * dt);
    const v = this.view;
    const g = this.goal;
    v.x += (g.x - v.x) * k;
    v.y += (g.y - v.y) * k;
    v.z += (g.z - v.z) * k;
    // zoom in log space: equal ratios feel equal
    v.zoom *= Math.pow(g.zoom / v.zoom, k);
    v.yaw += (g.yaw - v.yaw) * k;
    v.pitch += (g.pitch - v.pitch) * k;
    v.sx += (g.sx - v.sx) * k;
    v.sy += (g.sy - v.sy) * k;
    this.apply();
  }

  /** Map point → HUD units from the screen centre; `depth` grows away from the viewer. */
  project(
    x: number,
    y: number,
    z: number,
    out: { x: number; y: number; visible: boolean; scale: number },
  ): void {
    _v.set(x, y, z).applyMatrix4(this.content.matrixWorld);
    const d = this.hudCamera.position.z;
    const k = d / Math.max(d - _v.z, 1);
    out.x = _v.x * k;
    out.y = _v.y * k;
    out.visible = _v.z < d * 0.8;
    out.scale = k * this.view.zoom;
  }

  private apply(): void {
    const v = this.view;
    const d = this.hudCamera.position.z;
    // compensate the perspective shrink at DEPTH so `zoom` and (sx, sy) mean what they say on screen
    const k = (d + DEPTH) / d;
    this.rig.position.set(v.sx * k, v.sy * k, -DEPTH);
    this.rig.rotation.set(v.pitch, v.yaw, 0);
    this.rig.scale.setScalar(v.zoom * k);
    this.content.position.set(-v.x, -v.y, -v.z);
    this.rig.updateMatrixWorld(true);
  }
}
