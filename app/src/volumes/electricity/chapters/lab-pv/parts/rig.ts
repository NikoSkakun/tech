/**
 * The bench rig shared by the curve steps (5, 6, 7, 10): the live module on its easel under the sun-lamp, the
 * bench console and the two cables. `show(sample)` renders one model sample everywhere at once — cells,
 * electron flow, diodes, hot spots, needles, cable pulses, lamp — so the scene cannot disagree with the chart.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { Wire } from '@/fx';
import { Builder } from '@/kit';
import { LM440 } from '@electricity/sim/lab-pv';
import { createBenchModel, type BenchModel, type BenchSample } from '../sim-bindings/bench-model';
import { MODULE_SCALE, shadows } from '../world';
import { benchCables, createBench, type Bench } from './bench';
import { createLiveModule, type LiveLook, type LiveModule } from './lm440-live';
import { M } from './lm440-layout';
import { createSunLamp, type SunLamp } from './sun-lamp';

/** Tilt of the module on the easel from horizontal, rad. */
export const EASEL_TILT = 1.02;
const EASEL_AT = new Vector3(-0.75, 0, -0.6);
const EASEL_YAW = 0.22;

export interface Rig {
  /** Module on its easel and the sun-lamp. */
  group: Group;
  /** Bench console and the two cables (a separate actor). */
  desk: Group;
  module: LiveModule;
  /** The tilting frame the module sits in (pose it for other views). */
  mount: Group;
  lamp: SunLamp;
  bench: Bench;
  wires: Wire[];
  model: BenchModel;
  /** Centre of the glass and its outward normal, in the rig's frame. */
  centre: Vector3;
  normal: Vector3;
  /** Rheostat knob position 0…1 for a resistance (log scale 0.05…1000 Ω). */
  knobOf(ohm: number): number;
  show(sample: BenchSample, t: number, look?: LiveLook & { knob?: number; cables?: number; sections?: boolean; photons?: number }): void;
}

export function createRig(ctx: ChapterContext): Rig {
  const group = new Group();
  group.name = 'rig';
  const module = createLiveModule(ctx);
  const mount = new Group();
  const lift = (M.L / 2) * MODULE_SCALE * Math.sin(EASEL_TILT) + 0.28;
  mount.position.set(EASEL_AT.x, lift, EASEL_AT.z);
  mount.rotation.set(EASEL_TILT, EASEL_YAW, 0, 'YXZ');
  module.group.scale.setScalar(MODULE_SCALE);
  mount.add(module.group);

  // easel: two feet, two posts and a cross bar behind the module
  const e = new Builder('easel');
  const back = -Math.cos(EASEL_TILT) * (M.L / 2) * MODULE_SCALE;
  for (const s of [-1, 1]) {
    e.box(0.16, 0.08, 1.9, { r: 0.03, slot: 'metal', c: 'slate', at: [s * 0.8, 0, back * 0.4] });
    e.beam([s * 0.8, 0.06, back - 0.25], [s * 0.8, lift + 0.5, back * 0.55], 0.09, { slot: 'metal', c: 'steel' });
    e.beam([s * 0.8, 0.06, 0.55], [s * 0.8, lift - 0.75, 0.42], 0.07, { slot: 'metal', c: 'steel' });
  }
  e.box(1.9, 0.08, 0.08, { r: 0.02, slot: 'metal', c: 'steel.light', at: [0, lift + 0.2, back * 0.62] });
  const easel = shadows(e.build().group);
  easel.position.set(EASEL_AT.x, 0, EASEL_AT.z);
  easel.rotation.y = EASEL_YAW;

  const bench = createBench();
  bench.group.position.set(1.75, 0, 1.75);
  bench.group.rotation.y = -0.42;
  group.add(mount, easel, bench.group);
  group.updateMatrixWorld(true);

  const centre = mount.localToWorld(new Vector3(0, 0, 0));
  const normal = mount.localToWorld(new Vector3(0, 1, 0)).sub(centre).normalize();
  const local = (o: { getWorldPosition(v: Vector3): Vector3 }): Vector3 => group.worldToLocal(o.getWorldPosition(new Vector3()));
  const cables = benchCables(
    { plus: local(module.anchors.plus), minus: local(module.anchors.minus) },
    { plus: local(bench.anchors.plus), minus: local(bench.anchors.minus) },
    0,
  );
  // the bench and its cables are their own actor: step 7 (the module alone, close up) leaves them out
  const desk = new Group();
  desk.name = 'desk';
  desk.add(bench.group, cables.group);

  // the lamp hangs above and a little in front: the photons rain down past the camera's line of sight
  const lamp = createSunLamp(ctx);
  lamp.place(centre.clone().addScaledVector(normal, 1.6).add(new Vector3(-0.2, 2.7, 0)), centre, 1.35, normal);
  group.add(lamp.group);
  module.cells.castShadow = false;
  shadows(module.layers.frame);

  const knobOf = (ohm: number): number => Math.min(1, Math.max(0, Math.log(ohm / 0.05) / Math.log(1000 / 0.05)));
  return {
    group,
    desk,
    module,
    mount,
    lamp,
    bench,
    wires: cables.wires,
    model: createBenchModel(),
    centre,
    normal,
    knobOf,
    show(sample, t, look = {}) {
      module.apply(sample, t, look);
      module.sections.visible = module.diodes.group.visible = look.sections ?? false;
      // a thinner stream by default: the packets fly in front of the cells the learner is reading
      lamp.setLevel(sample.input.g / 1000, look.photons ?? 0.6);
      const n = Math.max(1, sample.input.modules);
      const p01 = sample.op.pW / (n * 440);
      const knob = look.knob ?? knobOf(sample.op.iA > 1e-3 ? sample.op.vV / sample.op.iA : 1000);
      bench.set({ v: sample.op.vV / (n * 45), i: sample.op.iA / 15, p: sample.op.pW / (n * 500), knob }, t);
      for (const w of cables.wires) {
        w.material.power = (look.cables ?? 1) * Math.min(1.2, p01) * 1.1;
        w.material.speed = 0.6 + 1.8 * (sample.op.iA / LM440.iscA);
      }
    },
  };
}
