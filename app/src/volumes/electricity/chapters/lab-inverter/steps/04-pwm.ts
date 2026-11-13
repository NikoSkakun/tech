/**
 * Step 4 `pwm` — from the square wave to the sine. The bench scope shows the reference sine and the triangle
 * carrier (upper track) and the pulses the comparison makes, with the filtered output through them (lower
 * track); the small bridge flickers in step with the cursor; the spectrum row and the board chart show where
 * the harmonics went. Model: `analyseWave` (§M2) through the shared waveform laboratory.
 */
import { Vector3 } from 'three';
import { fmtPercent, fmtUnit } from '@/content';
import { STATUS, type Chart } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { binOf } from '../parts/bench-scope';
import { isPwm, type LabWave } from '../sim-bindings/wave-lab';
import { SLOWED, scopeStation } from './shared-scope';

const ID = 'pwm';
const WAVES: readonly LabWave[] = ['square', 'quasi', 'spwm_bi', 'spwm_uni'];

export const pwm: StepFactory = (lab) => {
  const { ui } = lab;
  const station = scopeStation(lab);
  const { scope, waves } = station;
  const kind = (): LabWave => ui.value<LabWave>('wave4');
  let chart: Chart | null = null;
  let charted = -1;

  /** All settings of the laboratory from the controls (the filter of step 5 is used for the «після фільтра» trace). */
  function apply(): void {
    if (!lab.isCurrent(ID)) return; // step 5 shares these controls' values and applies them itself
    waves.set({
      kind: kind(),
      // whole multiples of 100 Hz keep the carrier periodic within the 20 ms period (as the model assumes)
      fcHz: Math.round(ui.value<number>('fc4') * 10) * 100,
      ma: ui.value<number>('ma4'),
      pulseDeg: ui.value<number>('width4'),
      lH: ui.value<number>('l5') * 1e-3,
      cF: ui.value<number>('c5') * 1e-6,
      loadW: ui.value<number>('load5') * 1000,
      deadTimeS: 0,
      compensation: false,
    });
  }
  for (const id of ['wave4', 'fc4', 'ma4', 'width4']) ui.onChange(id, apply);

  function plot(c: Chart): void {
    // harmonics above 0,1 V as bars over frequency (both axes logarithmic)
    const xs: number[] = [];
    const ys: number[] = [];
    const bars = waves.barsBefore;
    for (let h = 1; h <= 1000; h++) {
      if (bars[h - 1]! < 0.1) continue;
      xs.push(h * 50);
      ys.push(bars[h - 1]!);
    }
    c.setData('h', xs, ys);
    c.setMarker('f1', {
      x: 50,
      y: bars[0]!,
      color: 'yellow',
      label: fmtUnit(bars[0]!, 'V', { digits: 0 }),
      guides: false,
    });
  }
  const onScope = (x: number, track: 1 | -1, y = 0): (() => Vector3) => {
    const out = new Vector3();
    return () => scope.group.localToWorld(scope.point(x, track, y, out));
  };
  const onBars = (h: number): (() => Vector3) => {
    const out = new Vector3();
    return () => scope.group.localToWorld(scope.barPoint(binOf(h), out).setY(out.y + 1.0));
  };
  const a = (): typeof waves.analysis => waves.analysis;

  return {
    id: ID,
    shots: {
      [ID]: {
        // a tall subject (scope over the small bridge) for the narrow free area between board and panel
        position: [0.5, 4.9, 12.2],
        target: [0, 3.05, 0.2],
        fov: 30,
        frameAspect: 1.12,
        orbit: { azimuth: 0.4, polar: 0.22 },
        fit: { center: [0, 3, 0], radius: 4.2 },
      },
    },
    stage: {
      show: [station.actor, station.miniActor],
      poses: { miniBridge: { position: [0, 0.02, 1.7] } },
      enter: () => {
        scope.mode = 'pwm';
        apply();
      },
      post: { bloomIntensity: 1.1 },
    },
    ui: {
      hint: OWN.hint4,
      honesty: [
        'simplified',
        { slowed: SLOWED.full, visible: () => !station.magnified },
        { slowed: SLOWED.magnified, visible: () => station.magnified },
        { text: `${doc(ID, 5)}: ${OWN.magnifier}`, visible: () => station.magnified },
      ],
      controls: [
        {
          type: 'segmented',
          id: 'wave4',
          label: OWN.form,
          items: WAVES.map((id, i) => ({ id, label: doc(ID, i) })),
          value: 'spwm_uni',
        },
        {
          type: 'slider',
          id: 'fc4',
          label: doc(ID, 4),
          min: 0.5,
          max: 20,
          scale: 'log',
          step: 2,
          value: 20,
          unit: 'kHz',
          visible: () => isPwm(kind()),
        },
        {
          type: 'slider',
          id: 'ma4',
          label: doc(ID, 6),
          min: 0,
          max: 1.2,
          step: 0.01,
          value: 0.81,
          digits: 2,
          marks: [{ value: 1, label: '1' }],
          visible: () => isPwm(kind()),
        },
        {
          type: 'slider',
          id: 'width4',
          label: doc(ID, 8),
          min: 60,
          max: 180,
          step: 2,
          value: 120,
          unit: '°',
          digits: 0,
          visible: () => kind() === 'quasi',
        },
        {
          type: 'note',
          id: 'overmod4',
          text: OWN.overmod,
          icon: 'warning',
          color: STATUS.warning,
          visible: () => isPwm(kind()) && ui.value<number>('ma4') > 1,
        },
      ],
      board: {
        title: OWN.board4,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'spec4',
            chart: {
              height: 200,
              x: { min: 40, max: 60000, log: true, label: OWN.axisFHz },
              y: { min: 0.1, max: 1000, log: true, label: OWN.axisUh },
              series: [{ id: 'h', color: 'violet', kind: 'bars' }],
              legend: false,
            },
            init: (c) => (chart = c),
            update: (c) => {
              if (charted === waves.version) return;
              charted = waves.version;
              plot(c);
            },
          },
          {
            type: 'stats',
            id: 'stats4',
            columns: 4,
            items: [
              { label: OWN.u1Rms, get: () => fmtUnit(a().u1RmsV, 'V', { digits: 1 }) },
              { label: OWN.uRms, get: () => fmtUnit(a().uRmsV, 'V', { digits: 1 }) },
              {
                label: OWN.thdFull,
                get: () => fmtPercent(a().thd, 1),
                color: () => (a().thd > 0.08 ? STATUS.warning : STATUS.ok),
              },
              { label: `${OWN.thd50} (${doc(ID, 9)})`, get: () => fmtPercent(a().thd50, 2) },
            ],
          },
          {
            type: 'readout',
            id: 'udc4',
            label: OWN.udc,
            get: () => waves.udcV,
            unit: 'V',
            digits: 0,
          },
        ],
      },
      callouts: [
        { anchor: onScope(-0.98, 1, 0), text: OWN.refTrace, color: 'yellow', side: 'left' },
        {
          anchor: onScope(0.98, 1, 0.5),
          text: OWN.carrierTrace,
          color: 'cyan',
          side: 'right',
          visible: () => isPwm(kind()),
        },
        { anchor: onScope(0.98, -1, 0.6), text: OWN.pulseTrace, color: 'violet', side: 'right' },
        { anchor: onScope(-0.98, -1, 0), text: OWN.outTrace, color: 'yellow', side: 'left' },
        { anchor: onBars(1), text: OWN.fundamental, color: 'yellow', side: 'left' },
        {
          anchor: () => onBars(waves.settings.fcHz / 50)(),
          text: OWN.nearCarrier,
          color: 'violet',
          side: 'up',
          visible: () => isPwm(kind()),
        },
        {
          anchor: () => station.mini.group.localToWorld(new Vector3(4.2, 2.0, 0.2)),
          text: OWN.miniBridge,
          color: 'cyan',
          side: 'right',
        },
      ],
      hotspots: [
        { anchor: onScope(0.3, 1, 0.9), content: 'carrier', visible: () => isPwm(kind()) },
        { anchor: onScope(0.05, -1, -0.95), content: 'modified-sine' },
      ],
    },
    probe: () => ({
      kind: waves.settings.kind,
      fc: waves.settings.fcHz,
      ma: waves.settings.ma,
      thd: a().thd,
      thd50: a().thd50,
      u1: a().u1RmsV,
      uRms: a().uRmsV,
      magnified: station.magnified,
      now: station.now,
      chart: chart !== null,
    }),
    update(dt) {
      if (!lab.isCurrent(ID)) return;
      station.run(dt);
      // a choke "sings" at a carrier inside the audible band (the hotspot's 5–10 kHz whine)
      const fc = waves.settings.fcHz;
      lab.sound.buzz = isPwm(kind()) && fc < 16000 ? 0.12 : 0.02;
      lab.sound.buzzPitch = 0.6 + fc / 12000;
    },
  };
};
