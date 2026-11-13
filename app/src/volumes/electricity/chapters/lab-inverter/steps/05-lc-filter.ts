/**
 * Step 5 `lc-filter` — the choke and the capacitor turn the pulse fence into a clean sine. The filter rig sits
 * between the small bridge and the load; the scope now compares «до фільтра» (upper track) with «після»
 * (lower), the spectrum rows show the harmonics near the carrier collapsing, the board draws the filter's
 * frequency response with f₀, the carrier and 50 Hz marked. Model: `filterWave` / `lcGainDb` (§M3), dead time
 * §M4, warnings `filterWarning`.
 */
import { Vector3 } from 'three';
import { fmtPercent, fmtSI, fmtUnit } from '@/content';
import { STATUS, type Chart } from '@/ui3d';
import { filterWarning, lcGainDb, loadResistanceOhm } from '@electricity/sim/lab-inverter';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { binOf } from '../parts/bench-scope';
import { createLcRig } from '../parts/lc-rig';
import { isPwm, type LabWave } from '../sim-bindings/wave-lab';
import { group } from '../world';
import { SLOWED, scopeStation } from './shared-scope';

const ID = 'lc-filter';
const WAVES: readonly LabWave[] = ['square', 'quasi', 'spwm_bi', 'spwm_uni'];

