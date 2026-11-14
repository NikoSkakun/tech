/**
 * Step 8 `synchronization` — the synchronising desk. Stage 1 «Синхронізуй сам»: trim turbine speed and
 * excitation until the synchroscope pointer creeps and the dark lamps go out, then close the breaker (key or
 * button): soft (green) or a hit (red flash, current spike, the machine shakes). Model Г5a `createSynchroscope`.
 * Stage 2 «Навантаж»: the generator is locked to the grid; more turbine power only advances the rotor by the
 * load angle δ — magenta "springs" stretch, the yellow flow to the grid grows; beyond P_max the rotor slips
 * poles and the breaker trips. Model Г5b `createSwing` (RK4, ramp-limited turbine).
 */
import { Group, Mesh, Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { createFlash, createVectorArrow, createVibration, createWire, RibbonLines, type Wire } from '@/fx';
import { G } from '@/kit';
import { SWING, SYNC, createSwing, createSynchroscope, maxPowerPu } from '@electricity/sim/generator-ac';
import { K, SEMANTIC } from '@/style';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createDial, createHoloScope, dialRadius } from '../parts/holo-scope';
import { createSyncConsole } from '../parts/sync-console';
import { createTurboGen } from '../parts/turbo-gen';
import { PHASE, group, narrow, roomy, tag } from '../world';

const ID = 'synchronization';
const SLOW = 50;

