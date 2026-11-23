/**
 * The thermometer of the volume: a glass tube with a bulb and a red column. One object stands in the glass on the
 * table and beside the sample of molecules; its column is set in degrees Celsius within a range that the step
 * chooses (the number itself is a caption of the interface, anchored at `top`).
 */
import { CapsuleGeometry, CylinderGeometry, Group, Mesh, Object3D, SphereGeometry } from 'three';
import { K } from '@/style';

export interface Thermometer {
  readonly group: Group;
  /** The top of the column (moves with it): anchor of the reading. */
  readonly top: Object3D;
  /** Degrees at the bottom and at the top of the scale. */
  range(min: number, max: number): void;
  /** Show `celsius` (clamped to the range). */
  set(celsius: number): void;
  readonly celsius: number;
}

/** `height`: length of the scale; `radius`: of the tube. The bulb sits below y = 0, the scale runs 0 … height. */
export function createThermometer(height: number, radius: number): Thermometer {
  const group = new Group();
  group.name = 'thermometer';
  const glass = K.glass({ color: 'sky', opacity: 0.16, edgeOpacity: 0.55, specular: 0.8 });
  const tube = new Mesh(new CapsuleGeometry(radius, height + radius, 8, 20), glass);
  tube.position.y = height / 2;
  const bulbGlass = new Mesh(new SphereGeometry(radius * 2.1, 24, 16), glass);
  bulbGlass.position.y = -radius * 2.2;
  const liquid = K.glow({ color: 'coral', intensity: 1.25, whiten: 0.15, keepHue: true, falloff: 1.2 });
  const bulb = new Mesh(new SphereGeometry(radius * 1.55, 20, 14), liquid);
  bulb.position.y = -radius * 2.2;
  // unit-height column, scaled along y; it starts in the bulb
  const column = new Mesh(new CylinderGeometry(radius * 0.42, radius * 0.42, 1, 12), liquid);
  const top = new Object3D();
  const ticks = new Group();
  const tickMat = K.flat('mist');
  for (let i = 0; i <= 10; i++) {
    const long = i % 5 === 0;
    const tick = new Mesh(new CylinderGeometry(radius * 0.09, radius * 0.09, radius * (long ? 1.5 : 0.8), 6), tickMat);
    tick.rotation.z = Math.PI / 2;
    tick.position.set(radius * (long ? 1.75 : 1.4), (height * i) / 10, 0);
    ticks.add(tick);
  }
  bulbGlass.renderOrder = tube.renderOrder = 3;
  group.add(column, bulb, ticks, tube, bulbGlass, top);
  let lo = 0;
  let hi = 100;
  let now = 0;
  const apply = (): void => {
    const t = Math.min(1, Math.max(0, (now - lo) / (hi - lo)));
    const from = -radius * 2.2;
    const to = Math.max(from + 0.01, height * t);
    column.scale.y = to - from;
    column.position.y = (to + from) / 2;
    top.position.set(0, to, 0);
  };
  apply();
  return {
    group,
    top,
    range(min, max) {
      lo = min;
      hi = max;
      apply();
    },
    set(celsius) {
      now = celsius;
      apply();
    },
    get celsius() {
      return now;
    },
  };
}