export const lcFilter: StepFactory = (lab) => {
  const { ui } = lab;
  const station = scopeStation(lab);
  const { scope, waves } = station;
  const rig = createLcRig();
  rig.group.scale.setScalar(0.62);
  rig.group.position.set(1.55, 0, 1.75);
  const set = group(`set:${ID}`, 0, 0, 0, [rig.group]);
  lab.stageRoot.add(set);

  const L = (): number => ui.value<number>('l5') * 1e-3;
  const C = (): number => ui.value<number>('c5') * 1e-6;
  const P = (): number => ui.value<number>('load5') * 1000;
  function apply(): void {
    if (!lab.isCurrent(ID)) return;
    const kind = ui.value<LabWave>('wave5');
    waves.set({
      kind,
      fcHz: Math.round(ui.value<number>('fc4') * 10) * 100,
      ma: ui.value<number>('ma4'),
      pulseDeg: ui.value<number>('width4'),
      lH: L(),
      cF: C(),
      loadW: P(),
      deadTimeS: ui.value<number>('dead5') * 1e-6,
      compensation: ui.value<boolean>('comp5'),
    });
  }
  // the carrier, m_a and pulse width of step 4 keep their values here (and may be changed by a script)
  for (const id of ['l5', 'c5', 'load5', 'dead5', 'comp5', 'fc4', 'ma4', 'width4']) ui.onChange(id, apply);
  ui.onChange('wave5', (v) => {
    ui.set('wave4', v); // one choice of the form for both steps
    apply();
  });
  const warning = (): ReturnType<typeof filterWarning> => filterWarning(L(), C(), waves.settings.fcHz);

  let charted = -1;
  function plot(c: Chart): void {
    const xs: number[] = [];
    const ys: number[] = [];
    const r = loadResistanceOhm(P());
    for (let k = 0; k <= 160; k++) {
      const f = 10 ** (1 + (k / 160) * 4);
      xs.push(f);
      ys.push(Math.max(-90, lcGainDb(f, L(), C(), r)));
    }
    c.setData('h', xs, ys);
    const f0 = waves.filtered.f0Hz;
    const fc = waves.settings.fcHz;
    c.setMarker('f0', {
      x: f0,
      y: Math.min(28, lcGainDb(f0, L(), C(), r)),
      color: 'magenta',
      label: `${OWN.f0} ${fmtSI(f0, 'Hz')}`,
    });
    c.setMarker('mains', {
      x: 50,
      y: lcGainDb(50, L(), C(), r),
      color: 'yellow',
      label: OWN.mainsMark,
      guides: false,
    });
    c.setMarker(
      'fc',
      isPwm(waves.settings.kind)
        ? { x: fc, y: Math.max(-78, lcGainDb(fc, L(), C(), r)), color: 'cyan', label: OWN.carrierMark }
        : null,
    );
  }
  const onScope = (x: number, track: 1 | -1, y = 0): (() => Vector3) => {
    const out = new Vector3();
    return () => scope.group.localToWorld(scope.point(x, track, y, out));
  };
  const onRig = (p: Vector3): (() => Vector3) => {
    const out = new Vector3();
    return () => rig.group.localToWorld(out.copy(p));
  };
  const tmp = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.5, 4.9, 12.2],
        target: [0, 3.05, 0.2],
        fov: 30,
        frameAspect: 1.12,
        orbit: { azimuth: 0.4, polar: 0.22 },
        fit: { center: [0, 3, 0], radius: 4.2 },
      },
    },
    stage: {
      show: [station.actor, station.miniActor, set],
      enter: () => {
        scope.mode = 'filter';
        ui.set('wave5', ui.value<string>('wave4'));
        apply();
      },
      post: { bloomIntensity: 1.1 },
    },
    ui: {
      hint: OWN.hint5,
      honesty: ['simplified', { slowed: SLOWED.full }, { text: OWN.fence, visible: () => station.fast }],
      controls: [
        {
          type: 'slider',
          id: 'l5',
          label: doc(ID, 0),
          min: 0.2,
          max: 5,
          scale: 'log',
          step: 2,
          value: 1.5,
          unit: 'mH',
        },
        {
          type: 'slider',
          id: 'c5',
          label: doc(ID, 1),
          min: 1,
          max: 50,
          scale: 'log',
          step: 2,
          value: 10,
          unit: 'μF',
        },
        {
          type: 'slider',
          id: 'load5',
          label: doc(ID, 4),
          min: 0,
          max: 6,
          step: 0.1,
          value: 2,
          unit: 'kW',
          digits: 1,
        },
        {
          type: 'slider',
          id: 'dead5',
          label: doc(ID, 5),
          min: 0,
          max: 3,
          step: 0.1,
          value: 0,
          unit: 'μs',
          digits: 1,
          disabled: () => !isPwm(waves.settings.kind),
        },
        { type: 'toggle', id: 'comp5', label: doc(ID, 6), value: false },
        {
          type: 'note',
          id: 'small5',
          text: doc(ID, 2),
          icon: 'warning',
          color: STATUS.warning,
          visible: () => warning() === 'too-small',
        },
        {
          type: 'note',
          id: 'big5',
          text: doc(ID, 3),
          icon: 'warning',
          color: STATUS.warning,
          visible: () => warning() === 'oversized',
        },
      ],
      board: {
        title: OWN.board5,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'bode5',
            chart: {
              height: 190,
              x: { min: 10, max: 100000, log: true, label: OWN.axisFHz },
              y: { min: -80, max: 30, label: OWN.axisDb, ticks: [-80, -60, -40, -20, 0, 20] },
              series: [{ id: 'h', color: 'yellow' }],
              legend: false,
            },
            update: (c) => {
              if (charted === waves.version) return;
              charted = waves.version;
              plot(c);
            },
          },
          {
            type: 'stats',
            id: 'stats5',
            columns: 3,
            items: [
              { label: OWN.f0, get: () => fmtSI(waves.filtered.f0Hz, 'Hz') },
              { label: OWN.z0, get: () => fmtUnit(waves.filtered.z0Ohm, 'Ω', { digits: 1 }) },
              { label: OWN.u1After, get: () => fmtUnit(waves.filtered.u1RmsV, 'V', { digits: 1 }) },
              { label: OWN.thdBefore, get: () => fmtPercent(waves.analysis.thd, 1) },
              {
                label: OWN.thdAfter,
                get: () => fmtPercent(waves.filtered.thd, 2),
                color: () =>
                  waves.filtered.thd < 0.03
                    ? STATUS.ok
                    : waves.filtered.thd < 0.08
                      ? STATUS.warning
                      : STATUS.alarm,
              },
            ],
          },
          {
            type: 'segmented',
            id: 'wave5',
            label: OWN.form,
            items: WAVES.map((id, i) => ({ id, label: doc('pwm', i) })),
            value: 'spwm_uni',
          },
        ],
      },
      callouts: [
        { anchor: onScope(-0.98, 1, 0.4), text: OWN.beforeTrace, color: 'violet', side: 'left' },
        { anchor: onScope(-0.98, -1, 0), text: OWN.outTrace, color: 'yellow', side: 'left' },
        { anchor: onRig(new Vector3(-0.95, 1.75, -0.2)), text: OWN.fieldB, color: 'magenta', side: 'up' },
        { anchor: onRig(new Vector3(1.25, 0.4, 0.35)), text: OWN.fieldE, color: 'amber', side: 'down' },
        {
          anchor: () =>
            scope.group.localToWorld(scope.barPoint(binOf(waves.settings.fcHz / 50), tmp).setY(tmp.y + 0.9)),
          text: OWN.spectrumAfter,
          color: 'yellow',
          side: 'right',
          visible: () => isPwm(waves.settings.kind) && waves.filtered.thd < 0.05,
        },
      ],
      hotspots: [
        { anchor: onRig(rig.points.choke), content: 'choke' },
        { anchor: onRig(rig.points.cap), content: 'film-capacitor' },
      ],
    },
    probe: () => ({
      kind: waves.settings.kind,
      f0: waves.filtered.f0Hz,
      thdBefore: waves.analysis.thd,
      thdAfter: waves.filtered.thd,
      u1After: waves.filtered.u1RmsV,
      warning: warning(),
      dead: waves.settings.deadTimeS,
      comp: waves.settings.compensation,
      load: waves.settings.loadW,
    }),
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      station.run(dt);
      const { lH, cF, fcHz, kind } = waves.settings;
      // relative ripple of the choke current: ∝ 1 / (L·f_c) for the PWM kinds, full swing for the square wave
      const ripple = isPwm(kind) ? Math.min(1, (0.18 * 1.5e-3 * 20000) / (lH * fcHz)) : 1;
      const u = waves.after(station.now) / waves.udcV;
      const size = (x: number): number => Math.max(0.62, Math.min(1.45, Math.cbrt(x)));
      rig.set(ripple, u, t, size(lH / 1.5e-3), size(cF / 10e-6));
      rig.wireOut.material.power = 0.35 + 0.65 * Math.abs(u);
      lab.sound.hum = 0.1 + 0.25 * Math.abs(u);
      lab.sound.buzz = waves.filtered.thd > 0.08 ? 0.15 : 0;
    },
  };
};