export const synchronization: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const set = group(ID, 0, 0.16, 0);
  hall.stageRoot.add(set);
  const desk = createSyncConsole();
  desk.group.position.set(0, 0, 1.4);
  set.add(desk.group);
  const meterTags = desk.meterTags.map((p) => {
    const t = tag('', 17, 'white', 'mono');
    t.position.copy(p);
    desk.panel.add(t);
    return t;
  });
  const sideTags = [tag(OWN.generatorSide, 18, 'teal'), tag(OWN.gridSide, 18, 'white')];
  sideTags[0]!.position.set(-1.4, 0.62, 0.1);
  sideTags[1]!.position.set(1.4, 0.62, 0.1);
  desk.panel.add(...sideTags);

  // the machine behind the desk, busbars to the grid portal on the right
  const tg = createTurboGen();
  tg.group.scale.setScalar(0.5);
  const machine = group('machine', -3.0, 0, -2.5, [tg.group]);
  machine.rotation.y = 0.35;
  set.add(machine);
  const shake = createVibration(machine, { amplitude: 0.07, frequency: 7, reducedMotion: ctx.reducedMotion, amount: 0 });
  const portal = group('grid-portal', 3.2, 0, -2.2);
  for (const x of [-0.8, 0.8]) {
    const leg = new Mesh(G.cyl(0.08, 2.4, { seg: 12 }), K.metal({ color: 'steel' }));
    leg.position.x = x;
    portal.add(leg);
  }
  const beam = new Mesh(G.box(1.9, 0.14, 0.14), K.metal({ color: 'steel' }));
  beam.position.y = 2.4;
  portal.add(beam);
  set.add(portal);
  machine.updateMatrixWorld(true);
  const bus: Wire[] = PHASE.map((c, k) => {
    const from = tg.anchorLocal(`term${k}`).clone().applyMatrix4(tg.group.matrix).applyMatrix4(machine.matrix);
    const to = new Vector3(3.2 - 0.5 + k * 0.5, 2.3, -2.2);
    const w = createWire([from, from.clone().setY(1.6), new Vector3(from.x + 1.5, 1.9, from.z - 0.2 + k * 0.15), to], { radius: 0.045, color: c, repeat: 1.5, speed: 1.6 });
    set.add(w);
    return w;
  });

  // holographic inset: two sines (generator teal, grid white) and their phasors
  const inset = group('inset', 1.7, 3.55, -2.6);
  const H = 1.9;
  const scope = createHoloScope({ width: 3.6, height: H, channels: ['teal', 'white'], samples: 160 });
  scope.group.position.x = 1.1;
  const dial = createDial(H + 0.1);
  dial.position.x = -1.75;
  const R = dialRadius(H);
  const gArrow = createVectorArrow({ color: 'teal', radius: 0.03, headLength: 0.16, headRadius: 0.07, intensity: 1.5 });
  const nArrow = createVectorArrow({ color: 'white', radius: 0.03, headLength: 0.16, headRadius: 0.07, intensity: 1.3 });
  gArrow.position.set(-1.75, 0, 0.05);
  nArrow.position.set(-1.75, 0, 0.06);
  inset.add(scope.group, dial, gArrow, nArrow);
  set.add(inset);

  // stage 2 inset: rotor and the grid field in the rotating frame, joined by magenta "springs"
  const spring = group('springs', -1.4, 3.55, -2.4);
  spring.add(createDial(2.1));
  const fieldAxis = createVectorArrow({ color: 'white', radius: 0.03, headLength: 0.16, headRadius: 0.07, intensity: 1.1 });
  fieldAxis.set(new Vector3(0, 0, 0.05), new Vector3(0, 0.85, 0));
  const rotorBar = new Group();
  const nPole = new Mesh(G.rbox(0.22, 0.5, 0.12, 0.05), K.toon({ color: SEMANTIC.poleN, gloss: 0.5 }));
  nPole.position.y = 0.3;
  const sPole = new Mesh(G.rbox(0.22, 0.5, 0.12, 0.05), K.toon({ color: SEMANTIC.poleS, gloss: 0.5 }));
  sPole.position.y = -0.3;
  rotorBar.add(nPole, sPole);
  rotorBar.position.z = 0.08;
  const springs = new RibbonLines({ capacity: 120, color: SEMANTIC.fieldB, width: 0.035, intensity: 1.3, dashStrength: 0, keepHue: true });
  springs.position.z = 0.1;
  const deltaTag = tag('', 19, 'white', 'mono');
  deltaTag.position.set(0, -1.25, 0.1);
  spring.add(fieldAxis, rotorBar, springs, deltaTag);
  set.add(spring);
  ctx.stage.actor(spring);
  const flash = createFlash({ size: 2.6, color: 'red' });
  flash.position.set(-2.4, 1.6, -1.2);
  set.add(flash);
  const buf = new Float32Array(160);
  const buf2 = new Float32Array(160);

  // ------------------------------------------------------------------ models and state
  const synchro = createSynchroscope(8, { speedRpm: SYNC.speedRangeRpm.default, excitation: SYNC.excitationRange.default });
  const swing = createSwing({ mechanicalSetpointPu: SWING.powerRange.default, emfPu: SWING.emfRange.default });
  type Phase = 'sync' | 'online' | 'tripped';
  const st = { phase: 'sync' as Phase, tv: 0, rotorAngle: 0, slipSpin: 0, spike: 0, result: null as null | ReturnType<typeof synchro.close>, tripT: 0 };
  const limitsText = `${OWN.limitsGame}: |Δθ| ≤ ${SYNC.limits.angleDeg}°, |Δf| ≤ 0,1 Hz, ΔU ${SYNC.limits.voltageLowPct}…+${SYNC.limits.voltageHighPct} % · IEEE: ±${SYNC.ieeeLimits.angleDeg}°, 0,067 Hz, 0…+${SYNC.ieeeLimits.voltageHighPct} %`;
  const goOnline = (): void => {
    st.phase = 'online';
    swing.set({ mechanicalSetpointPu: ui.value<number>('pm8'), emfPu: ui.value<number>('emf8') });
    swing.reset();
    desk.setKey(true);
  };
  const close = (): void => {
    if (st.phase !== 'sync') return;
    synchro.set({ speedRpm: ui.value<number>('speed8'), excitation: ui.value<number>('exc8') / 100 });
    const r = synchro.close();
    st.result = r;
    hall.sound.breaker();
    if (r.soft) {
      ui.toast(doc(ID, 4), { icon: 'check', tone: 'ok' });
      hall.sound.ok();
      goOnline();
      ui.set('stage8', 'load');
    } else {
      ui.toast(doc(ID, 5), { icon: 'warning', tone: 'warning' });
      hall.sound.error();
      flash.fire();
      st.spike = r.currentSpikePu;
      shake.amount = 1;
      desk.setKey(true);
      ctx.stage.scope.delay(0.9, () => {
        desk.setKey(false);
        synchro.reset();
      });
    }
  };
  ctx.qa.probe('key', desk.key);
  ctx.input.register(desk.keyHit, { tooltip: doc(ID, 3), cursor: 'pointer', enabled: () => hall.isCurrent(ID) && st.phase === 'sync', click: close });
  const mid = new Vector3();
  const zig = (a: Vector3, b: Vector3, stretch: number): Vector3[] => {
    const pts: Vector3[] = [];
    const n = 10;
    const side = new Vector3(-(b.y - a.y), b.x - a.x, 0).normalize();
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const w = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * 0.06 * (1 - Math.min(0.85, stretch));
      pts.push(a.clone().lerp(b, k).addScaledVector(side, w));
    }
    return pts;
  };

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.9, 4.8, 8.6], target: [0, 2.1, -0.7], fov: 36, fit: { center: [0, 2, -0.6], radius: 4.8 } },
    },
    stage: {
      show: [set],
      enter: () => {
        st.phase = ui.value<string>('stage8') === 'load' ? 'online' : 'sync';
        st.result = null;
        st.spike = 0;
        shake.amount = 0;
        synchro.reset();
        desk.setKey(st.phase === 'online');
        if (st.phase === 'online') goOnline();
        ctx.stage.toggle(spring, st.phase !== 'sync', { instant: true });
      },
    },
    ui: {
      honesty: [{ slowed: SLOW, visible: () => st.phase === 'sync' }, 'simplified'],
      controls: [
        {
          type: 'segmented',
          id: 'stage8',
          items: [
            { id: 'sync', label: doc(ID, 0) },
            { id: 'load', label: doc(ID, 6) },
          ],
          value: 'sync',
          onChange: (v) => {
            if (v === 'load' && st.phase !== 'online') goOnline();
            if (v === 'sync') {
              st.phase = 'sync';
              st.result = null;
              desk.setKey(false);
              synchro.reset();
            }
            ctx.stage.toggle(spring, v === 'load');
          },
        },
        { type: 'slider', id: 'speed8', label: doc(ID, 1), min: SYNC.speedRangeRpm.min, max: SYNC.speedRangeRpm.max, step: 1, value: SYNC.speedRangeRpm.default, unit: 'rpm', visible: () => st.phase === 'sync' },
        { type: 'slider', id: 'exc8', label: doc(ID, 2), min: 90, max: 110, step: 0.5, value: SYNC.excitationRange.default * 100, unit: '%', digits: 1, visible: () => st.phase === 'sync' },
        {
          type: 'stats',
          id: 'sync8',
          columns: 3,
          visible: () => st.phase === 'sync',
          items: [
            { label: 'Δf', get: () => fmtUnit(synchro.state.deltaHz, 'Hz', { digits: 2 }), color: () => (Math.abs(synchro.state.deltaHz) <= SYNC.limits.freqHz ? 'green' : 'amber') },
            { label: 'ΔU', get: () => fmtUnit(synchro.state.deltaVoltagePct, '%', { digits: 1 }), color: () => (synchro.state.deltaVoltagePct >= SYNC.limits.voltageLowPct && synchro.state.deltaVoltagePct <= SYNC.limits.voltageHighPct ? 'green' : 'amber') },
            { label: 'Δθ', get: () => `${Math.round(synchro.state.angleDeg)}°`, color: () => (Math.abs(synchro.state.angleDeg) <= SYNC.limits.angleDeg ? 'green' : 'amber') },
          ],
        },
        { type: 'note', id: 'result8', icon: 'info', color: () => (st.result?.soft ? 'green' : 'red'), text: () => `${st.result?.soft ? doc(ID, 4) : doc(ID, 5)} ${limitsText}`, visible: () => st.result !== null },
        { type: 'slider', id: 'pm8', label: doc(ID, 7), min: SWING.powerRange.min, max: SWING.powerRange.max, step: SWING.powerRange.step, value: SWING.powerRange.default, unit: 'p.u.', digits: 2, visible: () => st.phase !== 'sync' },
        { type: 'slider', id: 'emf8', label: doc(ID, 10), min: SWING.emfRange.min, max: SWING.emfRange.max, step: SWING.emfRange.step, value: SWING.emfRange.default, unit: 'p.u.', digits: 2, visible: () => st.phase !== 'sync' },
        {
          type: 'stats',
          id: 'load8',
          columns: 3,
          visible: () => st.phase !== 'sync',
          items: [
            { label: 'δ', get: () => (st.phase === 'online' ? `${Math.round(swing.state.deltaDeg)}°` : '—') },
            { label: 'P', get: () => fmtUnit(st.phase === 'online' ? swing.state.electricalPu : 0, 'p.u.', { digits: 2 }), color: () => 'yellow' },
            { label: 'P_max', get: () => fmtUnit(maxPowerPu(ui.value<number>('emf8')), 'p.u.', { digits: 2 }) },
          ],
        },
        { type: 'note', id: 'trip8', icon: 'warning', color: 'red', text: doc(ID, 9), visible: () => st.phase === 'tripped' },
        { type: 'button', id: 'close8', label: doc(ID, 3), icon: 'lightning', primary: true, onClick: close, visible: () => st.phase === 'sync' },
        { type: 'button', id: 'resync8', label: OWN.resync, icon: 'resetView', visible: () => st.phase === 'tripped', onClick: () => goOnline() },
      ],
      callouts: [
        { anchor: () => desk.panel.localToWorld(mid.set(1.4, -0.2, 0.1)), text: OWN.synchroDesk, side: 'right', visible: () => roomy(hall) },
      ],
      hotspots: [
        { anchor: () => desk.panel.localToWorld(mid.copy(desk.scopeCentre).add(new Vector3(0.35, -0.2, 0.1))), content: 'synchroscope' },
        { anchor: () => desk.panel.localToWorld(mid.copy(desk.lampPoint).add(new Vector3(0.5, 0, 0))), content: 'sync-lamps' },
        { anchor: () => spring.localToWorld(mid.set(0.4, 0.5, 0.1)), content: 'field-springs', visible: () => st.phase !== 'sync' },
      ],
    },
    probe: () => ({
      phase: st.phase,
      fg: synchro.state.generatorHz,
      df: synchro.state.deltaHz,
      dU: synchro.state.deltaVoltagePct,
      angle: synchro.state.angleDeg,
      result: st.result ? (st.result.soft ? 'soft' : 'hit') : null,
      spike: st.spike,
      delta: swing.state.deltaDeg,
      pe: swing.state.electricalPu,
      pmax: swing.state.maxPowerPu,
      outOfStep: swing.state.outOfStep,
    }),
    update(dt) {
      if (!hall.isCurrent(ID)) return;
      st.tv += dt;
      const wt = 2 * Math.PI * st.tv; // 50 Hz shown at 1 Hz in the inset
      let genPhase = 0;
      let genAmp = 1;
      if (st.phase === 'sync') {
        synchro.set({ speedRpm: ui.value<number>('speed8'), excitation: ui.value<number>('exc8') / 100 });
        const s = synchro.step(dt);
        desk.setPointer(s.angleDeg);
        const dark = Math.abs(Math.sin((s.angleDeg * Math.PI) / 360));
        for (const l of desk.lamps) {
          l.mat.intensity = 0.15 + 1.7 * dark;
          l.halo.intensity = 0.9 * dark;
        }
        genPhase = (s.angleDeg * Math.PI) / 180;
        genAmp = ui.value<number>('exc8') / 100;
        desk.meters[0]!.setNeedle((s.generatorHz - 49) / 2);
        desk.meters[1]!.setNeedle((genAmp * 100 - 85) / 30);
        meterTags[0]!.text = fmtUnit(s.generatorHz, 'Hz', { digits: 2 });
        meterTags[1]!.text = fmtUnit(24 * genAmp, 'kV', { digits: 1 });
      } else {
        desk.setPointer(0);
        for (const l of desk.lamps) {
          l.mat.intensity = 0.15;
          l.halo.intensity = 0;
        }
        desk.meters[0]!.setNeedle(0.5);
        desk.meters[1]!.setNeedle(0.5);
        meterTags[0]!.text = fmtUnit(50, 'Hz', { digits: 2 });
        meterTags[1]!.text = fmtUnit(24, 'kV', { digits: 1 });
      }
      desk.meters[2]!.setNeedle(0.5);
      desk.meters[3]!.setNeedle(0.5);
      meterTags[2]!.text = fmtUnit(50, 'Hz', { digits: 2 });
      meterTags[3]!.text = fmtUnit(24, 'kV', { digits: 1 });
      // phone portrait: the four values cannot sit side by side — keep the frequencies (what the operator matches)
      meterTags[1]!.visible = meterTags[3]!.visible = !narrow(hall);

      // stage 2: the swing of the rotor against the grid (real time)
      if (st.phase === 'online') {
        swing.set({ mechanicalSetpointPu: ui.value<number>('pm8'), emfPu: ui.value<number>('emf8') });
        const s = swing.step(dt);
        if (s.outOfStep) {
          st.phase = 'tripped';
          st.slipSpin = 2.5;
          desk.setKey(false);
          hall.sound.breaker();
          hall.sound.error();
          ui.toast(doc(ID, 9), { icon: 'warning', tone: 'warning' });
        }
        st.rotorAngle = (s.deltaDeg * Math.PI) / 180;
        genPhase = st.rotorAngle;
      } else if (st.phase === 'tripped' && st.slipSpin > 0) {
        st.slipSpin -= dt;
        st.rotorAngle += dt * 9 * Math.max(0, st.slipSpin / 2.5); // poles slipping, then coasting
      }
      const online = st.phase === 'online';
      rotorBar.rotation.z = st.rotorAngle;
      const pe = online ? swing.state.electricalPu : 0;
      const tipN = new Vector3(-Math.sin(st.rotorAngle) * 0.55, Math.cos(st.rotorAngle) * 0.55, 0);
      const stretch = Math.min(1, Math.abs(st.rotorAngle) / (Math.PI / 2));
      springs.visible = st.phase !== 'tripped';
      springs.setLines([
        { points: zig(new Vector3(0, 0.85, 0), tipN, stretch) },
        { points: zig(new Vector3(0, -0.85, 0), tipN.clone().negate(), stretch) },
      ]);
      springs.intensity = 0.8 + 1.2 * Math.min(1, pe);
      deltaTag.text = online ? `δ = ${Math.round(swing.state.deltaDeg)}°` : '';
      for (const w of bus) w.material.power = Math.min(1, pe / 1.2);
      // inset: grid (white) and generator (teal) sines and phasors
      const n = buf.length;
      for (let i = 0; i < n; i++) {
        const ph = wt - (i / (n - 1)) * 4 * Math.PI;
        buf[i] = Math.sin(ph) * 0.8;
        buf2[i] = Math.sin(ph + genPhase) * 0.8 * (online ? 1 : genAmp);
      }
      scope.setTrace(0, buf2);
      scope.setTrace(1, buf);
      const r = R * 0.8;
      nArrow.set(nArrow.position.clone(), new Vector3(Math.cos(wt) * r, Math.sin(wt) * r, 0));
      const rg = r * (online ? ui.value<number>('emf8') / 2.2 : genAmp);
      gArrow.set(gArrow.position.clone(), new Vector3(Math.cos(wt + genPhase) * rg, Math.sin(wt + genPhase) * rg, 0));
      // the machine: rotor turning, a hit shakes it
      tg.part('rotor').rotation.x += dt * 3;
      shake.amount = Math.max(0, shake.amount - dt * 0.7);
      shake.update(dt, st.tv);
      st.spike = Math.max(0, st.spike - dt * 3);
      hall.sound.turbine = 0.25;
      hall.sound.turbinePitch = 0.9 + (st.phase === 'sync' ? synchro.state.deltaHz * 0.2 : 0);
      hall.sound.hum = 0.1 + 0.2 * Math.min(1, pe);
      hall.sound.buzz = st.phase === 'tripped' && st.slipSpin > 0 ? 0.5 : 0;
    },
  };
};
