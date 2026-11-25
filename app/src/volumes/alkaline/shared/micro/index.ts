/**
 * The micro world (VISUAL.md §3, §4.3): mounted very small just in front of the slice's zinc paste, beside the
 * separator, facing the reader like the slice. The camera dives into it through the lens: as the camera comes
 * within reach, the micro world's dark lye closes round it (`presence`), the slice and the stand behind fall away.
 * One micro unit = `MICRO` stand units (≈ 0.1 mm); the field is the floor «зернятка», the atoms patch on one grain's
 * edge the floor «атоми», the pair (`inside/touch`) stands apart above the field.
 */
import { Group, Mesh, Quaternion, RingGeometry, TorusGeometry, Vector3, CircleGeometry } from 'three';
import type { Camera } from 'three';
import type { Shot } from '@/engine/api';
import { K } from '@/style';
import { STAGE_FOV } from '@circuit/shared/stage';
import { createAtoms, type Atoms } from './atoms';
import { createField, type Field } from './field';
import { EDGE } from './layout';
import { createPair, PAIR_AT, type Pair } from './pair';
import { smooth } from '../scrub';
import type { Slice } from '../slice';

/** Stand units per micro unit. */
export const MICRO = 0.004;
/** Where on the slice's face (slice units × scale, world) the lens lands: the zinc paste beside the separator. */
const ON_SLICE = new Vector3(0.62, -0.18, 0);
/** How far in front of the slice's face the micro world floats (world). */
const LIFT = 0.03;

export interface Micro {
  group: Group;
  field: Field;
  atoms: Atoms;
  pair: Pair;
  /** The lens: 0 resting beside the slice … 1 on the paste (where the dive goes in). */
  lens: number;
  /** 0 … 1 shown (the ring glows a call when the step wants the reader to take it). */
  lensShown: number;
  lensCall: number;
  readonly lensRing: Mesh;
  /** 0 … 1: how much the micro world surrounds the camera (by distance). */
  readonly presence: number;
  /** Shots of the micro world (world units): `grains`, `atoms`, `sep`, `pair`, and the lens over the paste `lensOn`. */
  shots(): Record<'grains' | 'atoms' | 'sep' | 'pair' | 'lensOn', Shot>;
  /** A micro point → world. */
  toWorld(local: Vector3, out?: Vector3): Vector3;
  /** A world point → micro. */
  toLocal(world: Vector3, out?: Vector3): Vector3;
  /** The micro frame's +z in the world (the normal of the drag plane). */
  readonly normal: Vector3;
  update(dt: number, t: number, camera: Camera): void;
}

export function createMicro(slice: Slice): Micro {
  const outer = new Group();
  outer.name = 'micro';
  const group = new Group();
  const field = createField();
  group.add(field.group);
  const atoms = createAtoms(field.group);
  const pair = createPair();
  group.add(pair.group);
  outer.add(group);
  const rest = slice.rest;
  const q = new Quaternion().copy(rest.quaternion);
  const centre = ON_SLICE.clone()
    .applyQuaternion(q)
    .add(rest.position)
    .add(new Vector3(0, 0, LIFT).applyQuaternion(q));
  group.position.copy(centre);
  group.quaternion.copy(q);
  group.scale.setScalar(MICRO);
  group.updateMatrixWorld(true);
  const normal = new Vector3(0, 0, 1).applyQuaternion(q);

  // the lens: a cyan ring with a faint glass, resting beside the slice, gliding onto the paste
  const lensGroup = new Group();
  const ringMat = K.glow({ color: 'cyan', intensity: 1.6, whiten: 0.2 });
  const lensRing = new Mesh(new TorusGeometry(0.2, 0.014, 10, 64), ringMat);
  const glass = new Mesh(new CircleGeometry(0.2, 48), K.glass({ color: 'sky', opacity: 0.12 }));
  const halo = new Mesh(
    new RingGeometry(0.2, 0.26, 64),
    K.glow({ color: 'cyan', intensity: 0, additive: true }),
  );
  lensGroup.add(lensRing, glass, halo);
  lensGroup.quaternion.copy(q);
  outer.add(lensGroup);
  const lensRest = new Vector3(1.75, -1.15, 0.12).applyQuaternion(q).add(rest.position);
  const lensOn = centre.clone().addScaledVector(normal, 0.01);

  const shot = (target: Vector3, eye: Vector3, radius: number): Shot => {
    const t = group.localToWorld(target.clone());
    const e = group.localToWorld(eye.clone());
    return {
      position: [e.x, e.y, e.z],
      target: [t.x, t.y, t.z],
      fov: STAGE_FOV,
      fit: { center: [t.x, t.y, t.z], radius: radius * MICRO },
      orbit: { azimuth: 0.25, polar: 0.15, zoom: [0.85, 1.2] },
      drift: 0.3,
      // the director's automatic near plane stops at 0.02 stand units (5 micro units): set it from the distance
      near: e.distanceTo(t) * 0.02,
      far: 2,
    };
  };
  let presence = 0;
  const camPos = new Vector3();
  const micro: Micro = {
    group: outer,
    field,
    atoms,
    pair,
    lens: 0,
    lensShown: 0,
    lensCall: 0,
    lensRing,
    get presence() {
      return presence;
    },
    shots: () => ({
      grains: shot(new Vector3(1.8, 0, 0), new Vector3(1.4, 0.9, 23), 8),
      atoms: shot(
        new Vector3(EDGE.x + 0.15, EDGE.y, EDGE.z),
        new Vector3(EDGE.x - 0.1, EDGE.y + 0.1, EDGE.z + 2.3),
        1.1,
      ),
      sep: shot(new Vector3(3.6, 0.6, 0), new Vector3(3.4, 0.9, 15), 6),
      pair: shot(new Vector3(PAIR_AT.x, PAIR_AT.y, 0), new Vector3(PAIR_AT.x, PAIR_AT.y + 0.6, 10), 4.5),
      lensOn: (() => {
        const e = lensOn
          .clone()
          .addScaledVector(normal, 1.3)
          .add(new Vector3(0, 0.15, 0));
        return {
          position: [e.x, e.y, e.z],
          target: [lensOn.x, lensOn.y, lensOn.z],
          fov: STAGE_FOV,
          fit: { center: [lensOn.x, lensOn.y, lensOn.z], radius: 0.35 },
        } satisfies Shot;
      })(),
    }),
    toWorld: (local, out = new Vector3()) => group.localToWorld(out.copy(local)),
    toLocal: (world, out = new Vector3()) => group.worldToLocal(out.copy(world)),
    normal,
    update(dt, t, camera) {
      camPos.setFromMatrixPosition(camera.matrixWorld);
      const d = camPos.distanceTo(centre);
      presence = 1 - smooth(0.14, 0.42, d);
      group.visible = presence > 0.002;
      if (group.visible) {
        field.update(dt, t);
        atoms.update(dt, t);
        pair.update(dt, t);
      }
      // the slice and the stand fall away once the lye surrounds the camera
      slice.group.visible = slice.group.visible && presence < 0.985;
      const k = smooth(0, 1, micro.lens);
      lensGroup.position.copy(lensRest).lerp(lensOn, k);
      lensGroup.visible = micro.lensShown > 0.01 && presence < 0.6;
      lensGroup.scale.setScalar(Math.max(micro.lensShown, 0.001) * (1 + 0.6 * presence));
      (halo.material as ReturnType<typeof K.glow>).intensity = micro.lensCall * (0.6 + 0.4 * Math.sin(t * 4));
    },
  };
  return micro;
}
