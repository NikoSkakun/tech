/**
 * Step 9 `rlc` — the lab board: AC source, R, L, C in series. Each element has its own mini scope (current
 * `cyan`, its voltage `yellow`: in phase on R, leading by 90° on L, lagging on C). Behind, the big phasor
 * diagram: current along +x, U_R along it, U_L up, U_C down, their sum = the source voltage at angle φ. The board
 * (HUD) has I(f) and |Z|(f) with the resonance peak and the operating point. Model Г6 `rlcCircuit`.
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { createVectorArrow } from '@/fx';
import { RLC, rlcCircuit, rlcCurrentCurve, type RlcMode } from '@electricity/sim/generator-ac';
import type { StepFactory } from '../chapter';
import { doc, splitAll } from '../labels';
import { OWN } from '../labels-own';
import { createDial, createHoloScope, type HoloScope } from '../parts/holo-scope';
import { createRlcBoard } from '../parts/rlc-board';
import { group, roomy, tag } from '../world';

const ID = 'rlc';
const SLOW = 100;
const MODES: readonly RlcMode[] = ['R', 'L', 'C', 'RLC'];
const V_SCALE = 520; // volts at full length of a phasor on the diagram (resonance: 460 V fits)

export const rlc: StepFactory = (hall) => {
  const { ui } = hall;
  const set = group(ID, 0, 1.05, 0.9);
  hall.stageRoot.add(set);
  const board = createRlcBoard();
  set.add(board.group);
  const scopes: Record<'R' | 'L' | 'C', HoloScope> = {} as Record<'R' | 'L' | 'C', HoloScope>;
  for (const k of ['R', 'L', 'C'] as const) {
    const s = createHoloScope({ width: 1.2, height: 0.8, channels: ['cyan', 'yellow'], samples: 120, lineWidth: 0.022 });
    s.group.position.copy(board.top[k]).add(new Vector3(0, 0.75, -0.2));
    s.group.rotation.x = -0.12;
    set.add(s.group);
    scopes[k] = s;
    const t = tag(k, 20, 'white');
    t.position.copy(s.group.position).add(new Vector3(0, 0.55, 0));
    set.add(t);
  }
  // the big phasor diagram behind the board
  const diagram = group('diagram', 0.2, 2.65, -1.7);
  diagram.add(createDial(3.0));
  const A = 1.25; // length of V_SCALE on the diagram
  const mk = (c: string, r = 0.035) => {
    const a = createVectorArrow({ color: c, radius: r, headLength: 0.18, headRadius: 0.08, intensity: 1.5 });
    diagram.add(a);
    return a;
  };
  const iArrow = mk('cyan');
  const uR = mk('yellow');
  const uL = mk('orange');
  const uC = mk('sky');
  const uS = mk('white', 0.045);
  const tags = { I: tag('I', 19, 'cyan', 'mono'), R: tag('U_R', 18, 'yellow', 'mono'), L: tag('U_L', 18, 'orange', 'mono'), C: tag('U_C', 18, 'sky', 'mono'), U: tag('U', 19, 'white', 'mono'), phi: tag('', 19, 'white', 'mono') };
  diagram.add(...Object.values(tags));
  set.add(diagram);

  const mode = (): RlcMode => (ui.value<string>('mode9') as RlcMode) ?? 'RLC';
  const params = () => ({ resistanceOhm: ui.value<number>('R9'), inductanceH: ui.value<number>('L9'), capacitanceF: ui.value<number>('C9') * 1e-6 });
  const model = () => rlcCircuit({ frequencyHz: ui.value<number>('f9'), mode: mode(), ...params() });
  const st = { tv: 0 };
  const bufs = { i: new Float32Array(120), u: new Float32Array(120) };
  const mid = new Vector3();
  let curveKey = '';
  const labels = splitAll(doc(ID, 4));
  const drawDiagram = (): void => {
    const m = model();
    const k = A / V_SCALE;
    const o = new Vector3(-1.1, 0, 0.05);
    iArrow.set(o.clone().setY(-0.08), new Vector3(Math.min(1.2, (m.currentA / 6) * 1.2), 0, 0));
    const r = new Vector3(m.voltageRV * k, 0, 0);
    uR.set(o.clone(), r);
    const l = new Vector3(0, m.voltageLV * k, 0);
    uL.set(o.clone().add(r).setZ(0.06), l);
    const c = new Vector3(0, -m.voltageCV * k, 0);
    uC.set(o.clone().add(r).add(l).add(new Vector3(0.12, 0, 0)).setZ(0.07), c); // drawn a little aside so U_L and U_C stay readable
    const sum = r.clone().add(l).add(c);
    uS.set(o.clone().setZ(0.08), sum);
    tags.I.position.copy(o).add(new Vector3(0.15, -0.28, 0.05));
    tags.R.position.copy(o).add(r.clone().multiplyScalar(0.5)).add(new Vector3(0, -0.22, 0.05));
    tags.L.position.copy(o).add(r).add(l.clone().multiplyScalar(0.5)).add(new Vector3(0.38, 0, 0.05));
    tags.C.position.copy(o).add(r).add(l).add(c.clone().multiplyScalar(0.5)).add(new Vector3(-0.38, 0, 0.05));
    tags.U.position.copy(o).add(sum).add(new Vector3(0.22, 0.12, 0.05));
    tags.phi.text = `φ = ${m.phaseDeg >= 0 ? '+' : '−'}${Math.abs(m.phaseDeg).toFixed(1).replace('.', ',')}°`;
    tags.phi.position.set(-0.3, 1.2, 0.08);
  };

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.5, 3.7, 6.6], target: [0.15, 2.35, -0.3], fov: 34, fit: { center: [0.1, 2.35, -0.2], radius: 3.3 } },
    },
    stage: { show: [set] },
    ui: {
      honesty: [{ slowed: SLOW }],
      controls: [
        { type: 'slider', id: 'f9', label: doc(ID, 0), min: RLC.frequencyRange.min, max: RLC.frequencyRange.max, step: RLC.frequencyRange.step, value: RLC.frequencyRange.default, unit: 'Hz', digits: 1 },
        { type: 'slider', id: 'R9', label: doc(ID, 1), min: RLC.resistanceRange.min, max: RLC.resistanceRange.max, step: 1, value: RLC.resistanceRange.default, unit: 'Ω' },
        { type: 'slider', id: 'L9', label: doc(ID, 2), min: RLC.inductanceRange.min, max: RLC.inductanceRange.max, step: 0.01, value: RLC.inductanceRange.default, unit: 'H', digits: 2 },
        { type: 'slider', id: 'C9', label: doc(ID, 3), min: 5, max: 100, step: 1, value: 30, unit: 'μF' },
        { type: 'segmented', id: 'mode9', items: MODES.map((m, i) => ({ id: m, label: labels[i] ?? m })), value: 'RLC' },
        { type: 'note', id: 'over9', icon: 'warning', color: 'red', text: doc(ID, 5), visible: () => model().overvoltage },
      ],
      board: {
        title: OWN.resonanceBoard,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'curve9',
            chart: {
              height: 190,
              x: { min: RLC.frequencyRange.min, max: RLC.frequencyRange.max, label: 'f, Hz' },
              y: { min: 0, max: 5, label: 'I, A' },
              y2: { min: 0, max: 600, label: 'Z, Ω' },
              series: [
                { id: 'i', label: 'I(f)', color: 'cyan', width: 3 },
                { id: 'z', label: '|Z|(f)', color: 'mist', axis: 'y2', dash: true, opacity: 0.6 },
              ],
            },
            update: (chart) => {
              const key = `${ui.value<number>('R9')}|${ui.value<number>('L9')}|${ui.value<number>('C9')}`;
              if (key !== curveKey) {
                curveKey = key;
                const c = rlcCurrentCurve(params());
                chart.setData('i', c.map((s) => s.frequencyHz), c.map((s) => s.currentA));
                chart.setData('z', c.map((s) => s.frequencyHz), c.map((s) => Math.min(600, RLC.voltageV / Math.max(1e-6, s.currentA))));
              }
              const m = rlcCircuit({ frequencyHz: ui.value<number>('f9'), mode: 'RLC', ...params() });
              chart.setMarker('op', { x: ui.value<number>('f9'), y: m.currentA, label: fmtUnit(ui.value<number>('f9'), 'Hz', { digits: 1 }) });
            },
          },
          {
            type: 'stats',
            id: 'read9',
            columns: 4,
            items: [
              { label: 'X_L', get: () => fmtUnit(model().reactanceLOhm, 'Ω', { digits: 1 }) },
              { label: 'X_C', get: () => fmtUnit(model().reactanceCOhm, 'Ω', { digits: 1 }) },
              { label: 'Z', get: () => fmtUnit(model().impedanceOhm, 'Ω', { digits: 1 }) },
              { label: 'I', get: () => fmtUnit(model().currentA, 'A', { digits: 2 }), color: () => 'cyan' },
              { label: 'φ', get: () => `${model().phaseDeg.toFixed(1).replace('.', ',').replace('-', '−')}°` },
              { label: 'U_R', get: () => fmtUnit(model().voltageRV, 'V', { digits: 0 }), color: () => 'yellow' },
              { label: 'U_L', get: () => fmtUnit(model().voltageLV, 'V', { digits: 0 }), color: () => (model().voltageLV > 1.5 * RLC.voltageV ? 'red' : 'orange') },
              { label: 'U_C', get: () => fmtUnit(model().voltageCV, 'V', { digits: 0 }), color: () => (model().voltageCV > 1.5 * RLC.voltageV ? 'red' : 'sky') },
            ],
          },
        ],
      },
      callouts: [
        { anchor: () => board.parts.source.localToWorld(mid.set(0, 0.7, 0)), text: OWN.acSource, side: 'left', visible: () => roomy(hall) },
      ],
      hotspots: [
        { anchor: () => board.parts.L.localToWorld(mid.set(0.3, 0.45, 0.2)), content: 0 },
        { anchor: () => board.parts.C.localToWorld(mid.set(0.3, 0.45, 0.2)), content: 1 },
        { anchor: () => diagram.localToWorld(mid.set(1.2, 1.2, 0.1)), content: 2 },
      ],
    },
    probe: () => {
      const m = model();
      return { f: ui.value<number>('f9'), mode: mode(), Z: m.impedanceOhm, I: m.currentA, phi: m.phaseDeg, UL: m.voltageLV, UC: m.voltageCV, over: m.overvoltage, coilGlow: board.coilGlow.emissiveIntensity };
    },
    update(dt) {
      if (!hall.isCurrent(ID)) return;
      st.tv += dt;
      const m = model();
      drawDiagram();
      // mini scopes: 2 periods, drifting at f/100 (slowed ×100); i = sin(θ − φ), element voltage relative to i
      const th0 = (2 * Math.PI * ui.value<number>('f9') * st.tv) / SLOW;
      const iAmp = Math.min(1, m.currentA / 5);
      const elem: Record<'R' | 'L' | 'C', [number, number]> = { R: [m.voltageRV, 0], L: [m.voltageLV, Math.PI / 2], C: [m.voltageCV, -Math.PI / 2] };
      for (const key of ['R', 'L', 'C'] as const) {
        const [u, shift] = elem[key];
        const n = bufs.i.length;
        for (let i = 0; i < n; i++) {
          const th = th0 - (i / (n - 1)) * 4 * Math.PI - (m.phaseDeg * Math.PI) / 180;
          bufs.i[i] = Math.sin(th) * iAmp * 0.9;
          bufs.u[i] = Math.sin(th + shift) * Math.min(1.1, u / 500);
        }
        scopes[key].setTrace(0, bufs.i);
        scopes[key].setTrace(1, bufs.u);
      }
      const used = { R: mode() === 'R' || mode() === 'RLC', L: mode() === 'L' || mode() === 'RLC', C: mode() === 'C' || mode() === 'RLC' };
      for (const key of ['R', 'L', 'C'] as const) board.parts[key].scale.setScalar(used[key] ? 1 : 0.75);
      board.coilGlow.emissiveIntensity = Math.min(1.2, Math.max(0, m.voltageLV / RLC.voltageV - 1) * 0.9);
      board.capGlow.emissiveIntensity = Math.min(1.2, Math.max(0, m.voltageCV / RLC.voltageV - 1) * 0.9);
      board.loop.material.power = Math.min(1, m.currentA / 5);
      board.loop.material.speed = 0.4 + m.currentA * 0.3;
      hall.sound.hum = 0.06 + 0.25 * Math.min(1, m.currentA / 5);
      hall.sound.humPitch = Math.max(0.4, Math.min(4, ui.value<number>('f9') / 25));
    },
  };
};
