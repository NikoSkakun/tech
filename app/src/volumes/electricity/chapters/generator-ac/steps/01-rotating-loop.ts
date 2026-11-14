/**
 * Step 1 `rotating-loop` — the toy generator: a copper loop turns between the poles of a horseshoe magnet. Its
 * normal (white) and **B** (magenta) are shown; a yellow phasor on the dial turns with the loop and its
 * "shadow" draws the sine on the scope (newest point at the left edge, next to the dial; the dashed guide joins
 * them). Speed, B and N set ℰ_max = N·B·A·ω (model Г1 `rotatingLoop`); above 300 rpm the picture is slowed ×50.
 * «Ручна ручка»: drag the crank round — the EMF follows your speed. «Пауза» stops the loop where it "looks" at
 * the pole: the curve crosses zero there (the misconception of the step).
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { createVectorArrow, createWire, curveThrough, RibbonLines } from '@/fx';
import { ROTATING_LOOP, rotatingLoop } from '@electricity/sim/generator-ac';
import { SEMANTIC } from '@/style';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createDial, createGuide, createHoloScope, dialRadius } from '../parts/holo-scope';
import { AXLE_Y, CRANK_R, CRANK_Z, POLE_GAP, createToyGenerator } from '../parts/toy-generator';
import { TraceBuffer } from '../sim-bindings/trace';
import { group, pickBox, roomy, tag } from '../world';

const ID = 'rotating-loop';
const RANGES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const TWO_PI = Math.PI * 2;
/** Scope geometry (rig-local): dial on the left, the strip to its right, both centred at y = 0. */
const SCOPE_W = 5.2;
const SCOPE_H = 2.6;
const DIAL_X = -2.75;
const SCOPE_X = 1.25;

