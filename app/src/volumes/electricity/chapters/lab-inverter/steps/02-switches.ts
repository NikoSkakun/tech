/**
 * Step 2 `switches` — a power transistor cut open: the gate's field opens a channel of electrons. Beside it the
 * twin experiments: the same transistor as a half-open «кран» (burns the voltage difference) and as a «ключ»
 * (fully on / off). Model: `tapLosses` / `switchLosses` (§M5); the board plots the switch's loss against the
 * switching frequency.
 */
import { Vector3 } from 'three';
import { fmtPercent, fmtSI } from '@/content';
import { damp } from '@/engine/api';
import { applyHeat } from '@/fx';
import { STATUS, type Chart } from '@/ui3d';
import { switchLosses, tapLosses, type LossResult } from '@electricity/sim/lab-inverter';
import type { StepFactory } from '../chapter';
import { doc, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { createTwin } from '../parts/loss-twins';
import { createPowerSwitch } from '../parts/power-switch';
import { group } from '../world';

const ID = 'switches';
const UDC = 400;
/** One slow-motion switching period of the crystal in «Ключ» mode, s (20 kHz in reality → «сповільнено»). */
const PERIOD = 1.6;

export const switches: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const sw = createPowerSwitch(ctx);
  const crystal = group('crystal', -1.75, 1.6, -0.2, [sw.group]);
  crystal.scale.setScalar(1.22);
  const tap = createTwin('tap');
  const key = createTwin('switch');
  tap.group.position.set(2.55, 0, 1.5);
  key.group.position.set(4.75, 0, 1.5);
  tap.group.scale.setScalar(1.2);
  key.group.scale.setScalar(1.2);
  const set = group(`set:${ID}`, 0, 0, 0, [crystal, tap.group, key.group]);
  lab.stageRoot.add(set);

  const [tapName, keyName] = splitPair(doc(ID, 0));
  const mode = (): 'tap' | 'switch' => ui.value<'tap' | 'switch'>('mode2');
  const U = (): number => ui.value<number>('u2');
  const I = (): number => ui.value<number>('i2');
  const F = (): number => ui.value<number>('f2') * 1000;
  let gateOn = true;
  let lossTap: LossResult = tapLosses(230, 10, UDC);
  let lossKey: LossResult = switchLosses(230, 10, 20000, UDC);
  const now = (): LossResult => (mode() === 'tap' ? lossTap : lossKey);
  let chart: Chart | null = null;

  function recompute(): void {
    lossTap = tapLosses(U(), I(), UDC);
    lossKey = switchLosses(U(), I(), F(), UDC);
    tap.setLoss(lossTap.pLossW);
    key.setLoss(lossKey.pLossW);
    tap.tag.text = fmtSI(lossTap.pLossW, 'W');
    key.tag.text = fmtSI(lossKey.pLossW, 'W');
    tap.setFocus(mode() === 'tap');
    key.setFocus(mode() === 'switch');
    if (!chart) return;
    // loss of the switch pair against frequency for the present current: flat conduction part + rising switching part
    const fs: number[] = [];
    const total: number[] = [];
    const cond: number[] = [];
    for (let k = 0; k <= 40; k++) {
      const f = 10 ** ((k / 40) * Math.log10(200));
      const r = switchLosses(U(), I(), f * 1000, UDC);
      fs.push(f);
      total.push(r.pLossW);
      cond.push(2 * (r.conductionW ?? 0));
    }
    chart.setAxis('y', { max: Math.max(20, Math.ceil(total[40]! / 20) * 20) });
    chart.setData('total', fs, total);
    chart.setData('cond', fs, cond);
    chart.setMarker('now', {
      x: F() / 1000,
      y: lossKey.pLossW,
      color: 'yellow',
      label: fmtSI(lossKey.pLossW, 'W'),
    });
  }
  for (const id of ['mode2', 'u2', 'i2', 'f2']) ui.onChange(id, recompute);

  const world = (p: Vector3): (() => Vector3) => {
    const out = new Vector3();
    return () => sw.group.localToWorld(out.copy(p));
  };
  const twinTop = (g: typeof tap.group, y: number, x = 0): (() => Vector3) => {
    const out = new Vector3();
    return () => g.localToWorld(out.set(x, y, 0));
  };
  let g = 1;

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [1.4, 5.2, 13.4],
        target: [0.9, 2.2, 0],
        fov: 30,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0.6, 2, 0], radius: 5.6 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        gateOn = true;
        recompute();
      },
      post: { bloomIntensity: 1.15 },
    },
    ui: {
      hint: OWN.hint2,
      honesty: ['notToScale', 'simplified', { slowed: 30000 }],
      controls: [
        {
          type: 'segmented',
          id: 'mode2',
          items: [
            { id: 'tap', label: tapName },
            { id: 'switch', label: keyName },
          ],
          value: 'tap',
        },
        {
          type: 'slider',
          id: 'u2',
          label: doc(ID, 1),
          min: 0,
          max: 400,
          step: 10,
          value: 230,
          unit: 'V',
          digits: 0,
        },
        {
          type: 'slider',
          id: 'i2',
          label: doc(ID, 2),
          min: 1,
          max: 20,
          step: 1,
          value: 10,
          unit: 'A',
          digits: 0,
        },
        {
          type: 'slider',
          id: 'f2',
          label: doc(ID, 5),
          min: 1,
          max: 200,
          scale: 'log',
          step: 2,
          value: 20,
          unit: 'kHz',
          disabled: () => mode() === 'tap',
        },
        {
          type: 'stats',
          id: 'stats2',
          columns: 3,
          items: [
            { label: OWN.pOut, get: () => fmtSI(now().pOutW, 'W') },
            {
              label: OWN.pLoss,
              get: () => fmtSI(now().pLossW, 'W'),
              color: () => (now().pLossW > 200 ? STATUS.alarm : STATUS.ok),
            },
            { label: OWN.eta, get: () => fmtPercent(now().efficiency, 1) },
          ],
        },
        { type: 'note', id: 'note2', text: doc(ID, 7), icon: 'info', visible: () => mode() === 'switch' },
        {
          type: 'button',
          id: 'gate2',
          label: doc(ID, 8),
          icon: 'lightning',
          primary: true,
          onClick: () => {
            gateOn = !gateOn;
            lab.sound.click(gateOn ? 1.3 : 0.8);
            ui.toast(gateOn ? OWN.gateOpen : OWN.gateClosed, { icon: 'lightning' });
          },
        },
      ],
      board: {
        title: OWN.board2,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'chart2',
            chart: {
              height: 190,
              x: { min: 1, max: 200, log: true, label: OWN.axisF },
              y: { min: 0, max: 100, label: OWN.axisP },
              series: [
                { id: 'total', label: OWN.lossTotal, color: 'yellow' },
                { id: 'cond', label: OWN.lossCond, color: 'sky', dash: true },
              ],
            },
            init: (c) => {
              chart = c;
              recompute();
            },
          },
          {
            type: 'table',
            id: 'table2',
            head: [OWN.mode, OWN.pLoss, OWN.eta],
            rows: () => [
              [tapName, fmtSI(lossTap.pLossW, 'W'), fmtPercent(lossTap.efficiency, 1)],
              [keyName, fmtSI(lossKey.pLossW, 'W'), fmtPercent(lossKey.efficiency, 1)],
            ],
            highlight: () => (mode() === 'tap' ? 0 : 1),
          },
        ],
      },
      callouts: [
        { anchor: world(sw.points.source), text: OWN.source, side: 'left' },
        { anchor: world(sw.points.drain), text: OWN.drain, side: 'down' },
        { anchor: world(sw.points.pWell), text: OWN.pRegion, color: 'pink', side: 'right' },
        { anchor: world(sw.points.drift), text: OWN.nRegion, color: 'teal', side: 'down' },
        {
          anchor: world(sw.points.channel),
          text: OWN.channel,
          color: 'cyan',
          side: 'up',
          visible: () => g > 0.5,
        },
        { anchor: twinTop(tap.group, 1.75), text: tapName, color: 'coral', side: 'up' },
        { anchor: twinTop(key.group, 1.75), text: keyName, color: 'teal', side: 'up' },
      ],
      hotspots: [
        { anchor: world(sw.points.gate), content: 'gate' },
        { anchor: twinTop(key.group, 1.0, 0.35), content: 'heatsink' },
      ],
    },
    probe: () => ({
      mode: mode(),
      pLoss: now().pLossW,
      pOut: now().pOutW,
      eta: now().efficiency,
      gate: g,
      gateOn,
      lossKey: lossKey.pLossW,
    }),
    update(dt, t) {
      // «Кран»: the channel is held half-open in proportion to the output voltage; «Ключ»: fully on for the
      // duty share U/U_dc of every (slowed) period, fully off for the rest
      const duty = U() / UDC;
      const pulse = (t % PERIOD) / PERIOD < Math.max(0.06, Math.min(0.94, duty));
      const want = !gateOn ? 0 : mode() === 'tap' ? 0.22 + 0.5 * duty : pulse ? 1 : 0;
      g = damp(g, want, mode() === 'tap' ? 6 : 22, dt);
      sw.setGate(g, 0.4 + 0.6 * (I() / 20));
      // the crystal glows with the heat of the selected mode (log scale, like the thermometers)
      const k = Math.min(1, Math.log10(Math.max(now().pLossW, 1)) / Math.log10(4000));
      applyHeat(sw.silicon, gateOn ? k * k * 0.45 : 0, 1.0);
      key.blink(gateOn && pulse);
      tap.blink(gateOn);
      crystal.position.y = 1.6 + Math.sin(t * 0.9) * 0.05;
      lab.sound.buzz = mode() === 'switch' && gateOn ? 0.05 + 0.1 * (F() / 200000) : 0;
    },
  };
};
