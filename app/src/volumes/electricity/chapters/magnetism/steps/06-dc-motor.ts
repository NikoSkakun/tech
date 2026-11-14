/**
 * Step 6 `dc-motor` — the DC motor. An open model: curved stator magnets (N left, S right, **B** along +x), a
 * copper frame on the axle with the commutator and brushes in front, the flywheel / brake drum behind. Model М4
 * (`createDcMotor`): averaged commutator model for the instruments; slip-ring mode = instantaneous single-coil
 * model, which only rocks about the vertical and stops. The frame is drawn at the simulated angle while it is
 * slow; above ≈ 3 rev/s the picture turns at a capped visual speed (the tachometer shows the real one).
 * White arrows: the Ampère forces on the long sides (a couple); `cyan` electrons reverse at every commutation,
 * with a `yellow` spark at the brushes.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit } from '@/content';
import { createFlow, createSparks, createVectorArrow } from '@/fx';
import { DC_MOTOR, createDcMotor } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBLines } from '../parts/b-lines';
import { COMM_Z, FRAME_W, createMotorModel } from '../parts/motor-model';
import { createSupply } from '../parts/supply';
import { group } from '../world';

const ID = 'dc-motor';
const AXIS_Y = 1.45;
/** Fastest rotation drawn as is, rad/s (≈ 3 rev/s); faster is drawn at this speed. */
const VIS_CAP = 19;

