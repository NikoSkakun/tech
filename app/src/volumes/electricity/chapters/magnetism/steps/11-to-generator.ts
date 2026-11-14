/**
 * Step 11 `to-generator` — the bridge: turn a frame in a magnet and you have a generator. An upright horseshoe
 * magnet, a copper frame on an axle with a crank in front and slip rings (or a commutator) behind, brushes to a
 * centre-zero galvanometer and a lamp. Model М8 (`createRotatingCoil`, shared with `generator-ac`): the user
 * turns the crank (drag around the axle — the flywheel follows, ≤ 600 rpm, Lenz braking under load) or presses
 * «Крутити рівно» (120 rpm). ℰ = N·B·A·ω·sin ωt; the board draws ℰ(t) and Φ(t). Electrons only swing to and
 * fro in the frame. «До генератора →» flies out while the model grows into a ghost generator (stator + rotor)
 * and the meters clear away, then opens `generator-ac/rotating-loop`.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit, linkTarget } from '@/content';
import { createFlow, createWire } from '@/fx';
import { SEMANTIC } from '@/style';
import { createRotatingCoil } from '@electricity/sim/magnetism';
import content from '../content';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBLines } from '../parts/b-lines';
import { createGalvanometer } from '../parts/galvanometer';
import { createGenSilhouette } from '../parts/gen-silhouette';
import { GEN, createGeneratorModel } from '../parts/generator-model';
import { createLamp } from '../parts/lamp';
import { group } from '../world';

const ID = 'to-generator';
const AXIS = new Vector3(-0.6, 2.95 * 0.75, -0.2);
const K = 0.75;
const STEADY_RPM = 120;

export const toGeneratorStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const gen = createGeneratorModel();
  gen.group.position.copy(AXIS);
  gen.group.scale.setScalar(K);
  const field = createBLines(9 * 4, { width: 0.024, intensity: 1.1, dashSpeed: 0.3 });
  const fl = [];
  for (const y of [-0.38, 0, 0.38]) for (const z of [-0.55, 0, 0.55]) fl.push({ points: [new Vector3(-0.64, y, z), new Vector3(0.64, y, z)] });
  field.set(fl);
  gen.group.add(field.mesh);
  const electrons = createFlow(ctx, { kind: 'electron', paths: [{ path: gen.loop, closed: true }], count: ctx.quality.count(36, 12), radius: 0.035, speed: 0 });
  gen.rotor.add(electrons);
  const galvo = createGalvanometer(1.0);
  galvo.group.position.set(1.65, 0, 0.35);
  galvo.group.rotation.y = -0.4;
  const lamp = createLamp(1.1);
  lamp.group.position.set(-2.2, 0, 1.0);
  lamp.group.rotation.y = 0.4;
  const brush = (side: number): Vector3 => new Vector3(AXIS.x + side * 0.55 * K, 0.05, AXIS.z + (GEN.ringZ + side * 0.1) * K);
  const wire = (pts: Vector3[]) => createWire(pts, { radius: 0.025, color: 'ink', repeat: 3, speed: 0, power: 0 });
  const leads = [
    wire([brush(-1), new Vector3(-1.9, 0.05, -1.2), new Vector3(-2.35, 0.05, 0.6), new Vector3(-2.35, 0.05, 1.05)]),
    wire([new Vector3(-2.0, 0.05, 1.15), new Vector3(-1.4, 0.05, 1.9), new Vector3(1.2, 0.05, 1.9), new Vector3(1.55, 0.05, 0.6)]),
    wire([new Vector3(1.85, 0.05, 0.3), new Vector3(1.6, 0.05, -1.0), brush(1)]),
  ];
  // the bridge morph: the magnet and frame grow into the silhouette of a real generator during the fly-out
  const ghost = createGenSilhouette();
  ghost.group.position.copy(AXIS);
  set.add(gen.group, galvo.group, lamp.group, ...leads, ghost.group);

  /* ------------------------------------------------------------------------------------- state */
  const sim = createRotatingCoil({ drive: 'speed', speedRpm: 0 });
  const st = { t: 0, dragging: false, lastA: 0, rate: 0, steady: false, morph: 0 };
  const commutator = (): boolean => ui.value<string>('out11') === 'commutator';
  ui.onChange('out11', () => sim.set({ output: commutator() ? 'commutator' : 'slipRings' }));
  const steady = (on: boolean): void => {
    st.steady = on;
    sim.set(on ? { drive: 'speed', speedRpm: STEADY_RPM } : { drive: 'hand', handRpm: null });
  };
  const centre = new Vector3();
  const plane = new Vector3(0, 0, 1);
  const angleOf = (p: Vector3): number => Math.atan2(p.y - centre.y, p.x - centre.x);
  ctx.input.register(gen.rotor, {
    tooltip: OWN.crank,
    cursor: 'grab',
    enabled: () => bench.isCurrent(ID),
    dragStart: (e) => {
      st.dragging = true;
      steady(false);
      gen.group.getWorldPosition(centre);
      const p = e.planePoint(plane, centre);
      st.lastA = p ? angleOf(p) : 0;
      st.rate = 0;
    },
    drag: (e) => {
      const p = e.planePoint(plane, centre);
      if (!p) return;
      const a = angleOf(p);
      let d = a - st.lastA;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      st.lastA = a;
      st.rate += d;
    },
    dragEnd: () => {
      st.dragging = false;
      sim.set({ handRpm: null });
    },
  });
  const bridge = content.crossReferences
    ?.flatMap((x) => x.targets)
    .find((t) => linkTarget(t)?.chapterId === 'generator-ac' && linkTarget(t)?.stepId === 'rotating-loop');
  const goOn = (): void => {
    audio.play('whooshUp');
    void ctx.camera.go(`${ID}:out`, { duration: 1.4 });
    ctx.stage.scope.to(st, { morph: 1 }, { duration: ctx.reducedMotion ? 0.3 : 1.1, ease: 'power2.inOut' });
    ctx.stage.scope.delay(1.1, () => (bridge && ctx.nav.locate(bridge) ? void ctx.nav.open(bridge) : ui.toast(OWN.notBuilt, { tone: 'info' })));
  };
  ctx.qa.probe('crank11', gen.anchors.hub);
  ctx.qa.expose(ID, () => ({ ...sim.state, steady: st.steady, output: commutator() ? 'commutator' : 'slipRings', dragging: st.dragging, morph: st.morph }));
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.45, 3.7, 5.0],
        target: [-0.3, 1.6, 0.05],
        fov: 34,
        frameAspect: 1.2,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [-0.2, 1.4, 0.2], radius: 2.6 },
      },
      [`${ID}:out`]: { position: [3, 9, 12], target: [-0.4, 2.4, -0.2], fov: 30, fit: { center: [0, 2, 0], radius: 5 } },
    },
    stage: {
      show: [set],
      enter: () => {
        sim.reset();
        sim.set({ drive: 'speed', speedRpm: 0, output: 'slipRings' });
        steady(ui.value<boolean>('steady11'));
        st.t = 0;
        st.morph = 0;
      },
    },
    ui: {
      reset: true,
      hint: OWN.crank,
      honesty: ['notToScale'],
      board: {
        title: `${OWN.emfE}(t) · ${OWN.fluxPhi}`,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'chart11',
            chart: {
              height: 200,
              window: 2,
              x: { min: 0, max: 2, label: 't, s' },
              y: { min: -35, max: 35, label: 'ЕРС, V' },
              y2: { min: -0.6, max: 0.6, label: 'NΦ, Wb' },
              series: [
                { id: 'emf', label: OWN.emfE, color: SEMANTIC.current },
                { id: 'phi', label: OWN.fluxPhi, color: SEMANTIC.fieldB, axis: 'y2' },
              ],
            },
            update: (chart) => {
              chart.push('emf', st.t, sim.state.emfV);
              chart.push('phi', st.t, sim.state.fluxLinkageWb);
            },
          },
        ],
      },
      controls: [
        {
          type: 'segmented',
          id: 'out11',
          items: [
            { id: 'rings', label: DOC.rings[0]! },
            { id: 'commutator', label: DOC.rings[1]! },
          ],
          value: 'rings',
        },
        { type: 'toggle', id: 'steady11', label: DOC.steady, value: true, onChange: (on: boolean | string | number) => steady(Boolean(on)) },
        { type: 'readout', id: 'rpm11', label: OWN.rpm, text: () => fmtUnit(Math.abs(sim.state.speedRpm), 'rpm', { digits: 0 }) },
        { type: 'readout', id: 'emax11', label: OWN.emfMax, text: () => fmtUnit(sim.state.emfMaxV, 'V', { digits: 1 }) },
        { type: 'button', id: 'next11', label: DOC.toGenerator, icon: 'next', primary: true, onClick: goOn },
      ],
      callouts: [
        { anchor: () => gen.crank.getWorldPosition(v), text: OWN.crank, color: 'cyan', side: 'right', visible: () => !st.dragging && Math.abs(sim.state.speedRpm) < 5 },
        { anchor: () => galvo.face.getWorldPosition(v), text: OWN.galvanometer, side: 'up', visible: () => st.morph < 0.05 },
      ],
      hotspots: [
        { anchor: gen.anchors.rings, content: 'slip-rings', visible: () => st.morph < 0.05 },
        { anchor: () => gen.crank.getWorldPosition(v).setY(v.y + 0.25), content: 'crank', visible: () => st.morph < 0.05 },
      ],
    },
    update(dt, t) {
      const h = Math.min(dt, 0.05);
      st.t += h;
      if (st.dragging && dt > 0) {
        const rpm = Math.max(-600, Math.min(600, ((st.rate / Math.max(dt, 1e-3)) * 60) / (2 * Math.PI)));
        st.rate = 0;
        sim.set({ drive: 'hand', handRpm: rpm });
      }
      if (h > 0) sim.step(h);
      const s = sim.state;
      gen.rotor.rotation.z = s.angleRad;
      gen.rings.visible = !commutator();
      gen.commutator.visible = commutator();
      // full scale ±12 V: a steady 120 rpm (±6,3 V) swings the needle half way; a fast crank pins it
      galvo.deflection = s.emfV / 12;
      galvo.update();
      lamp.brightness = Math.min(s.lampPowerW / 12, 1.2);
      lamp.update();
      // electrons only swing back and forth with the alternating current (slowed for the eye)
      electrons.speed = -0.6 * Math.max(-1, Math.min(1, s.currentA / 0.4));
      for (const w of leads) {
        w.material.speed = 3 * 1.5 * Math.max(-1, Math.min(1, s.currentA / 0.4));
        w.material.power = Math.min(Math.abs(s.currentA) / 0.5, 1);
      }
      // bridge morph: the table model grows ×1.6 into the ghost generator, the meters clear the stage
      const m = st.morph;
      gen.group.scale.setScalar(K * (1 + 0.6 * m));
      ghost.set(m);
      for (const g of [galvo.group, lamp.group, ...leads]) {
        g.scale.setScalar(Math.max(1 - m, 0.001));
        g.visible = m < 0.99;
      }
      bench.live.whir = Math.min(Math.abs(s.speedRpm) / 600, 1) * 0.6;
      bench.live.whirPitch = 0.4 + Math.min(Math.abs(s.speedRpm) / 600, 1) * 0.6;
      bench.live.hum = Math.min(s.lampPowerW / 20, 1) * 0.3;
      bench.live.humPitch = 0.5 + Math.abs(s.frequencyHz) / 20;
      void t;
    },
  };
};
