/**
 * Step 10 `maxwell` — Maxwell's equations, light, and where the energy really flows. Three views on one
 * table, picked in the dock (the camera follows): «Рівняння» — four small illustrations, one per equation;
 * «Хвиля» — a dipole antenna sends an E/B wave along the table over the spectrum strip (frequency slider,
 * λ = c/f, band name); «Енергія» — battery, two parallel wires and a resistor with E arcs, B rings and the
 * `yellow` Poynting flux streaming between the wires into the resistor while the electrons barely move.
 */
import { Vector3 } from 'three';
import { fmtSI, fmtUnit } from '@/content';
import { emWave, poyntingCircuit, MAXWELL } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createEqViews } from '../parts/eq-views';
import { createPoyntingView } from '../parts/poynting-view';
import { createWaveView } from '../parts/wave-view';
import { group } from '../world';

const ID = 'maxwell';
const BANDS = ['radio', 'microwave', 'infrared', 'visible', 'ultraviolet', 'xray', 'gamma'] as const;
const EQ = new Vector3(-1.9, 0, 0.9);
const WAVE = new Vector3(0.3, 0, -1.3);
const POY = new Vector3(0.6, 0, 1.4);

export const maxwellStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const eq = createEqViews();
  eq.group.position.copy(EQ);
  const wave = createWaveView();
  wave.group.position.copy(WAVE);
  const poy = createPoyntingView(ctx);
  poy.group.position.copy(POY);
  set.add(eq.group, wave.group, poy.group);

  const view = (): string => ui.value<string>('view10');
  const eqIndex = (): number => Number(ui.value<string>('eq10'));
  const freq = (): number => ui.value<number>('f10');
  const circuit = () => poyntingCircuit(ui.value<number>('u10'), ui.value<number>('r10'));
  const show = (): string => ui.value<string>('show10');
  const bandName = (): string => OWN.bands[BANDS.indexOf(emWave(freq()).band)] ?? '';
  ui.onChange('view10', (v) => void ctx.camera.go(v === 'eq' ? ID : `${ID}:${v}`, { duration: 1.5 }));
  ctx.qa.probe('resistor10', poy.group);
  ctx.qa.expose(ID, () => {
    const c = circuit();
    return { view: view(), eq: eqIndex(), frequency: freq(), wavelengthM: emWave(freq()).wavelengthM, band: emWave(freq()).band, powerW: c.powerW, currentA: c.currentA, show: show() };
  });
  const v = new Vector3();
  const strip = new Vector3();
  const eqShot = { position: [-0.7, 3.0, 4.6] as [number, number, number], target: [-1.6, 0.7, 0.8] as [number, number, number] };

  return {
    id: ID,
    shots: {
      [ID]: { ...eqShot, fov: 32, frameAspect: 1.2, orbit: { azimuth: 0.6, polar: 0.3 }, fit: { center: [-1.9, 0.7, 0.9], radius: 1.5 } },
      [`${ID}:wave`]: { position: [0.8, 3.6, 4.0], target: [0.5, 0.6, -1.3], fov: 34, frameAspect: 1.3, orbit: { azimuth: 0.6, polar: 0.3 }, fit: { center: [0.5, 0.6, -1.3], radius: 2.7 } },
      [`${ID}:energy`]: { position: [1.0, 3.3, 5.2], target: [0.7, 0.5, 1.3], fov: 34, frameAspect: 1.3, orbit: { azimuth: 0.6, polar: 0.3 }, fit: { center: [0.7, 0.5, 1.4], radius: 2.2 } },
    },
    stage: {
      show: [set],
      enter: (info) => {
        if (!info.instant) return;
        eq.group.scale.setScalar(1);
        wave.group.scale.setScalar(0.001);
        poy.group.scale.setScalar(0.001);
      },
    },
    ui: {
      reset: true,
      honesty: [{ text: DOC.slowed }, { text: DOC.notToScale }],
      controls: [
        {
          type: 'segmented',
          id: 'view10',
          label: OWN.part,
          items: [
            { id: 'eq', label: OWN.views[0] },
            { id: 'wave', label: OWN.views[1] },
            { id: 'energy', label: OWN.views[2] },
          ],
          value: 'eq',
        },
        {
          type: 'segmented',
          id: 'eq10',
          label: OWN.equation,
          items: OWN.equations.map((label, k) => ({ id: String(k), label })),
          value: '0',
          visible: () => view() === 'eq',
        },
        { type: 'slider', id: 'f10', label: DOC.frequency, min: MAXWELL.frequencyRangeHz.min, max: MAXWELL.frequencyRangeHz.max, value: MAXWELL.frequencyRangeHz.default, scale: 'log', step: 2, unit: 'Hz', format: (f: number) => fmtSI(f, 'Hz', { digits: 2 }), visible: () => view() === 'wave' },
        { type: 'readout', id: 'lambda10', label: OWN.wavelength, text: () => fmtSI(emWave(freq()).wavelengthM, 'm', { digits: 3 }), visible: () => view() === 'wave' },
        { type: 'readout', id: 'band10', label: OWN.band, text: bandName, visible: () => view() === 'wave' },
        { type: 'slider', id: 'u10', label: DOC.battery, ...MAXWELL.batteryRangeV, value: MAXWELL.batteryRangeV.default, unit: 'V', visible: () => view() === 'energy' },
        { type: 'slider', id: 'r10', label: DOC.loadR, min: 1, max: 100, value: MAXWELL.loadRangeOhm.default, scale: 'log', step: 2, unit: 'Ω', visible: () => view() === 'energy' },
        {
          type: 'segmented',
          id: 'show10',
          label: DOC.show.title,
          items: DOC.show.items.map((label, k) => ({ id: ['all', 'electrons', 'field'][k]!, label })),
          value: 'all',
          visible: () => view() === 'energy',
        },
        { type: 'readout', id: 'p10', label: OWN.powerP, text: () => fmtUnit(circuit().powerW, 'W', { digits: 1 }), visible: () => view() === 'energy' },
      ],
      callouts: [
        { anchor: () => wave.group.localToWorld(v.set(-2.1, 1.75, 0)), text: OWN.antenna, side: 'up', visible: () => view() === 'wave' },
        { anchor: () => wave.group.localToWorld(wave.stripAt(Math.log10(freq()), strip)), text: bandName, color: 'yellow', side: 'down', visible: () => view() === 'wave' },
      ],
      hotspots: [
        { anchor: () => eq.group.localToWorld(v.copy(eq.gap)), content: 0, visible: () => view() === 'eq' && eqIndex() === 3 },
        { anchor: () => poy.group.localToWorld(v.copy(poy.resistor)), content: 1, visible: () => view() === 'energy' },
        { anchor: () => wave.group.localToWorld(v.set(-1.6, 0.25, -1.35)), content: 2, visible: () => view() === 'wave' },
      ],
    },
    update(dt, t) {
      // one view at a time: the others shrink away (and stop costing draw calls)
      for (const [g, id] of [
        [eq.group, 'eq'],
        [wave.group, 'wave'],
        [poy.group, 'energy'],
      ] as const) {
        const k = g.scale.x + ((view() === id ? 1 : 0) - g.scale.x) * Math.min(dt * 7, 1);
        g.scale.setScalar(Math.max(k, 0.001));
        g.visible = k > 0.01;
      }
      eq.update(t, view() === 'eq' ? eqIndex() : -1);
      wave.update(t, Math.log10(freq()));
      const c = circuit();
      const fields = show() !== 'electrons';
      poy.e.mesh.visible = fields && c.fieldDensity > 0.001;
      poy.b.mesh.visible = fields && c.ringDensity > 0.0005;
      poy.s.mesh.visible = fields && c.powerW > 0.01;
      poy.e.mesh.intensity = 0.3 + 1.2 * c.fieldDensity;
      poy.b.mesh.intensity = 0.3 + 1.2 * Math.min(c.ringDensity * 6, 1);
      poy.s.mesh.intensity = 0.4 + 1.4 * Math.min(Math.sqrt(c.fluxDensity) * 3, 1);
      poy.s.mesh.dashSpeed = 0.4 + 2.0 * Math.min(Math.sqrt(c.fluxDensity) * 3, 1);
      poy.electrons.visible = show() !== 'field';
      poy.electrons.speed = -0.004 * c.currentA;
      bench.live.hum = view() === 'wave' ? 0.15 : 0;
      bench.live.humPitch = 0.6 + (Math.log10(freq()) - 6) / 12;
    },
  };
};
