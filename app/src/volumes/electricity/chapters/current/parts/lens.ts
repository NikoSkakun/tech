/**
 * The «лупа» — the bridge to the micro-world: a round lens with a `cyan` rim that hovers over a point of a
 * wire and shows the inside of the copper: the ion lattice (`coral`, positive) and `cyan` conduction electrons
 * drifting between the rows. The lens head always faces the camera; its lanes are turned so that the drift on
 * screen runs along the wire it looks at. Everything is a pure function of a few numbers (`drift`, `ac`,
 * `agitation`, `heat`), so any step can drive it.
 */
import { CircleGeometry, Group, Mesh, Quaternion, TorusGeometry, Vector3, type Camera } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ChapterContext } from '@/engine/api';
import { createFlow, createOrbs } from '@/fx';
import { K, col, heatRamp } from '@/style';
import type { Mats } from '../world';

export interface Lens {
  /** Put this at the examined point of the wire (parent space of the set). */
  group: Group;
  /** The camera-facing head (register input on it; anchor labels to it). */
  head: Group;
  /** Direction of the wire at the examined point (set-local = world axes; normalised by the lens). */
  dir: Vector3;
  /** Signed electron drift along `dir`, lens units per second (already slowed for the eye). */
  drift: number;
  /** AC «тупцювання»: amplitude (lens units) and frequency (Hz, slowed). */
  ac: { amplitude: number; frequency: number };
  /** 0…1 thermal agitation of electrons (scattering in a resistive / hot wire). */
  agitation: number;
  /** 0…1 Joule heating of the lattice (`orange` → `red` glow, ions shake). */
  heat: number;
  update(dt: number, t: number, camera: Camera): void;
}

export const LENS_R = 0.92;
const UP = new Vector3(0, 1, 0);

/** `offset`: where the head floats relative to the examined point (default: 1.7 straight above it). */
export function createLens(
  ctx: ChapterContext,
  mats: Mats,
  offset: readonly [number, number, number] = [0, 1.7, 0],
): Lens {
  const R = LENS_R;
  const root = new Group();
  root.name = 'lens';
  const head = new Group();
  head.position.set(...offset);
  const inner = new Group();
  // rim, handle, backdrop and glass
  const rim = new Mesh(
    new TorusGeometry(R, 0.06, 14, 72),
    K.glow({ color: 'cyan', intensity: 1.25, falloff: 0, whiten: 0, keepHue: true }),
  );
  const bezel = new Mesh(new TorusGeometry(R + 0.07, 0.05, 10, 72), mats.steel);
  bezel.position.z = -0.03;
  const handle = new Mesh(new RoundedBoxGeometry(0.16, 0.8, 0.14, 3, 0.05), mats.dark);
  handle.position.set(0.86, -0.95, -0.03);
  handle.rotation.z = 0.74;
  const back = new Mesh(new CircleGeometry(R, 56), K.flat(col('bg.deep').lerp(col('orange.dark'), 0.22)));
  back.position.z = -0.06;
  const glass = new Mesh(new CircleGeometry(R, 56), mats.glass);
  glass.position.z = 0.16;
  glass.renderOrder = 6;
  head.add(bezel, rim, handle, back, inner, glass);
  // pointer from the examined point up to the lens
  const stem = new Mesh(new RoundedBoxGeometry(0.035, 1, 0.035, 1, 0.012), mats.chrome);
  const spot = new Mesh(
    new TorusGeometry(0.13, 0.022, 8, 28),
    K.glow({ color: 'cyan', intensity: 1.3, falloff: 0, whiten: 0, keepHue: true }),
  );
  root.add(head, stem, spot);

  // lattice: rows of ions along the lanes; electrons run in the gaps between the rows
  const rows = [-0.6, -0.2, 0.2, 0.6];
  const homes: [number, number][] = [];
  for (const y of rows) {
    const half = Math.sqrt(Math.max(R * R * 0.86 - y * y, 0));
    for (let x = -half + ((y * 10) % 2 ? 0.2 : 0); x <= half; x += 0.4) homes.push([x, y]);
  }
  const ions = createOrbs({ kind: 'ion', count: homes.length, radius: 0.105, color: 'coral', halo: false });
  inner.add(ions);
  const lanes = [-0.8, -0.4, 0, 0.4, 0.8].map((y) => {
    const half = Math.sqrt(R * R * 0.9 - y * y);
    return {
      path: [new Vector3(-half, y, 0.03), new Vector3(0, y, 0.03), new Vector3(half, y, 0.03)],
      weight: half,
    };
  });
  const electrons = createFlow(ctx, {
    kind: 'electron',
    paths: lanes,
    count: 26,
    radius: 0.062,
    speed: 0,
    spread: 0.03,
    wobble: 0.03,
    endFade: 0.16,
    seed: 'lens',
  });
  inner.add(electrons);

  const q = new Quaternion();
  const v = new Vector3();
  const hot = col('coral');
  const self: Lens = {
    group: root,
    head,
    dir: new Vector3(1, 0, 0),
    drift: 0,
    ac: { amplitude: 0, frequency: 1 },
    agitation: 0,
    heat: 0,
    update(_dt, t, camera) {
      // billboard the head: cancel the parents' rotation, then take the camera's
      root.getWorldQuaternion(q).invert();
      head.quaternion.copy(q).multiply(camera.quaternion);
      // lanes follow the wire as seen on screen
      v.copy(self.dir).normalize().applyQuaternion(q.copy(camera.quaternion).invert());
      if (Math.hypot(v.x, v.y) > 0.05) inner.rotation.z = Math.atan2(v.y, v.x);
      // stem from the examined point to the near edge of the lens
      const len = Math.max(head.position.length() - R - 0.1, 0.05);
      v.copy(head.position).normalize();
      stem.quaternion.setFromUnitVectors(UP, v);
      stem.scale.y = len;
      stem.position.copy(v).multiplyScalar(len / 2 + 0.06);
      spot.quaternion.setFromUnitVectors(v.set(0, 0, 1), self.dir);
      electrons.speed = self.drift;
      electrons.ac.amplitude = self.ac.amplitude;
      electrons.ac.frequency = self.ac.frequency;
      electrons.wobble = 0.03 + 0.09 * self.agitation;
      // the lattice shakes with heat and glows along the heat ramp
      const shake = 0.012 + 0.05 * self.heat;
      homes.forEach(([x, y], i) =>
        ions.setPosition(i, x + Math.sin(t * 9 + i * 2.4) * shake, y + Math.cos(t * 8 + i * 1.7) * shake, 0),
      );
      ions.commit();
      ions.setColor(self.heat > 0.02 ? heatRamp(Math.min(self.heat, 1), hot) : hot.set(col('coral')));
      ions.intensity = 1 + 0.9 * self.heat;
    },
  };
  return self;
}
