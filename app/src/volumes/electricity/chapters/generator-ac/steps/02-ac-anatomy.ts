/**
 * Step 2 `ac-anatomy` — the mains sine frozen on the big scope with its anatomy: period T, amplitude 325 V,
 * peak-to-peak 650 V and the RMS line 230 V (teal, dashed). Below, two equal lamps glow equally: the left one
 * on steady 230 V (a battery cabinet, electrons creep one way), the right one on mains 230 V (electrons swing
 * back and forth — exaggerated). Right: the 50/60 Hz world map with Japan split in half. A draggable cursor reads
 * u(t); «Помахати…» draws the dashed trail of a cheap LED (100 Hz flicker) beside the solid trail of a filament.
 * Models: `acWave`, `ledLit` (sim `generator-ac`).
 */
import { Group, Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fmtUnit } from '@/content';
import { createFlow, createVectorArrow, createWire, RibbonLines } from '@/fx';
import { addSchukoSocket, batteryCabinet, Builder } from '@/kit';
import { AC_ANATOMY, acWave, ledLit } from '@electricity/sim/generator-ac';
import { K, SEMANTIC } from '@/style';
import type { StepFactory } from '../chapter';
import { doc, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { createBulb } from '../parts/bulb';
import { createHoloScope, VALUE_H } from '../parts/holo-scope';
import { createWorldMap } from '../parts/world-map';
import { group, pickBox, roomy, tag } from '../world';

const ID = 'ac-anatomy';
const W = 6.4;
const H = 3.2;
const FULL_V = 400; // value 1 on the scope
const HALF_W = (W / 2) * 0.94;
const LED_SLOW = 10;
const SWING_S = 1.8;

export const acAnatomy: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const set = group(ID);
  hall.stageRoot.add(set);

  // ------------------------------------------------------------------ the scope and its anatomy marks
  const rig = group('rig', -0.4, 4.25, -1.6);
  const holo = createHoloScope({ width: W, height: H, channels: [SEMANTIC.phaseL1], samples: 240 });
  rig.add(holo.group);
  set.add(rig);
  const yOf = (v: number): number => (v / FULL_V) * (H / 2) * VALUE_H;
  const xOf = (tFrac: number): number => -HALF_W + tFrac * 2 * HALF_W; // tFrac: 0…1 of the 2-period window
  const marks = new RibbonLines({ capacity: 64, color: 'mist', width: 0.022, intensity: 0.7, dashRepeat: 5, dashStrength: 1, dashSpeed: 0, base: 0.1, minPixels: 1.2 });
  const rms = new RibbonLines({ capacity: 8, color: 'teal', width: 0.04, intensity: 1.3, dashRepeat: 4, dashStrength: 1, dashSpeed: 0.25, keepHue: true, minPixels: 1.6 });
  marks.position.z = rms.position.z = 0.04;
  const arrowOpts = { radius: 0.022, headLength: 0.16, headRadius: 0.07, intensity: 1.2 };
  const ampArrow = createVectorArrow({ color: 'white', ...arrowOpts });
  const ppUp = createVectorArrow({ color: 'mist', ...arrowOpts });
  const ppDown = createVectorArrow({ color: 'mist', ...arrowOpts });
  const tLeft = createVectorArrow({ color: 'mist', ...arrowOpts });
  const tRight = createVectorArrow({ color: 'mist', ...arrowOpts });
  const ampTag = tag('', 19, 'white', 'mono');
  const ppTag = tag('', 19, 'mist', 'mono');
  const tTag = tag('', 19, 'mist', 'mono');
  const rmsTag = tag('', 19, 'teal', 'mono');
  for (const a of [ampArrow, ppUp, ppDown, tLeft, tRight]) a.position.z = 0.05;
  rig.add(marks, rms, ampArrow, ppUp, ppDown, tLeft, tRight, ampTag, ppTag, tTag, rmsTag);

  // cursor: a vertical cyan line with a knob under the screen; drag it along the time axis
  const cursor = new Group();
  const cursorMat = K.glow({ color: 'cyan', intensity: 1.5, keepHue: true, whiten: 0 });
  const line = new Mesh(new RoundedBoxGeometry(0.035, H * 0.92, 0.02, 1, 0.01), cursorMat);
  const knob = new Mesh(new RoundedBoxGeometry(0.34, 0.34, 0.12, 3, 0.1), K.toon({ color: 'cyan', emissive: 'cyan', emissiveIntensity: 0.5 }));
  knob.position.y = -H / 2 - 0.3;
  const dot = new Mesh(new RoundedBoxGeometry(0.16, 0.16, 0.16, 3, 0.08), cursorMat);
  const cursorProxy = pickBox(0.7, H + 0.9, 0.3, 0, -0.3, 0);
  cursor.add(line, knob, dot, cursorProxy);
  cursor.position.z = 0.07;
  const cursorTag = tag('', 20, 'cyan', 'mono');
  rig.add(cursor, cursorTag);
  ctx.qa.probe('cursor', knob);
  ctx.qa.probe('scope-right', () => rig.localToWorld(new Vector3(HALF_W * 0.8, -H / 2 - 0.3, 0.07)));

  // ------------------------------------------------------------------ lamps, sources, wires and electrons
  const dcLamp = createBulb();
  dcLamp.group.position.set(-2.2, 0.16, 1.5);
  const acLamp = createBulb();
  acLamp.group.position.set(1.4, 0.16, 1.5);
  const cabinet = batteryCabinet();
  cabinet.group.scale.setScalar(1.6);
  cabinet.group.position.set(-4.3, 0.16, 1.1);
  cabinet.group.rotation.y = 0.35;
  const sb = new Builder('socket-post');
  sb.box(0.7, 1.7, 0.4, { r: 0.08, c: ['slate', 'mist'], slot: 'gloss' });
  sb.frame({ at: [0, 1.25, 0.21], s: 5 }, () => addSchukoSocket(sb));
  const socket = sb.build();
  socket.group.position.set(3.5, 0.16, 1.1);
  socket.group.rotation.y = -0.3;
  const dcTag = tag('⎓ 230 V', 22, 'coral');
  dcTag.position.set(-4.3, 2.35, 1.2);
  const acTag = tag('~ 230 V', 22, 'yellow');
  acTag.position.set(3.5, 2.25, 1.2);
  set.add(dcLamp.group, acLamp.group, cabinet.group, socket.group, dcTag, acTag);
  /** A closed two-wire loop on the floor between a source at x0 and a lamp at x1. */
  const loopPath = (x0: number, x1: number): Vector3[] => [
    new Vector3(x0, 0.32, 1.38),
    new Vector3(x1, 0.32, 1.38),
    new Vector3(x1, 0.32, 1.62),
    new Vector3(x0, 0.32, 1.62),
  ];
  const wires = (x0: number, x1: number): void => {
    for (const z of [1.38, 1.62]) set.add(createWire([new Vector3(x0, 0.32, z), new Vector3(x1, 0.32, z)], { radius: 0.05, color: 'orange', repeat: 0, speed: 0 }));
  };
  wires(-3.7, -2.2);
  wires(1.4, 3.2);
  const dcFlow = createFlow(ctx, { kind: 'electron', paths: loopPath(-3.7, -2.2), closed: true, count: ctx.quality.count(36, 16), radius: 0.06, speed: 0.12, spread: 0.01 });
  const acFlow = createFlow(ctx, { kind: 'electron', paths: loopPath(1.4, 3.2), closed: true, count: ctx.quality.count(36, 16), radius: 0.06, speed: 0, spread: 0.01, ac: { amplitude: 0.16, frequency: 1 } });
  set.add(dcFlow, acFlow);

  // ------------------------------------------------------------------ the 50/60 Hz map
  const map = createWorldMap(3.4);
  map.group.position.set(5.3, 3.4, -0.9);
  map.group.rotation.y = -0.42;
  set.add(map.group);

  // ------------------------------------------------------------------ «Помахати…»: two lamps swept past a camera
  const demo = group('led-demo', -0.4, 2.2, 0.9);
  const filamentTrail = new RibbonLines({ capacity: 260, color: 'yellow', width: 0.11, intensity: 1.5, keepHue: true, dashStrength: 0, minPixels: 2 });
  const ledTrail = new RibbonLines({ capacity: 900, color: 'sky', width: 0.11, intensity: 1.6, keepHue: true, dashStrength: 0, minPixels: 2 });
  const filamentHead = createBulb({ scale: 5 });
  const ledHead = createBulb({ scale: 5, kind: 'led', halo: 'sky' });
  for (const b of [filamentHead, ledHead]) {
    b.group.children[0]!.visible = false; // no pedestal: the lamps are hand-held
    b.group.rotation.z = Math.PI / 2;
    b.setPower(1);
  }
  demo.add(filamentTrail, ledTrail, filamentHead.group, ledHead.group);
  const demoTag = tag(OWN.ledTrail, 18, 'sky');
  demoTag.position.set(0, -0.62, 0);
  const filTag = tag(OWN.filamentTrail, 18, 'yellow');
  filTag.position.set(0, 0.62, 0);
  demo.add(demoTag, filTag);
  set.add(demo);
  ctx.stage.actor(demo);

  // ------------------------------------------------------------------ state
  const st = { cursorFrac: 0.125, demoT: -1 };
  const freq = (): 50 | 60 => (ui.value<string>('f2') === '60' ? 60 : 50);
  const wave = () => acWave(ui.value<number>('U2'), freq(), 0);
  /** u at the cursor: the window shows two periods. */
  const uAt = (frac: number): number => acWave(ui.value<number>('U2'), freq(), frac * 2 * wave().periodS).instantaneousV;
  const samples = new Float32Array(240);
  let drawn = '';
  const drawScope = (): void => {
    const key = `${ui.value<number>('U2')}|${freq()}`;
    if (key === drawn) return;
    drawn = key;
    const w = wave();
    for (let i = 0; i < samples.length; i++) samples[i] = uAt(i / (samples.length - 1)) / FULL_V;
    holo.setTrace(0, samples);
    const up = yOf(w.peakV);
    const u = yOf(ui.value<number>('U2'));
    const x1 = xOf(0.125);
    ampArrow.set(new Vector3(x1, 0, 0.05), new Vector3(0, Math.max(1e-3, up), 0));
    ampTag.text = `U_max = ${fmtUnit(w.peakV, 'V', { digits: 0 })}`;
    ampTag.position.set(x1 + 0.95, up + 0.18, 0.06);
    const xp = xOf(0.75);
    ppUp.set(new Vector3(xp, 0, 0.05), new Vector3(0, Math.max(1e-3, up), 0));
    ppDown.set(new Vector3(xp, 0, 0.05), new Vector3(0, -Math.max(1e-3, up), 0));
    ppTag.text = `U_pp ≈ ${fmtUnit(2 * Math.round(w.peakV), 'V', { digits: 0 })}`;
    ppTag.position.set(xp + 0.15, -up - 0.22, 0.06);
    const yT = -yOf(w.peakV) - 0.32;
    const xm = xOf(0.25);
    tLeft.set(new Vector3(xm, yT, 0.05), new Vector3(xOf(0) - xm, 0, 0));
    tRight.set(new Vector3(xm, yT, 0.05), new Vector3(xOf(0.5) - xm, 0, 0));
    tTag.text = `T = ${fmtUnit(w.periodS * 1000, 'ms', { digits: freq() === 50 ? 0 : 1 })}`;
    tTag.position.set(xm, yT - 0.2, 0.06);
    marks.setLines([
      { points: [new Vector3(-HALF_W, up, 0), new Vector3(HALF_W, up, 0)] },
      { points: [new Vector3(-HALF_W, -up, 0), new Vector3(HALF_W, -up, 0)] },
      { points: [new Vector3(xOf(0.5), yT - 0.1, 0), new Vector3(xOf(0.5), yT + 0.2, 0)] },
    ]);
    rms.setLines([{ points: [new Vector3(-HALF_W, u, 0), new Vector3(HALF_W, u, 0)] }]);
    rmsTag.text = `U = ${fmtUnit(ui.value<number>('U2'), 'V', { digits: 0 })}`;
    rmsTag.position.set(W / 2 + 0.85, u, 0.06);
  };

  // cursor drag along the scope plane
  const normal = new Vector3();
  const through = new Vector3();
  const hit = new Vector3();
  ctx.input.register(cursorProxy, {
    tooltip: OWN.cursorHint,
    cursor: 'ew-resize',
    enabled: () => hall.isCurrent(ID),
    dragStart: () => {
      rig.getWorldDirection(normal);
      rig.getWorldPosition(through);
    },
    drag: (e) => {
      const q = e.planePoint(normal, through, hit);
      if (!q) return;
      const local = rig.worldToLocal(q.clone());
      st.cursorFrac = Math.max(0, Math.min(1, (local.x + HALF_W) / (2 * HALF_W)));
    },
  });

  const wave3 = (): void => {
    st.demoT = 0;
    filamentTrail.setLines([]);
    ledTrail.setLines([]);
    ctx.stage.toggle(demo, true);
    hall.sound.click(1.2);
    ctx.stage.scope.delay(SWING_S + 2.2, () => ctx.stage.toggle(demo, false));
  };
  const swingX = (k: number): number => -3 + 6 * k;
  const pt = new Vector3();
  const mid = new Vector3();
  let ledDashes = 0;

  return {
    id: ID,
    shots: {
      [ID]: { position: [1.4, 4.6, 13.4], target: [0.5, 2.75, -0.4], fov: 34, fit: { center: [0.5, 2.8, -0.4], radius: 6.4 } },
    },
    stage: {
      show: [set],
      enter: () => {
        st.cursorFrac = 0.125;
        st.demoT = -1;
        drawn = '';
      },
    },
    ui: {
      honesty: ['notToScale', { slowed: 50 }, { slowed: LED_SLOW, visible: () => st.demoT >= 0 }],
      controls: [
        { type: 'slider', id: 'U2', label: doc(ID, 0), min: AC_ANATOMY.rmsRangeV.min, max: AC_ANATOMY.rmsRangeV.max, step: AC_ANATOMY.rmsRangeV.step, value: AC_ANATOMY.rmsRangeV.default, unit: 'V' },
        {
          type: 'segmented',
          id: 'f2',
          items: splitPair(doc(ID, 2)).map((label, i) => ({ id: String(AC_ANATOMY.frequenciesHz[i]), label })),
          value: '50',
        },
        {
          type: 'stats',
          id: 'read2',
          columns: 3,
          items: [
            { label: doc(ID, 1), get: () => fmtUnit(wave().peakV, 'V', { digits: 0 }) },
            { label: 'T', get: () => fmtUnit(wave().periodS * 1000, 'ms', { digits: freq() === 50 ? 0 : 1 }) },
            { label: 'u(t)', get: () => fmtUnit(uAt(st.cursorFrac), 'V', { digits: 0 }), color: () => 'cyan' },
          ],
        },
        { type: 'button', id: 'led2', label: doc(ID, 3), icon: 'play', onClick: wave3 },
      ],
      callouts: [
        { anchor: () => dcLamp.group.localToWorld(mid.copy(dcLamp.centre)), text: OWN.dcLamp, side: 'left', color: 'coral' },
        { anchor: () => acLamp.group.localToWorld(mid.copy(acLamp.centre)), text: OWN.acLamp, side: 'right', color: 'yellow' },
        { anchor: () => map.japan.getWorldPosition(mid), text: OWN.japan, side: 'down', visible: () => roomy(hall) },
      ],
      hotspots: [
        { anchor: () => rig.localToWorld(mid.set(HALF_W - 1.7, yOf(ui.value<number>('U2')), 0.05)), content: 0 },
        { anchor: () => map.group.localToWorld(mid.set(-0.4, 0.35, 0.1)), content: 1 },
      ],
    },
    probe: () => ({
      U: ui.value<number>('U2'),
      f: freq(),
      Umax: wave().peakV,
      T: wave().periodS,
      cursorU: uAt(st.cursorFrac),
      cursorFrac: st.cursorFrac,
      lampPower: Math.min(1, Math.pow(ui.value<number>('U2') / 230, 3.4)),
      demo: st.demoT >= 0,
      ledDashes: ledDashes,
      acFreq: acFlow.ac.frequency,
    }),
    update(dt) {
      if (!hall.isCurrent(ID)) return;
      drawScope();
      const u = uAt(st.cursorFrac);
      cursor.position.x = -HALF_W + st.cursorFrac * 2 * HALF_W;
      dot.position.y = yOf(u);
      cursorTag.text = `u = ${fmtUnit(u, 'V', { digits: 0 })}`;
      cursorTag.position.set(cursor.position.x, H / 2 + 0.28, 0.1);
      const U = ui.value<number>('U2');
      // lamps: same RMS → same heat → same glow (filament brightness ≈ (U/230)^3,4)
      const p = Math.min(1, Math.pow(U / 230, 3.4));
      dcLamp.setPower(p);
      acLamp.setPower(p);
      dcFlow.speed = -0.14 * (U / 230); // electrons creep against the conventional current
      acFlow.ac.amplitude = 0.16 * (U / 230);
      acFlow.ac.frequency = freq() / 50; // 50 Hz shown at 1 Hz: slowed ×50
      if (st.demoT >= 0) {
        st.demoT += dt;
        const k = Math.min(1, st.demoT / SWING_S);
        filamentHead.group.position.set(swingX(k), 0.32, 0);
        ledHead.group.position.set(swingX(k), -0.32, 0);
        filamentTrail.setLines([{ points: [new Vector3(swingX(0), 0.32, 0), new Vector3(swingX(k), 0.32, 0)] }]);
        const segs: { points: Vector3[] }[] = [];
        let cur: Vector3[] | null = null;
        const n = Math.max(2, Math.round(k * 480));
        for (let i = 0; i <= n; i++) {
          const kk = (i / 480) * 1;
          const lit = ledLit(freq(), (kk * SWING_S) / LED_SLOW);
          if (lit) (cur ??= []).push(pt.set(swingX(kk), -0.32, 0).clone());
          if ((!lit || i === n) && cur) {
            if (cur.length > 1) segs.push({ points: cur });
            cur = null;
          }
        }
        ledDashes = segs.length;
        ledTrail.setLines(segs);
      }
      hall.sound.hum = 0.05 + 0.12 * (U / 230);
      hall.sound.humPitch = freq() / 25; // the lamp's 100 Hz (120 Hz) flicker hum
    },
  };
};
