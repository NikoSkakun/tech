/**
 * «0,3 A» stamped on the lamp's base (VISUAL §5.5 / script `flow/count`: «погляньте на напис на лампочці»): small
 * print on the part of the brass thread that stands above the socket, turned toward the stand's camera side.
 * Like the battery's «1.5 V» it is unlit text that follows the room's light; `glow` lights it up faintly (the
 * takeaway of `flow/count`). At the stand shot it is a few pixels — the close-ups read it; on a phone a chapter
 * names it in the interface instead (`shown = false`, anchor `anchor`).
 */
import { Color, Quaternion, Vector3, type Camera, type Group, type Object3D } from 'three';
import { col } from '@/style';
import { Text3D } from '@/text';

export interface BulbPrint {
  /** Where the print sits (`getWorldPosition`), for a caption of the interface. */
  readonly anchor: Object3D;
  /** Printed or not (off where it would be too small to read). Default true. */
  shown: boolean;
  /** Room light 0…1 (the stage sets it, as the battery's). */
  light: number;
  /** Faint light-up 0…1 (default 0). */
  glow: number;
  /**
   * Every frame: the print shows only where it can be read — from 16 px-equivalent per em on screen (STYLE_GUIDE §6,
   * the rule `chapter-check` holds every world text to), fading in up to 20; at the stand shot it is not drawn.
   */
  update(camera: Camera): void;
}

/** Height of the print's middle on the bulb (local; the thread shows above the socket from ≈ 0.2 to 0.34). */
const PRINT_Y = 0.27;
/** Turned toward the reader's side: between the stand shot's and the lamp close-up's directions (board frame). */
const FACING = -0.32;
/** Em size of the print (world units, the bulb's frame). */
const SIZE = 0.056;
/** px-equivalent per em: hidden below `MIN`, full from `FULL`. */
const MIN = 16;
const FULL = 20;
const _c = new Vector3();
const _u = new Vector3();
const _a = new Vector3();
const _q = new Quaternion();

export function createBulbPrint(group: Group, threadRadius: number): BulbPrint {
  const text = new Text3D('0,3 A', {
    font: 'display',
    size: SIZE,
    color: 'mist',
    anchorX: 'center',
    anchorY: 'middle',
    halo: false,
    rich: false,
  });
  const r = threadRadius + 0.016;
  text.position.set(Math.sin(FACING) * r, PRINT_Y, Math.cos(FACING) * r);
  text.rotation.y = FACING;
  text.name = 'bulb:print';
  group.add(text);
  const ink = col('mist');
  const lit = col('yellow.light');
  let light = 1;
  let glow = 0;
  let shown = true;
  /** Legible on screen now (0 hidden … 1 full). */
  let legible = 0;
  const paint = (): void => {
    // a new colour each time: Text3D re-colours only on a new value
    text.color = new Color().copy(ink).multiplyScalar((0.1 + 0.5 * light) * legible).lerp(lit, 0.75 * glow * legible);
    text.visible = shown && legible > 0;
  };
  paint();
  return {
    anchor: text,
    get shown() {
      return shown;
    },
    set shown(v: boolean) {
      shown = v;
      paint();
    },
    get light() {
      return light;
    },
    set light(v: number) {
      if (v === light) return;
      light = Math.min(Math.max(v, 0), 1);
      paint();
    },
    get glow() {
      return glow;
    },
    update(camera) {
      // 1 em on screen: the print's centre and a point one em above it, projected (NDC → px at 1080p)
      text.getWorldPosition(_c);
      _u.set(0, SIZE, 0).applyQuaternion(group.getWorldQuaternion(_q)).add(_c);
      const front = _a.copy(_c).applyMatrix4(camera.matrixWorldInverse).z < 0;
      const a = _c.project(camera);
      const b = _u.project(camera);
      const pxEq = front ? (Math.abs(b.y - a.y) / 2) * 1080 : 0;
      const next = Math.min(Math.max((pxEq - MIN) / (FULL - MIN), 0), 1);
      if (Math.abs(next - legible) < 1e-3) return;
      legible = next;
      paint();
    },
    set glow(v: number) {
      if (v === glow) return;
      glow = Math.min(Math.max(v, 0), 1);
      paint();
    },
  };
}
