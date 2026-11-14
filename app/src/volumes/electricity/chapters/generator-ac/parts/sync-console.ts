/**
 * Synchronisation desk of step 8 (machine-hall style): a sloped panel with the generator's meters on the left,
 * the grid's on the right, a round synchroscope in the middle (pointer at 12 o'clock = in phase, clockwise =
 * generator faster), two "dark" synchronising lamps above it and the big breaker key below. Panel-local plane
 * XY faces +Z; the panel is tilted back. Origin = centre of the desk on the floor.
 */
import { CylinderGeometry, Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createHalo, type Glow } from '@/fx';
import { G } from '@/kit';
import { K } from '@/style';
import { createMeter, type Meter } from './meter';
import { group } from '../world';

export interface SyncConsole {
  group: Group;
  panel: Group;
  pointer: Group;
  lamps: { mat: ReturnType<typeof K.glow>; halo: Glow }[];
  /** Generator f, generator U, grid f, grid U. */
  meters: Meter[];
  /** The breaker key handle (rotates about the panel normal) and its pick target. */
  key: Group;
  keyHit: Mesh;
  /** Panel-local points. */
  scopeCentre: Vector3;
  lampPoint: Vector3;
  meterTags: Vector3[];
  setPointer(angleDeg: number): void;
  setKey(closed: boolean): void;
}

export function createSyncConsole(): SyncConsole {
  const group_ = new Group();
  group_.name = 'sync-console';
  const desk = new Mesh(new RoundedBoxGeometry(4.6, 0.95, 1.3, 3, 0.1), K.toon({ gradient: { bottom: 'ink', top: 'slate', range: [-0.5, 0.5] }, rim: 0.6 }));
  desk.position.set(0, 0.48, 0);
  desk.castShadow = desk.receiveShadow = true;
  group_.add(desk);
  const panel = group('panel', 0, 1.45, -0.2);
  panel.rotation.x = -0.6;
  const face = new Mesh(new RoundedBoxGeometry(4.6, 1.5, 0.14, 3, 0.07), K.toon({ color: 'steel', rim: 0.5, highlight: 0.2 }));
  face.position.z = -0.08;
  face.castShadow = true;
  panel.add(face);
  group_.add(panel);
  // synchroscope: dark dial, 12 o'clock mark, slow/fast arcs, pointer
  const dial = new Mesh(new CylinderGeometry(0.5, 0.52, 0.08, 48).rotateX(Math.PI / 2), K.toon({ color: 'ink', rim: 0.8 }));
  const faceD = new Mesh(new CylinderGeometry(0.44, 0.44, 0.02, 48).rotateX(Math.PI / 2), K.toon({ color: 'white' }));
  faceD.position.z = 0.04;
  const top = new Mesh(new RoundedBoxGeometry(0.05, 0.14, 0.02, 1, 0.01), K.toon({ color: 'green' }));
  top.position.set(0, 0.34, 0.06);
  const scopeCentre = new Vector3(0, 0.12, 0.05);
  const synchro = group('synchroscope', scopeCentre.x, scopeCentre.y, 0, [dial, faceD, top]);
  // slow (anticlockwise, blue) and fast (clockwise, coral) arcs either side of 12 o'clock
  for (const [rz, c] of [[Math.PI / 2 + 0.12, 'blue'], [Math.PI / 2 - 1.32, 'coral']] as const) {
    const arc = new Mesh(new TorusGeometry(0.36, 0.018, 4, 24, 1.2), K.toon({ color: c, emissive: c, emissiveIntensity: 0.3 }));
    arc.position.z = 0.055;
    arc.rotation.z = rz;
    synchro.add(arc);
  }
  const pointer = new Group();
  pointer.position.z = 0.07;
  const blade = new Mesh(new RoundedBoxGeometry(0.04, 0.4, 0.015, 1, 0.01).translate(0, 0.17, 0), K.toon({ color: 'coral' }));
  const hub = new Mesh(new CylinderGeometry(0.05, 0.05, 0.03, 16).rotateX(Math.PI / 2), K.toon({ color: 'ink' }));
  pointer.add(blade, hub);
  synchro.add(pointer);
  panel.add(synchro);
  // dark lamps
  const lampPoint = new Vector3(0, 0.6, 0.1);
  const lamps = [-0.28, 0.28].map((x) => {
    const mat = K.glow({ color: 'yellow', intensity: 0.2, keepHue: true, whiten: 0.2 });
    const bulb = new Mesh(G.sphere(0.1, 20), mat);
    bulb.position.set(x, lampPoint.y, 0.06);
    const ring = new Mesh(new CylinderGeometry(0.13, 0.13, 0.05, 24).rotateX(Math.PI / 2), K.metal({ color: 'slate' }));
    ring.position.set(x, lampPoint.y, 0.02);
    const halo = createHalo({ color: 'yellow', size: 0.5, intensity: 0 });
    halo.position.set(x, lampPoint.y, 0.15);
    panel.add(ring, bulb, halo);
    return { mat, halo };
  });
  // meters: generator (left), grid (right)
  const xs = [-1.75, -1.05, 1.05, 1.75];
  const meters = xs.map((x, i) => {
    const m = createMeter({ ring: i < 2 ? 'teal' : 'white', size: 0.28, post: false });
    m.group.position.set(x, 0.1 - 0.28, 0.02);
    panel.add(m.group);
    return m;
  });
  // value tags under the meters; Hz and kV alternate in height so neighbours never touch at 720p
  const meterTags = xs.map((x, i) => new Vector3(x, i % 2 ? -0.62 : -0.47, 0.1));
  // breaker key below the synchroscope
  const key = new Group();
  key.position.set(0, -0.48, 0.06);
  const plate = new Mesh(new CylinderGeometry(0.2, 0.2, 0.03, 32).rotateX(Math.PI / 2), K.toon({ color: 'ink' }));
  const handle = new Mesh(new RoundedBoxGeometry(0.1, 0.36, 0.1, 2, 0.04).translate(0, 0.08, 0.05), K.toon({ color: 'amber', gloss: 0.5, emissive: 'amber', emissiveIntensity: 0.2 }));
  key.add(plate, handle);
  const keyHit = new Mesh(new RoundedBoxGeometry(0.6, 0.6, 0.3, 1, 0.05), K.flat('cyan'));
  (keyHit.material as ReturnType<typeof K.flat>).colorWrite = false;
  (keyHit.material as ReturnType<typeof K.flat>).depthWrite = false;
  key.add(keyHit);
  panel.add(key);
  return {
    group: group_,
    panel,
    pointer,
    lamps,
    meters,
    key,
    keyHit,
    scopeCentre,
    lampPoint,
    meterTags,
    setPointer: (deg) => void (pointer.rotation.z = (-deg * Math.PI) / 180),
    setKey: (closed) => void (key.rotation.z = closed ? -Math.PI / 4 : Math.PI / 4),
  };
}