export const dcMotorStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const motor = createMotorModel();
  motor.group.position.set(0, AXIS_Y, 0);
  const lines = createBLines(9 * 4, { width: 0.026, intensity: 1.2, dashSpeed: 0.35 });
  const field = [];
  for (const y of [-0.45, 0, 0.45]) for (const z of [-0.5, 0, 0.5]) field.push({ points: [new Vector3(-0.84, y, z), new Vector3(0.84, y, z)] });
  lines.set(field);
  motor.group.add(lines.mesh);
  const electrons = createFlow(ctx, { kind: 'electron', paths: [{ path: motor.loop, closed: true }], count: ctx.quality.count(40, 14), radius: 0.035, speed: 0 });
  motor.rotor.add(electrons);
  const forces = [0, 1].map(() => createVectorArrow({ color: 'white', radius: 0.03, headLength: 0.14, headRadius: 0.07, intensity: 1.3 }));
  motor.group.add(...forces);
  const sparks = createSparks(ctx, { color: 'yellow', size: 0.025 });
  motor.group.add(sparks);
  const supply = createSupply(0.7);
  supply.group.position.set(-2.1, 0, 1.3);
  supply.group.rotation.y = 0.5;
  set.add(motor.group, supply.group);

  /* ------------------------------------------------------------------------------------- state */
  const sim = createDcMotor();
  const st = { vis: 0, lastSide: 1, spark: 0 };
  const voltage = (): number => ui.value<number>('u6');
  const load = (): number => ui.value<number>('load6');
  const slipRings = (): boolean => ui.value<string>('out6') === 'rings';
  const slow = (): boolean => ui.value<boolean>('slow6');
  const jammed = (): boolean => ui.value<boolean>('jam6');
  const apply = (): void => sim.set({ voltageV: voltage(), loadTorqueNm: load(), mode: slipRings() ? 'slipRings' : 'commutator', jammed: jammed() });
  for (const id of ['u6', 'load6', 'out6', 'jam6']) ui.onChange(id, apply);
  ui.onChange('out6', () => {
    sim.reset();
    apply();
    st.vis = sim.state.angleRad - Math.PI / 2;
  });
  const alarm = (): boolean => sim.state.stalled && voltage() > 0 && !slipRings();
  ctx.qa.probe('commutator6', motor.anchors.commutator);
  ctx.qa.expose(ID, () => ({
    rpm: sim.state.speedRpm,
    currentA: sim.state.currentA,
    backEmfV: sim.state.backEmfV,
    powerW: sim.state.mechanicalPowerW,
    stalled: sim.state.stalled,
    mode: slipRings() ? 'rings' : 'commutator',
    visAngle: st.vis,
    slow: slow(),
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [2.6, 3.9, 4.4],
        target: [-0.15, 1.2, 0.2],
        fov: 34,
        frameAspect: 1.3,
        orbit: { azimuth: 0.7, polar: 0.3 },
        fit: { center: [-0.2, 1.3, 0], radius: 2.5 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        sim.reset();
        apply();
        st.vis = sim.state.angleRad - Math.PI / 2;
      },
    },
    ui: {
      reset: true,
      honesty: [
        'notToScale',
        { kind: 'simplified', text: DOC.averaged },
        { text: DOC.slowChip, visible: slow },
      ],
      controls: [
        { type: 'slider', id: 'u6', label: DOC.motorU, ...DC_MOTOR.voltageRange, value: DC_MOTOR.voltageRange.default, unit: 'V', digits: 1 },
        { type: 'slider', id: 'load6', label: DOC.load, ...DC_MOTOR.loadRange, value: DC_MOTOR.loadRange.default, unit: 'N·m', digits: 3 },
        {
          type: 'segmented',
          id: 'out6',
          items: [
            { id: 'commutator', label: DOC.output[0]! },
            { id: 'rings', label: DOC.output[1]! },
          ],
          value: 'commutator',
        },
        { type: 'toggle', id: 'jam6', label: DOC.jam, value: false },
        { type: 'toggle', id: 'slow6', label: DOC.slow, value: false },
        { type: 'gauge', id: 'rpm6', kind: 'radial', label: OWN.speed, min: 0, max: 10000, unit: 'rpm', digits: 0, get: () => Math.abs(sim.state.speedRpm) },
        { type: 'readout', id: 'amp6', label: OWN.current, text: () => fmtUnit(sim.state.currentA, 'A', { digits: 2 }), color: () => (alarm() ? 'red' : 'white') },
        { type: 'readout', id: 'pw6', label: OWN.power, text: () => fmtUnit(sim.state.mechanicalPowerW, 'W', { digits: 2 }) },
        { type: 'readout', id: 'emf6', label: OWN.backEmf, text: () => fmtUnit(sim.state.backEmfV, 'V', { digits: 2 }) },
        { type: 'note', id: 'stall6', text: DOC.jammedAlarm, icon: 'warning', color: 'red', visible: alarm },
      ],
      callouts: [{ anchor: supply.knobAnchor, text: OWN.supply, side: 'left' }],
      hotspots: [
        { anchor: motor.anchors.commutator, content: 'commutator' },
        { anchor: motor.anchors.brush, content: 'brush' },
        { anchor: motor.anchors.drum, content: 'tachometer' },
      ],
    },
    update(dt, t) {
      const scale = slow() ? 0.1 : 1;
      const h = Math.min(dt, 0.05) * scale;
      sim.step(h);
      const s = sim.state;
      const rings = slipRings();
      // drawn angle: the simulated one in the rocking slip-ring mode; capped spin in commutator mode
      if (rings) st.vis = s.angleRad - Math.PI / 2;
      else st.vis += Math.sign(s.omegaRadPerS) * Math.min(Math.abs(s.omegaRadPerS), VIS_CAP) * h;
      motor.rotor.rotation.z = st.vis;
      motor.commutator.visible = !rings;
      motor.slipRings.visible = rings;
      motor.brushes.position.z = rings ? 0.02 : 0;
      // current in side A (+x side at θ = 0): reversed by the commutator whenever cos θ changes sign
      const side = rings ? 1 : Math.cos(st.vis) >= 0 ? 1 : -1;
      if (side !== st.lastSide && Math.abs(s.currentA) > 0.05) {
        sparks.burst([0.2 * side, 0, COMM_Z], 4, [0, 1, 0.3], 0.6);
        audio.play('spark', { gain: 0.15, pitch: 1.4 });
      }
      st.lastSide = side;
      const iFrame = side * s.currentA;
      electrons.speed = -0.35 * Math.sign(iFrame) * Math.min(Math.abs(iFrame) / 1.5, 1);
      electrons.density = Math.abs(iFrame) > 0.02 ? 1 : 0.3;
      // Ampère forces on the long sides: F = I·L×B, ±y; arrows at the sides' centres
      const len = Math.min(Math.abs(iFrame) / 2, 1) * 0.6;
      const c = Math.cos(st.vis);
      const sn = Math.sin(st.vis);
      for (const [k, sgn] of [
        [0, 1],
        [1, -1],
      ] as const) {
        const f = forces[k]!;
        f.visible = len > 0.03;
        if (f.visible) f.set([sgn * (FRAME_W / 2) * c, sgn * (FRAME_W / 2) * sn, 0], [0, sgn * Math.sign(iFrame) * len, 0]);
      }
      motor.pad.position.y = -0.04 * (load() / DC_MOTOR.loadRange.max);
      supply.level = voltage() / 12;
      supply.update(t);
      bench.live.whir = Math.min(Math.abs(s.speedRpm) / 5000, 1) * 0.8;
      bench.live.whirPitch = 0.5 + Math.min(Math.abs(s.speedRpm) / 5000, 1.4) * 0.6;
      bench.live.buzz = alarm() ? 0.6 : 0;
    },
  };
};
