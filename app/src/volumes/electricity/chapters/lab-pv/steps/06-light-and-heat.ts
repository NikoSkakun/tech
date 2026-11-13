/**
 * Step 6 `light-and-heat` — the same bench; irradiance and temperature are the two levers. Light scales the
 * current, heat eats the voltage: the live curve is drawn over the pale STC curve, the lamp and the photon
 * stream follow G, the cells and the shimmer follow the cell temperature. The operating point sits in the MPP.
 */
import { Group } from 'three';
import { fmtNumber } from '@/content';
import { createHalo } from '@/fx';
import { heatRamp } from '@/style';
import { LIGHT_HEAT_PRESETS, analyseString, cellTemperatureC, uniformString } from '@electricity/sim/lab-pv';
import type { StepFactory } from '../chapter';
import { doc, docPair } from '../content';
import { L, fill } from '../labels';
import { EASEL_TILT, createRig } from '../parts/rig';
import { createWeather } from '../parts/weather';
import type { BenchSample } from '../sim-bindings/bench-model';
import { sound } from '../sound';
import { curveChart } from '../ui-bits/curve-chart';

const ID = 'light-and-heat';

export const lightAndHeat: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const rig = lab.share('rig', () => createRig(ctx));
  const weather = createWeather();
  weather.group.position.set(-1.55, 0, 2.3);
  weather.group.scale.setScalar(0.92);
  // hot air rises off the whole face of the module (from its lower edge up past the top), not just the rim
  weather.shimmer.position.copy(rig.centre).addScaledVector(rig.normal, 0.35);
  weather.shimmer.position.y -= 0.9 * Math.sin(EASEL_TILT);
  // thermal aura of the hot module (STYLE_GUIDE: heat = orange → red)
  const aura = createHalo({ color: 'orange', size: 5.6, intensity: 0, amount: 0.2 });
  aura.position.copy(rig.centre).addScaledVector(rig.normal, -0.3); // behind the laminate: a warm rim, not a hot spot on the glass
  const set = weather.group;
  lab.stageRoot.add(set, weather.shimmer, aura);
  // the air gap behind the module (hotspot): a point under the lower half of the laminate, in the mount's frame
  const gap = new Group();
  gap.position.set(0.9, -0.3, 1.5);
  rig.mount.add(gap);

  const stc = analyseString(uniformString(1000, 25), 300);
  let sample: BenchSample | null = null;
  const nmot = (): boolean => ui.value<string>('mode6') === 'nmot';
  const g = (): number => ui.value<number>('g6');
  const tc = (): number => (nmot() ? cellTemperatureC(ui.value<number>('ta6'), g()) : ui.value<number>('tc6'));
  const share = (): number => (sample ? sample.analysis.mpp.pW / stc.mpp.pW : 1);
  const [manualLabel, nmotLabel] = docPair(ID, 2);

  const preset = (key: keyof typeof LIGHT_HEAT_PRESETS, toast?: () => string): void => {
    const p = LIGHT_HEAT_PRESETS[key];
    ui.set('g6', p.gWm2, { notify: true });
    if ('ambientC' in p) {
      ui.set('mode6', 'nmot', { notify: true });
      ui.set('ta6', p.ambientC, { notify: true });
    } else {
      ui.set('mode6', 'manual', { notify: true });
      ui.set('tc6', p.cellTempC, { notify: true });
    }
    // the toast quotes the model after it has taken the new inputs (next frame)
    if (toast) ctx.stage.scope.delay(0.1, () => ui.toast(toast(), { icon: 'info', duration: 6 }));
  };
  ctx.qa.expose('bench6', () => (sample ? { p: sample.analysis.mpp.pW, voc: sample.analysis.vocV, isc: sample.analysis.iscA, tc: sample.input.tc, g: sample.input.g } : null));
  ctx.qa.probe('lamp6', rig.lamp.ball);

  return {
    id: ID,
    shots: {
      [ID]: { position: [1.4, 3.6, 10.8], target: [-0.1, 2.3, 0], frameAspect: 0.95, fov: 34, fit: { center: [-0.1, 2.3, 0], radius: 3.6 }, orbit: { azimuth: 0.6, polar: 0.3 } },
    },
    stage: { show: [rig.group, rig.desk, set, weather.shimmer, aura] },
    ui: {
      hint: L.hint6,
      board: {
        title: L.board6,
        size: 'md',
        children: [
          curveChart('chart6', () => sample, { ghost: () => stc }),
          {
            type: 'stats',
            id: 'stats6',
            items: [
              { label: L.pMax, get: () => sample?.analysis.mpp.pW ?? 0, unit: 'W', digits: 0, color: () => 'yellow' },
              { label: L.ofStc, get: () => share() * 100, unit: '%', digits: 0 },
              { label: L.cellTemp, get: () => tc(), unit: '°C', digits: 0, color: () => (tc() > 45 ? 'orange' : tc() < 5 ? 'sky' : 'white') },
            ],
          },
          { type: 'readout', id: 'voc6', label: L.vocNow, get: () => sample?.analysis.vocV ?? 0, unit: 'V', digits: 1 },
          { type: 'readout', id: 'isc6', label: 'I_sc', get: () => sample?.analysis.iscA ?? 0, unit: 'A', digits: 2 },
          { type: 'button', id: 'p6-stc', label: doc(ID, 4), onClick: () => preset('stc') },
          { type: 'button', id: 'p6-july', label: doc(ID, 5), onClick: () => preset('julyNoon', () => fill(L.julyToast, { t: fmtNumber(Math.round(tc())), p: fmtNumber(Math.round(share() * 100)) })) },
          { type: 'button', id: 'p6-cloud', label: doc(ID, 6), onClick: () => preset('overcast', () => fill(L.cloudToast, { p: fmtNumber(Math.round(share() * 100)) })) },
          { type: 'button', id: 'p6-frost', label: doc(ID, 7), onClick: () => preset('frostyMorning', () => fill(L.frostToast, { v: fmtNumber(Math.round((sample?.analysis.vocV ?? 0) * 10) / 10) })) },
        ],
      },
      controls: [
        { type: 'slider', id: 'g6', label: doc(ID, 0), min: 0, max: 1200, step: 10, value: 1000, unit: 'W/m²' },
        { type: 'segmented', id: 'mode6', items: [{ id: 'manual', label: manualLabel }, { id: 'nmot', label: nmotLabel }], value: 'manual' },
        { type: 'slider', id: 'tc6', label: doc(ID, 3), min: -25, max: 85, step: 1, value: 25, unit: '°C', visible: () => !nmot() },
        { type: 'slider', id: 'ta6', label: doc(ID, 1), min: -25, max: 40, step: 1, value: 25, unit: '°C', visible: nmot },
      ],
      callouts: [
        { anchor: rig.lamp.ball, text: () => `${L.irradiance} · ${fmtNumber(Math.round(g()))} W/m²`, side: 'up', color: 'yellow' },
        { anchor: weather.anchors.cell, text: () => `${L.thermoCell} · ${fmtNumber(Math.round(tc()))} °C`, side: 'left', color: 'orange' },
        { anchor: weather.anchors.wind, text: L.wind, side: 'up', visible: nmot },
      ],
      hotspots: [
        { anchor: weather.anchors.cell, content: 'thermometer' },
        { anchor: gap, content: 'mounting-gap' },
      ],
    },
    update(_dt, t) {
      if (!lab.isCurrent(ID)) return;
      const temperature = tc();
      sample = rig.model.sample({ g: g(), tc: temperature, shade: null, bypass: true, modules: 1, load: { kind: 'mpp' } });
      const heat = temperature >= 25 ? (temperature - 25) / 60 : (temperature - 25) / 50;
      rig.show(sample, t, { heat });
      sound.power = sample.op.pW / 440;
      weather.set(temperature, nmot() ? ui.value<number>('ta6') : temperature, t);
      aura.intensity = Math.max(0, heat) * 0.75;
      heatRamp(Math.min(1, Math.max(0, heat)), aura.color);
    },
  };
};
