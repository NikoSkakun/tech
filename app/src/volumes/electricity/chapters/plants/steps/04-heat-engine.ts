/**
 * Step 4 `heat-engine` — «Тепловий двигун і межа Карно». The hub dims into a studio: a hot reservoir, a cold one
 * and a toy engine between them. Heat blobs flow hot → engine; the share η_C (plants sim M1, `carnotEfficiency`)
 * becomes yellow work pulses on the flywheel, the rest cools and falls into the cold sphere. The board plots the
 * Carnot limit against t_h with the band of real plants (0,55…0,75 η_C, `realBand`) and the plant markers
 * (`PLANT_MARKERS`); the chips set the sliders to a plant's temperatures.
 */
import { Vector3 } from 'three';
import { applyHeat } from '@/fx';
import { carnotEfficiency, PLANT_MARKERS, realBand } from '@electricity/sim/plants';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createHeatEngine, HE } from '../parts/heat-engine';
import { STUDIO_TUNE } from '../shots';
import { group, tag } from '../world';

const ID = 'heat-engine';
const PRESETS = [
  { id: 'nuclear', label: 1, m: PLANT_MARKERS.nuclear },
  { id: 'coalSub', label: 2, m: PLANT_MARKERS.coalSubcritical },
  { id: 'coalUsc', label: 3, m: PLANT_MARKERS.coalUsc },
  { id: 'ccgt', label: 4, m: PLANT_MARKERS.ccgt },
] as const;
const COLD_C = 30;

export const heatEngine: StepFactory = (hub) => {
  const { ctx, ui, arch } = hub;
  const set = group(ID, 0, 0, 4);
  set.scale.setScalar(1.3);
  hub.stageRoot.add(set);
  const rig = createHeatEngine(ctx);
  set.add(rig.group);
  const etaTag = tag('', 24, 'yellow', 'display');
  etaTag.position.set(2.6, 13.4, -1.4);
  const hotTag = tag('', 20, 'orange', 'mono');
  // temperatures on the pedestals' fronts (above the spheres they hid under the board at 720p)
  hotTag.position.set(HE.hotX, 0.8, 3.3);
  const coldTag = tag('', 20, 'sky', 'mono');
  coldTag.position.set(HE.coldX, 0.8, 3.3);
  set.add(etaTag, hotTag, coldTag);

  const th = (): number => ui.value<number>('th4');
  const tc = (): number => ui.value<number>('tc4');
  const eta = (): number => carnotEfficiency(th(), tc());
  const st = { crank: 0, preset: '' as string };
  const preset = (): (typeof PRESETS)[number] | undefined => PRESETS.find((p) => p.id === st.preset && p.m.hotC === th() && tc() === COLD_C);
  ctx.qa.probe('hot', () => set.localToWorld(rig.at.hot.clone()));
  ctx.qa.probe('cold', () => set.localToWorld(rig.at.cold.clone()));

  const xs = Array.from({ length: 81 }, (_, i) => 100 + i * 20);
  return {
    id: ID,
    shots: {
      [ID]: { position: [2, 15, 38], target: [2, 9, 4], fov: 38, drift: 0.5, fit: { center: [0, 7, 4], radius: 18 } },
    },
    stage: {
      show: [set],
      env: 'dusk',
      envTune: STUDIO_TUNE,
      enter: () => {
        st.preset = '';
      },
    },
    noLines: true,
    ui: {
      honesty: ['simplified', 'notToScale'],
      controls: [
        { type: 'slider', id: 'th4', label: OWN.tHot, min: 100, max: 1700, step: 10, value: 600, unit: '°C' },
        { type: 'slider', id: 'tc4', label: OWN.tCold, min: 0, max: 60, step: 1, value: COLD_C, unit: '°C' },
        ...PRESETS.map((p) => ({
          type: 'button' as const,
          id: `pre4${p.id}`,
          label: doc(ID, p.label),
          onClick: () => {
            ui.set('th4', p.m.hotC, { notify: true });
            ui.set('tc4', COLD_C, { notify: true });
            st.preset = p.id;
            hub.sound.click(1.1);
          },
        })),
        { type: 'note', id: 'stop4', icon: 'warning', color: 'amber', text: doc(ID, 5), visible: () => eta() <= 0 },
      ],
      board: {
        title: OWN.carnotBoard,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'carnot4',
            chart: {
              height: 230,
              x: { min: 100, max: 1700, label: 't_h, °C' },
              y: { min: 0, max: 100, label: 'η, %' },
              legend: true,
              series: [
                { id: 'c', label: OWN.carnotLimit, color: 'amber', width: 3 },
                { id: 'hi', label: doc(ID, 0), color: 'green', dash: true },
                { id: 'lo', label: '', color: 'green', dash: true },
              ],
            },
            update: (c) => {
              const t = tc();
              c.setData('c', xs, xs.map((x) => 100 * carnotEfficiency(x, t)));
              c.setData('hi', xs, xs.map((x) => 100 * realBand(x, t)[1]));
              c.setData('lo', xs, xs.map((x) => 100 * realBand(x, t)[0]));
              for (const p of PRESETS) c.setMarker(p.id, { x: p.m.hotC, y: 100 * p.m.eta, color: st.preset === p.id ? 'yellow' : 'mist', label: doc(ID, p.label), guides: false });
              c.setMarker('now', { x: th(), y: 100 * eta(), color: 'amber' });
            },
          },
          {
            type: 'stats',
            id: 'read4',
            items: [
              { label: 'η_C = 1 − T_c/T_h', get: () => 100 * eta(), unit: '%', digits: 1, color: () => 'amber' },
              { label: doc(ID, 0), get: () => 100 * realBand(th(), tc())[0], unit: '%', digits: 0, color: () => 'green' },
              { label: OWN.realUpTo, get: () => 100 * realBand(th(), tc())[1], unit: '%', digits: 0, color: () => 'green' },
            ],
          },
        ],
      },
      callouts: [
        // below the sphere, on the floor: above it the label hid under the board at 720p
        { anchor: () => set.localToWorld(new Vector3(HE.hotX + HE.r * 0.7, 1.6, 2.6)), text: OWN.hotRes, side: 'down' },
        { anchor: () => set.localToWorld(rig.at.engine.clone().setY(9.2)), text: OWN.engine, side: 'left' },
      ],
      hotspots: [{ anchor: () => set.localToWorld(rig.at.cold.clone()), content: 'cold-reservoir' }],
    },
    probe: () => ({ th: th(), tc: tc(), eta: eta(), crank: st.crank, work: rig.work.density, preset: preset()?.id ?? null }),
    update(dt) {
      if (!hub.isCurrent(ID)) return;
      const e = eta();
      const running = e > 0;
      st.crank += dt * (running ? 1.2 + 3 * e : 0);
      rig.setCrank(st.crank);
      rig.heatIn.density = running ? 1 : 0;
      rig.work.density = running ? Math.max(0.05, e) : 0;
      rig.reject.density = running ? 1 - e : 0;
      rig.thermoHot.level = (th() - 0) / 1700;
      rig.thermoCold.level = tc() / 60;
      applyHeat(rig.hot.material, 0.35 + 0.65 * (th() / 1700));
      etaTag.text = running ? `η_C = ${(100 * e).toFixed(1).replace('.', ',')} %` : '—';
      hotTag.text = `${th()} °C`;
      coldTag.text = `${tc()} °C`;
      arch.want.ring = 0.3;
      hub.sound.fire = 0.12 + 0.2 * (th() / 1700);
      hub.sound.turbine = running ? 0.1 + 0.2 * e : 0;
      hub.sound.turbinePitch = 0.4 + e;
    },
  };
};
