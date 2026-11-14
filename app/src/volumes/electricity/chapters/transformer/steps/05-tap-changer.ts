/**
 * Step 5 `tap-changer` — inside the OLTC compartment: the tapped part of the HV winding with its 19 leads, the
 * selector disc (−9…+9) whose arm walks to tap n, the diverter switch whose two transition resistors glow for the
 * instant both neighbouring taps are bridged (current never interrupted), and the regulator cabinet with
 * «вище / нижче» lamps. The board (titled with the 115/11 kV substation transformer it belongs to) plots the
 * 10 kV bus voltage over time against the green corridor 10,5 kV ± 1 %. Model: Т4 (`createTapChanger`); the
 * regulator acts only after the voltage has stayed outside the corridor for the delay (1,5 s here).
 */
import { Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { STATUS, type Chart } from '@/ui3d';
import { TAP, createTapChanger } from '@electricity/sim/transformer';
import type { StepFactory } from '../chapter';
import { doc, hot, splitCaps, splitList } from '../labels';
import { OWN } from '../labels-own';
import { createOltcInset } from '../parts/oltc-inset';
import { TAPS, createTapSelector, tapAngle } from '../parts/tap-selector';
import { group } from '../world';

const ID = 'tap-changer';
const WINDOW_S = 30;
const UPPER = TAP.setpointKV * (1 + TAP.bandFraction);
const LOWER = TAP.setpointKV * (1 - TAP.bandFraction);

export const tapChanger: StepFactory = (tx) => {
  const { ui } = tx;
  const sel = createTapSelector();
  const inset = createOltcInset();
  const set = group(`set:${ID}`, 0, 0, 0, [sel.group, inset.group]);
  tx.stageRoot.add(set);

  const oltc = createTapChanger(0);
  const hv = (): number => ui.value<number>('hv5');
  const load = (): number => ui.value<number>('load5') / 100;
  const auto = (): boolean => ui.value<string>('mode5') === 'auto';
  const [upLabel = '▲', downLabel = '▼'] = splitList(doc(ID, 3));
  let shown = 0;
  let trans = 1;
  let outside = 0;
  let clock = 0;
  let pushed = -1;
  const at = (v: Vector3): (() => Vector3) => {
    const out = new Vector3();
    return () => tx.stageRoot.localToWorld(out.copy(v));
  };
  const manual = (d: 1 | -1): void => {
    oltc.manual(d, { hvKV: hv(), loadPu: load() });
    trans = 0;
    tx.sound.click(d > 0 ? 1.15 : 0.9);
  };
  const plot = (c: Chart, t: number): void => {
    if (t - pushed < 0.1) return;
    pushed = t;
    c.push('lv', clock, oltc.state.lvKV);
    c.push('hi', clock, UPPER);
    c.push('lo', clock, LOWER);
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.5, 2.6, 7.9],
        target: [0.2, 2.0, -0.6],
        fov: 32,
        frameAspect: 1.45,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0.2, 2.1, -0.6], radius: 4.1 },
      },
    },
    stage: {
      show: [set],
      envTune: { top: 'bg.deep', mid: 'bg.violet', keyColor: 'amber.light', rimColor: 'amber', rimIntensity: 0.5 },
      enter: () => {
        shown = oltc.state.tap;
        trans = 1;
        outside = 0;
        pushed = -1;
      },
    },
    ui: {
      hint: OWN.hint5,
      honesty: [{ text: OWN.sped5 }, 'simplified', 'notToScale'],
      controls: [
        { type: 'slider', id: 'hv5', label: doc(ID, 0), min: TAP.hvRangeKV.min, max: TAP.hvRangeKV.max, step: TAP.hvRangeKV.step, value: TAP.hvRangeKV.default, unit: 'kV', digits: 1 },
        { type: 'slider', id: 'load5', label: doc(ID, 1), min: 0, max: 100, step: 5, value: 50, unit: '%', digits: 0 },
        {
          type: 'segmented',
          id: 'mode5',
          items: splitCaps(doc(ID, 2)).map((label, i) => ({ id: i === 0 ? 'auto' : 'manual', label })),
          value: 'auto',
        },
        { type: 'gauge', id: 'bus5', kind: 'linear', label: OWN.bus5, min: 9.4, max: 11.6, unit: 'kV', digits: 2, get: () => oltc.state.lvKV, zones: [{ from: 9.4, to: LOWER, color: STATUS.warning }, { from: LOWER, to: UPPER, color: STATUS.ok }, { from: UPPER, to: 11.6, color: STATUS.warning }] },
        { type: 'readout', id: 'tap5', label: OWN.tapNo, text: () => fmtNumber(oltc.state.tap, { sign: true }) },
        { type: 'button', id: 'up5', label: upLabel, visible: () => !auto(), disabled: () => oltc.state.tap >= TAP.maxTap, onClick: () => manual(1) },
        { type: 'button', id: 'down5', label: downLabel, visible: () => !auto(), disabled: () => oltc.state.tap <= TAP.minTap, onClick: () => manual(-1) },
      ],
      board: {
        title: OWN.board5,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'trace5',
            chart: {
              height: 170,
              window: WINDOW_S,
              x: { min: 0, max: WINDOW_S, label: 't, s' },
              y: { min: 9.4, max: 11.6, label: 'U, kV' },
              series: [
                { id: 'hi', label: OWN.corridor, color: 'green', dash: true },
                { id: 'lo', color: 'green', dash: true },
                { id: 'lv', label: OWN.bus5, color: 'sky' },
              ],
            },
            init: () => (pushed = -1),
            update: plot,
          },
        ],
      },
      callouts: [
        { anchor: at(new Vector3(-2.75, 1.0, 0.58)), text: OWN.tapWinding, color: 'coral', side: 'down' },
        { anchor: at(sel.anchorLocal('selector')), text: () => `${OWN.selector} · n = ${fmtNumber(oltc.state.tap, { sign: true })}`, side: 'up' },
      ],
      hotspots: [
        { anchor: at(sel.anchorLocal('diverter')), content: hot(ID, 0) },
        { anchor: at(sel.anchorLocal('regulator')), content: hot(ID, 1) },
      ],
    },
    probe: () => ({ hv: hv(), load: load(), auto: auto(), tap: oltc.state.tap, lv: oltc.state.lvKV, inBand: oltc.state.inBand }),
    update(dt) {
      clock += dt;
      const s0 = oltc.step(0, { hvKV: hv(), loadPu: load(), auto: false });
      outside = s0.inBand ? 0 : outside + dt;
      const s = oltc.step(dt, { hvKV: hv(), loadPu: load(), auto: auto() && outside >= TAP.stepDelayS });
      if (s.changed) {
        trans = 0;
        outside = 0;
        tx.sound.click(1);
      }
      trans = Math.min(1, trans + dt / 0.7);
      shown += (s.tap - shown) * Math.min(1, dt * 6);
      sel.part('arm').rotation.z = tapAngle(Math.max(-TAPS, Math.min(TAPS, shown)));
      // diverter: the moving contact swings across, both resistors carry current in the middle of the swing
      const swing = Math.sin(Math.min(1, trans) * Math.PI);
      sel.part('diverter').rotation.z = (trans < 1 ? 1 - 2 * trans : 0) * 0.5;
      sel.resistors.forEach((m) => (m.intensity = 0.15 + 1.6 * swing));
      const high = s.lvKV > UPPER;
      const low = s.lvKV < LOWER;
      const blink = 0.6 + 0.4 * Math.sin(clock * 8);
      sel.lampUp.intensity = low ? 1.7 * blink : 0.15;
      sel.lampDown.intensity = high ? 1.7 * blink : 0.15;
      inset.setPulse(0.5 + 0.5 * Math.sin(clock * 2.2));
      tx.sound.hum = 0.12;
    },
  };
};

