/**
 * Step 6 `dc-link` — the left half of the opened inverter: where the 400 V of the DC link come from. The
 * boost stage chops with the duty D that the string voltage asks for (its choke's field swells while the
 * switch is on and dumps into the link when it is off); the 48 V battery reaches the link through the
 * isolated converter with the small ferrite transformer, in both directions. Two scales weigh that ferrite
 * transformer against the 50 Hz toroid of a low-frequency inverter. The board plots the efficiency curves.
 * Model: `boostDuty`, `efficiency`, `euroEfficiency`, `peakEfficiency` (§M5).
 */
import { Mesh, TorusGeometry, Vector3 } from 'three';
import { fmtNumber, fmtPercent, fmtSI } from '@/content';
import { createVectorArrow } from '@/fx';
import { K, PLANT_TYPE, SEMANTIC } from '@/style';
import { STATUS, type Chart } from '@/ui3d';
import {
  LI6_LOSSES,
  boostDuty,
  efficiency,
  euroEfficiency,
  peakEfficiency,
} from '@electricity/sim/lab-inverter';
import type { StepFactory } from '../chapter';
import { doc, pairTitle, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { invToSet } from '../parts/bench-set';
import { STAGE, type StageName } from '../parts/inverter-layout';
import { createFerriteScale, createToroidScale } from '../parts/weigh-compare';
import { group } from '../world';
import { sharedBench } from './shared-bench';

const ID = 'dc-link';
const U_LINK = 400;
/** One slowed switching period of the boost stage on screen, s. */
const PERIOD = 0.9;

export const dcLink: StepFactory = (lab) => {
  const { ui } = lab;
  const bench = sharedBench(lab);
  const { inv } = bench;

  // field of the boost choke: a magenta ring that swells while the switch is on
  const ringMat = K.glow({ color: SEMANTIC.fieldB, intensity: 0, whiten: 0, keepHue: true, falloff: 0 });
  const rings = (['chokeA', 'chokeB'] as const).map((name) => {
    const m = new Mesh(new TorusGeometry(0.34, 0.016, 8, 48).rotateX(Math.PI / 2), ringMat);
    m.position.set(STAGE[name].at.x, 0.2, STAGE[name].at.z);
    inv.group.add(m);
    return m;
  });
  // direction of the energy through the battery-side transformer
  const arrow = createVectorArrow({
    color: SEMANTIC.current,
    radius: 0.045,
    headLength: 0.24,
    headRadius: 0.12,
    intensity: 1.5,
  });
  arrow.position.set(STAGE.transformer.at.x, 1.15, STAGE.transformer.at.z);
  arrow.visible = false;
  inv.group.add(arrow);

  const hf = createFerriteScale('');
  const lf = createToroidScale('');
  hf.group.position.set(0.3, 0, 2.6);
  lf.group.position.set(2.1, 0, 2.6);
  hf.group.scale.setScalar(0.9);
  lf.group.scale.setScalar(0.9);
  const scales = group(`set:${ID}`, 0, 0, 0, [hf.group, lf.group]);
  lab.stageRoot.add(scales);

  const [pvName, batName] = splitPair(doc(ID, 2));
  const [outName, inName] = splitPair(doc(ID, 4));
  const [hfName, lfName] = splitPair(doc(ID, 5));
  const fromBattery = (): boolean => ui.value<string>('src6') === 'bat';
  const charging = (): boolean => fromBattery() && ui.value<string>('dir6') === 'charge';
  const uIn = (): number => ui.value<number>('uin6');
  const duty = (): number => boostDuty(uIn(), U_LINK);
  const loadW = (): number => ui.value<number>('load6') * 1000;
  const curve = (): (typeof LI6_LOSSES)[keyof typeof LI6_LOSSES] =>
    fromBattery() ? LI6_LOSSES.batToAc : LI6_LOSSES.pvToAc;
  const eta = (): number => efficiency(loadW(), curve());

  function plot(c: Chart): void {
    const xs: number[] = [];
    const pv: number[] = [];
    const bat: number[] = [];
    for (let k = 1; k <= 120; k++) {
      const p = k * 50;
      xs.push(p / 1000);
      pv.push(efficiency(p, LI6_LOSSES.pvToAc) * 100);
      bat.push(efficiency(p, LI6_LOSSES.batToAc) * 100);
    }
    c.setData('pv', xs, pv);
    c.setData('bat', xs, bat);
  }
  const at = (name: StageName, lift = 0): (() => Vector3) => {
    const p = invToSet(STAGE[name].at.clone().setY(STAGE[name].at.y + STAGE[name].top + lift));
    const out = new Vector3();
    return () => lab.stageRoot.localToWorld(out.copy(p));
  };
  const onScale = (s: typeof hf): (() => Vector3) => {
    const out = new Vector3();
    return () => s.group.localToWorld(out.set(0, 1.25, 0.3));
  };
  const v = new Vector3();
  const o = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        // the left half of the inverter with the two scales in front of it
        position: [0.2, 5.9, 9.0],
        target: [-0.45, 0.8, 0.9],
        fov: 30,
        frameAspect: 1.45,
        orbit: { azimuth: 0.5, polar: 0.3 },
        fit: { center: [0, 1, 1], radius: 3.6 },
      },
    },
    stage: {
      show: [bench.actor, scales],
      params: { coverOpen: 1, coverAway: 1 },
      post: { bloomIntensity: 1.1 },
      // the choke rings and the arrow live on the shared inverter: put them away with the step
      leave: () => {
        arrow.visible = false;
        ringMat.intensity = 0;
      },
    },
    ui: {
      hint: OWN.hint6,
      honesty: ['simplified', 'notToScale', { slowed: 20000 }],
      controls: [
        {
          type: 'segmented',
          id: 'src6',
          label: pairTitle(doc(ID, 2)),
          items: [
            { id: 'pv', label: pvName },
            { id: 'bat', label: batName },
          ],
          value: 'pv',
        },
        {
          type: 'slider',
          id: 'uin6',
          label: doc(ID, 0),
          min: 100,
          max: 450,
          step: 5,
          value: 250,
          unit: 'V',
          digits: 0,
          visible: () => !fromBattery(),
        },
        {
          type: 'segmented',
          id: 'dir6',
          label: pairTitle(doc(ID, 4)),
          items: [
            { id: 'discharge', label: outName },
            { id: 'charge', label: inName },
          ],
          value: 'discharge',
          visible: fromBattery,
        },
        {
          type: 'slider',
          id: 'load6',
          label: OWN.loadPower,
          min: 0.1,
          max: 6,
          step: 0.1,
          value: 3,
          unit: 'kW',
          digits: 1,
        },
        {
          type: 'segmented',
          id: 'arch6',
          items: [
            { id: 'hf', label: hfName },
            { id: 'lf', label: lfName },
          ],
          value: 'hf',
        },
        {
          type: 'stats',
          id: 'stats6',
          columns: 2,
          items: [
            { label: OWN.duty, get: () => (fromBattery() ? '—' : fmtNumber(duty(), { digits: 3 })) },
            { label: OWN.uLink, get: () => fmtSI(Math.max(U_LINK, fromBattery() ? 0 : uIn()), 'V') },
          ],
        },
        {
          type: 'note',
          id: 'rest6',
          text: `${doc(ID, 1)}: ${OWN.boostRests}`,
          icon: 'info',
          visible: () => !fromBattery() && uIn() >= U_LINK,
        },
        {
          type: 'note',
          id: 'arch6note',
          text: () => (ui.value<string>('arch6') === 'lf' ? OWN.archLf : OWN.archHf),
          icon: 'layers',
        },
      ],
      board: {
        title: OWN.board6,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'eta6',
            chart: {
              height: 180,
              x: { min: 0, max: 6, label: OWN.axisPkw },
              y: { min: 60, max: 100, label: OWN.axisEta },
              series: [
                { id: 'pv', label: OWN.curvePv, color: PLANT_TYPE.solar },
                { id: 'bat', label: OWN.curveBat, color: PLANT_TYPE.bess },
              ],
            },
            init: plot,
            update: (c) =>
              c.setMarker('now', {
                x: loadW() / 1000,
                y: eta() * 100,
                color: 'yellow',
                label: fmtPercent(eta(), 1),
              }),
          },
          {
            type: 'stats',
            id: 'eta6stats',
            columns: 3,
            items: [
              {
                label: OWN.lossNow,
                get: () => fmtSI(loadW() / eta() - loadW(), 'W'),
                color: () => STATUS.warning,
              },
              { label: OWN.etaMax, get: () => fmtPercent(peakEfficiency(curve()).eta, 1) },
              { label: OWN.etaEu, get: () => fmtPercent(euroEfficiency(curve()), 1) },
            ],
          },
        ],
      },
      callouts: [
        {
          anchor: at('chokeA', 0.1),
          text: OWN.boostChoke,
          color: 'magenta',
          side: 'left',
          visible: () => !fromBattery(),
        },
        { anchor: at('dcdc', 0.2), text: OWN.batBridge, color: 'cyan', side: 'down', visible: fromBattery },
        { anchor: at('bat'), text: OWN.batPort, side: 'left' },
        { anchor: onScale(hf), text: `${OWN.hfCore} · ${OWN.kgHf}`, side: 'down' },
        { anchor: onScale(lf), text: `${OWN.lfCore} · ${OWN.kgLf}`, side: 'down' },
      ],
      hotspots: [
        { anchor: at('link'), content: 'dc-link-capacitors' },
        { anchor: at('transformer'), content: 'ferrite-core' },
      ],
    },
    probe: () => ({
      src: ui.value<string>('src6'),
      duty: duty(),
      uIn: uIn(),
      charging: charging(),
      arch: ui.value<string>('arch6'),
      eta: eta(),
      loadW: loadW(),
      batSpeed: inv.wires.bat.material.speed,
    }),
    update(_dt, t) {
      if (!lab.isCurrent(ID)) return;
      const k = Math.min(1, loadW() / 6000);
      bench.idle(t, 0.35 + 0.65 * k);
      const bat = fromBattery();
      const dir = charging() ? -1 : 1;
      // only the selected source feeds the link
      for (const name of ['pvA', 'pvB'] as const) {
        inv.wires[name].material.power = bat ? 0.04 : 0.4 + 0.6 * k;
        bench.feeds[name].material.power = bat ? 0.04 : 0.4 + 0.6 * k;
      }
      for (const w of [inv.wires.bat, bench.feeds.bat]) {
        w.material.power = bat ? 0.4 + 0.6 * k : 0.04;
        w.material.speed = dir * Math.abs(w.material.speed);
      }
      // boost stage: on for the share D of every slowed period; the choke's field builds up, then dumps
      const d = bat ? 0 : duty();
      const ph = (t % PERIOD) / PERIOD;
      const on = ph < d;
      inv.boost.intensity = bat ? 0.05 : on ? 1.8 : 0.15;
      const energy = d <= 0 ? 0.25 : on ? ph / d : 1 - (ph - d) / (1 - d);
      for (const r of rings) r.scale.setScalar(0.75 + 0.75 * energy);
      ringMat.intensity = bat ? 0 : 0.5 + 1.2 * energy;
      inv.dcdc.intensity = bat ? (Math.sin(t * 30) > 0 ? 1.7 : 0.2) : 0.05;
      arrow.visible = bat;
      arrow.set(o.set(-0.45 * dir, 0, 0), v.set(0.9 * dir, 0, 0));
      inv.setLinkVoltage(Math.max(U_LINK, bat ? 0 : uIn()));
      const lowFreq = ui.value<string>('arch6') === 'lf';
      hf.setFocus(!lowFreq);
      lf.setFocus(lowFreq);
      lab.sound.hum = lowFreq ? 0.5 : 0.1; // the 50 Hz toroid hums; the ferrite one works above hearing
    },
  };
};