export const rotatingLoop1: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const gen = createToyGenerator();
  const loop = gen.part('loop');
  const crank = gen.part('crank');
  const set = group(ID, 0, 0.16, 0.4, [gen.group]);
  hall.stageRoot.add(set);
  ctx.stage.actor(crank);

  // normal of the loop (white, turns with it) and B between the poles (magenta)
  const normal = createVectorArrow({ color: 'white', radius: 0.035, headLength: 0.22, headRadius: 0.09, intensity: 1.1 });
  normal.set(new Vector3(0, 0, 0), new Vector3(1.0, 0, 0));
  normal.position.z = -0.02;
  loop.add(normal);
  const bArrow = createVectorArrow({ color: SEMANTIC.fieldB, radius: 0.05, headLength: 0.3, headRadius: 0.13, intensity: 1.4 });
  bArrow.set(new Vector3(-0.85, AXLE_Y + 0.9, 0), new Vector3(1.7, 0, 0));
  const bTag = tag('B', 24, SEMANTIC.fieldB);
  bTag.position.set(1.15, AXLE_Y + 0.9, 0);
  const field = new RibbonLines({ capacity: 9 * 4, color: SEMANTIC.fieldB, width: 0.035, intensity: 0.9, dashRepeat: 2.2, dashStrength: 0.8, dashSpeed: 0.6, keepHue: true });
  const lines: { points: Vector3[] }[] = [];
  for (const y of [-0.35, 0, 0.35]) for (const z of [-0.42, 0, 0.42]) lines.push({ points: [new Vector3(-POLE_GAP, AXLE_Y + y, z), new Vector3(POLE_GAP, AXLE_Y + y, z)] });
  field.setLines(lines);
  const nTag = tag('N', 26, 'white');
  nTag.position.copy(gen.anchorLocal('poleN'));
  const sTag = tag('S', 26, 'white');
  sTag.position.copy(gen.anchorLocal('poleS'));
  set.add(bArrow, bTag, field, nTag, sTag);

  // the scope rig behind the machine: phasor dial + strip
  const rig = group('rig', 0, 5.05, -3.4);
  rig.rotation.y = -0.1;
  const dial = createDial(SCOPE_H + 0.1);
  dial.position.x = DIAL_X;
  const holo = createHoloScope({ width: SCOPE_W, height: SCOPE_H, channels: [SEMANTIC.phaseL1] });
  holo.group.position.x = SCOPE_X;
  const R = dialRadius(SCOPE_H);
  const phasor = createVectorArrow({ color: SEMANTIC.phaseL1, radius: 0.04, headLength: 0.24, headRadius: 0.1, intensity: 1.5 });
  phasor.position.set(DIAL_X, 0, 0.05);
  const guide = createGuide('mist');
  rig.add(dial, holo.group, phasor, guide);
  set.add(rig);
  set.updateMatrixWorld(true);

  // the "thread" from the brushes to the scope: a wire with energy pulses
  const leads = gen.anchorLocal('leads');
  const scopeIn = new Vector3(SCOPE_X - SCOPE_W / 2 + 0.3, -SCOPE_H / 2 - 0.05, 0);
  rig.updateMatrix();
  scopeIn.applyMatrix4(rig.matrix);
  const thread = createWire(
    curveThrough([leads, new Vector3(0.5, 4.3, 1.0), new Vector3(-0.2, 4.15, -1.6), scopeIn]),
    { radius: 0.04, color: 'steel', repeat: 1.6, speed: 1.2 },
  );
  set.add(thread);

  // crank pick proxy (≥ 44 px) at the knob
  const knob = pickBox(0.7, 0.7, 0.7, CRANK_R, 0, 0.25);
  crank.add(knob);
  ctx.qa.probe('crank', knob);
  ctx.qa.probe('axle', () => set.localToWorld(new Vector3(0, AXLE_Y, CRANK_Z)));

  // ----------------------------------------------------------------- state (re-derived on every entry)
  const st = { tv: 0, theta: Math.PI / 2, omegaHand: 0, dragging: false, paused: false, pauseTarget: 0, range: 200, peak: 0, lastAngle: 0 };
  const trace = new TraceBuffer(4096);
  const samples = new Float32Array(200);
  const hand = (): boolean => ui.value<boolean>('hand1');
  const model = () => rotatingLoop(ui.value<number>('n1'), ui.value<number>('b1'), ui.value<number>('N1'));
  /** Visual angular speed of the loop, rad/s (slowed ×50 above 300 rpm; the hand crank is never slowed). */
  const omegaVis = (): number => (hand() ? st.omegaHand : model().visualOmegaRadPerS);
  /** EMF amplitude at the current speed (hand: from the crank speed), V. */
  const emfMax = (): number => {
    if (!hand()) return model().emfMaxV;
    const rpm = (Math.abs(st.omegaHand) * 60) / TWO_PI;
    return rotatingLoop(rpm, ui.value<number>('b1'), ui.value<number>('N1')).emfMaxV;
  };
  const emf = (): number => emfMax() * Math.sin(st.theta) * (hand() && st.omegaHand < 0 ? -1 : 1);
  const windowS = (): number => {
    const w = Math.abs(omegaVis());
    return hand() || w < 1e-3 ? 4 : Math.min(20, Math.max(1.2, (2 * TWO_PI) / w));
  };
  const pickRange = (e: number): number => RANGES.find((r) => e <= 0.85 * r) ?? RANGES[RANGES.length - 1]!;
  /** Fill the trace with the last window of a steady rotation so the step opens on a drawn sine. */
  const reseed = (): void => {
    trace.clear();
    st.tv = 0;
    st.theta = Math.PI / 2;
    st.omegaHand = 0;
    st.paused = false;
    st.range = pickRange(emfMax());
    const w = omegaVis();
    const W = windowS();
    for (let k = 0; k <= 240; k++) {
      const t = -W + (W * k) / 240;
      trace.push(t, (emfMax() * Math.sin(st.theta + w * t)) / st.range);
    }
  };

  // ----------------------------------------------------------------- hand crank (drag round the axle)
  const axle = new Vector3();
  const zAxis = new Vector3(0, 0, 1);
  const p = new Vector3();
  ctx.input.register(knob, {
    tooltip: OWN.crankHint,
    cursor: 'grab',
    enabled: () => hall.isCurrent(ID) && hand(),
    dragStart: (e) => {
      st.dragging = true;
      st.paused = false;
      set.localToWorld(axle.set(0, AXLE_Y, CRANK_Z));
      const q = e.planePoint(zAxis, axle, p);
      if (q) st.lastAngle = Math.atan2(q.y - axle.y, q.x - axle.x);
    },
    drag: (e) => {
      const q = e.planePoint(zAxis, axle, p);
      if (!q) return;
      const a = Math.atan2(q.y - axle.y, q.x - axle.x);
      let d = a - st.lastAngle;
      if (d > Math.PI) d -= TWO_PI;
      if (d < -Math.PI) d += TWO_PI;
      st.lastAngle = a;
      st.theta += d;
      st.omegaHand += (d / Math.max(1 / 120, ctx.clock.dt) - st.omegaHand) * 0.25;
    },
    dragEnd: () => (st.dragging = false),
  });

  const pause = (): void => {
    if (st.paused) {
      st.paused = false;
      ui.patch('pause1', { label: OWN.pause });
      return;
    }
    // stop where the loop "looks" at a pole: normal ∥ B, flux maximal, EMF = 0
    st.pauseTarget = Math.round(st.theta / Math.PI) * Math.PI;
    if (st.pauseTarget < st.theta - 0.01 && omegaVis() >= 0) st.pauseTarget += Math.PI;
    st.paused = true;
    ui.patch('pause1', { label: OWN.resume });
    ui.toast(OWN.zeroAt, { icon: 'pause' });
    hall.sound.click(0.8);
  };

  const tip = new Vector3();
  const mid = new Vector3();
  const tipA = new Vector3();
  const curveP = new Vector3();
  return {
    id: ID,
    shots: {
      [ID]: { position: [6.6, 5.4, 12.2], target: [0.2, 3.25, -0.9], fov: 32, fit: { center: [0.2, 3.2, -1], radius: 5.4 } },
    },
    stage: {
      show: [set],
      enter: () => reseed(),
    },
    ui: {
      reset: true,
      honesty: [{ slowed: ROTATING_LOOP.strobeFactor, visible: () => !hand() && ui.value<number>('n1') > ROTATING_LOOP.strobeAboveRpm }],
      controls: [
        { type: 'slider', id: 'n1', label: doc(ID, 0), min: 0, max: 3600, step: 60, value: 600, unit: 'rpm', disabled: () => hand() },
        { type: 'slider', id: 'b1', label: doc(ID, 2), min: 0.1, max: 1, step: 0.05, value: 0.5, unit: 'T', digits: 2 },
        { type: 'slider', id: 'N1', label: doc(ID, 3), min: 10, max: 200, step: 10, value: 100 },
        {
          type: 'toggle',
          id: 'hand1',
          label: doc(ID, 4),
          value: false,
          onChange: (on) => {
            st.omegaHand = 0;
            st.paused = false;
            ui.patch('pause1', { label: OWN.pause });
            ctx.stage.toggle(crank, on);
            if (on) ui.toast(OWN.crankHint, { icon: 'hand' });
          },
        },
        {
          type: 'stats',
          id: 'read1',
          columns: 3,
          items: [
            { label: 'f', get: () => fmtUnit(hand() ? Math.abs(st.omegaHand) / TWO_PI : model().frequencyHz, 'Hz', { digits: 1 }) },
            { label: 'ℰ_max', get: () => fmtUnit(emfMax(), 'V', { digits: emfMax() < 10 ? 1 : 0 }) },
            {
              label: 'T',
              get: () => {
                const f = hand() ? Math.abs(st.omegaHand) / TWO_PI : model().frequencyHz;
                return f > 0.05 ? fmtUnit(1000 / f, 'ms', { digits: f > 10 ? 1 : 0 }) : '—';
              },
            },
          ],
        },
        { type: 'button', id: 'pause1', label: OWN.pause, icon: 'pause', onClick: pause },
      ],
      callouts: [
        { anchor: () => set.localToWorld(mid.set(-1.45, 1.2, 0)), text: OWN.magnet, side: 'left', visible: () => roomy(hall) },
        { anchor: () => set.localToWorld(mid.set(0.3, AXLE_Y - 0.25, 1.5)), text: OWN.slipRings, side: 'down' },
        { anchor: () => rig.localToWorld(mid.set(SCOPE_X + SCOPE_W / 2 - 0.4, SCOPE_H / 2 + 0.1, 0)), text: OWN.scope, side: 'up' },
        { anchor: () => rig.localToWorld(mid.set(DIAL_X, SCOPE_H / 2 + 0.1, 0)), text: OWN.phasors, side: 'up', visible: () => roomy(hall) },
      ],
      hotspots: [
        { anchor: () => normal.tip.getWorldPosition(tip), content: 'loop-normal' },
        { anchor: () => guide.localToWorld(mid.copy(tipA).lerp(curveP, 0.75)), content: 'phasor-trace' },
      ],
    },
    probe: () => ({
      n: ui.value<number>('n1'),
      f: hand() ? Math.abs(st.omegaHand) / TWO_PI : model().frequencyHz,
      emfMax: emfMax(),
      e: emf(),
      thetaDeg: (((st.theta * 180) / Math.PI) % 360 + 360) % 360,
      paused: st.paused,
      hand: hand(),
      crank: crank.visible,
      range: st.range,
      slowed: !hand() && ui.value<number>('n1') > ROTATING_LOOP.strobeAboveRpm,
    }),
    update(dt) {
      if (!hall.isCurrent(ID)) return;
      // advance the loop (visual time: slowed above 300 rpm)
      if (st.paused) {
        st.theta += (st.pauseTarget - st.theta) * Math.min(1, dt * 6);
      } else {
        st.tv += dt;
        if (hand()) {
          if (!st.dragging) st.omegaHand *= Math.exp(-dt / 1.6); // friction: the crank coasts down
          if (!st.dragging) st.theta += st.omegaHand * dt;
        } else st.theta += omegaVis() * dt;
      }
      const E = emfMax();
      st.peak = Math.max(E, st.peak * Math.exp(-dt / 2));
      const want = pickRange(hand() ? st.peak : E);
      if (want !== st.range) st.range = want;
      const e = E * Math.sin(st.theta);
      if (!st.paused) trace.push(st.tv, e / st.range);
      holo.setTrace(0, trace.sample(st.tv, windowS(), samples, 0));
      loop.rotation.z = st.theta;
      crank.rotation.z = st.theta;
      // phasor: length = amplitude on the scope scale, its vertical projection = the newest point of the curve
      const r = Math.min(1.1, E / st.range) * R;
      tipA.set(DIAL_X + Math.cos(st.theta) * r, Math.sin(st.theta) * r, 0.05);
      phasor.set(phasor.position.set(DIAL_X, 0, 0.05).clone(), tipA.clone().sub(phasor.position));
      holo.leftPoint(e / st.range, curveP).add(holo.group.position);
      guide.setLines([{ points: [tipA.clone(), curveP.clone()] }]);
      holo.rangeTag.text = `±${fmtUnit(st.range, 'V')}`;
      const realW = hand() ? windowS() * 1000 : (windowS() * 1000) / model().visualSlowdown;
      holo.timeTag.text = `${OWN.window} ${fmtUnit(realW, realW >= 1000 ? 'ms' : 'ms', { digits: 0 })}`;
      thread.material.power = 0.15 + 0.85 * Math.min(1, Math.abs(e) / st.range);
      hall.sound.turbine = hand() ? Math.min(0.4, Math.abs(st.omegaHand) / 20) : 0.12 + 0.3 * (ui.value<number>('n1') / 3600);
      hall.sound.turbinePitch = hand() ? 0.3 : 0.3 + 0.7 * (ui.value<number>('n1') / 3000);
    },
  };
};
