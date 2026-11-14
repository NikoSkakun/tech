/**
 * Step 9 `emissions-hydrogen` — «CO₂, метан, NOₓ і водень». Over the CCGT's stack the CO₂ «хмара» (disc area ∝
 * g CO₂-eq/kWh) beside the fixed coal «примара» (820 g/kWh, life cycle); below, the gas's way from the well
 * (flare) to the station with leak points puffing `violet` methane; the hydrogen mixer and its test flame.
 * «ККД станції» → direct g/kWh; «Витоки метану» + horizon (100 / 20 years) → the cloud swells, a note marks
 * the moment it reaches the ghost; «Водень у суміші» → the energy share of H₂ (non-linear curve on the board),
 * the CO₂ cut and the badge «доступно…» (≤ 50 %) / «у розробці…» (> 50 %). Model M6.
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { COAL_LIFECYCLE_G_KWH, UPSTREAM_G_KWH, directCo2GPerKWh, hydrogenBadge, hydrogenEnergyShare, leakGPerKWh, type GwpHorizon } from '@electricity/sim/plant-gas';
import type { Chart } from '@/ui3d';
import { HOTSPOTS } from '../hotspots';
import { fill } from '../labels';
import { buildEmissions, cloudRadius } from '../parts/emissions';
import { hot } from './hot';
import type { StepFactory } from './types';

export const emissionsHydrogen: StepFactory = ({ ctx, ui, L, live, shell }) => {
  const em = buildEmissions(ctx);
  ctx.root.add(em.group);
  const eta = (): number => ui.value<number>('em.eta') / 100;
  const leak = (): number => ui.value<number>('em.leak') / 100;
  const horizon = (): GwpHorizon => ui.value<GwpHorizon>('em.gwp');
  const x = (): number => ui.value<number>('em.h2') / 100;
  const eH2 = (): number => hydrogenEnergyShare(x());
  // hydrogen replaces part of the methane's energy: direct CO₂ and the methane chain shrink by that share
  const direct = (): number => directCo2GPerKWh(eta()) * (1 - eH2());
  const leaks = (): number => leakGPerKWh(eta(), leak(), horizon()) * (1 - eH2());
  const total = (): number => direct() + UPSTREAM_G_KWH * (1 - eH2()) + leaks();
  let shown = 430; // eased toward total() every frame (ui values exist only after define)
  let drawnX = -1;
  const curveX = Array.from({ length: 51 }, (_, i) => i * 2);
  ctx.qa.expose('emis', () => ({ total: total(), eH2: eH2(), cloud: em.cloud.scale.x, leaks: em.leaks.density }));
  return {
    id: 'emissions-hydrogen',
    stage: { camera: 'emissions-hydrogen', show: [...shell.outside, em.group] },
    ui: {
      honesty: ['notToScale', { kind: 'simplified', text: L.cloudArea }],
      controls: [
        { type: 'slider', id: 'em.eta', label: L.plantEta, min: 30, max: 64, step: 1, value: 60, unit: '%', digits: 0 },
        { type: 'slider', id: 'em.leak', label: L.leaks, min: 0, max: 5, step: 0.1, value: 1, unit: '%', digits: 1 },
        {
          type: 'segmented',
          id: 'em.gwp',
          label: L.horizon,
          items: [
            { id: 'gwp100', label: L.gwp100 },
            { id: 'gwp20', label: L.gwp20 },
          ],
          value: 'gwp100',
        },
        { type: 'slider', id: 'em.h2', label: L.hydrogen, min: 0, max: 100, step: 1, value: 0, unit: '%', digits: 0 },
        { type: 'note', id: 'em.badge', icon: 'info', color: () => (hydrogenBadge(x()) === 'available' ? 'green' : 'amber'), text: () => (hydrogenBadge(x()) === 'available' ? L.h2Available : L.h2Development), visible: () => x() > 0 },
        { type: 'note', id: 'em.parity', icon: 'warning', color: 'red', text: L.parity, visible: () => total() >= COAL_LIFECYCLE_G_KWH },
      ],
      board: {
        title: L.h2Chart,
        size: 'md',
        children: [
          {
            type: 'stats',
            id: 'em.stats',
            items: [
              { label: L.direct, get: direct, unit: 'g/kWh', digits: 0 },
              { label: L.leakShare, get: leaks, unit: 'g/kWh', digits: 0 },
              { label: L.total, get: total, unit: 'g/kWh', digits: 0 },
              { label: L.coalLife, get: () => COAL_LIFECYCLE_G_KWH, unit: 'g/kWh', digits: 0 },
            ],
          },
          {
            type: 'chart',
            id: 'em.curve',
            chart: {
              height: 140,
              x: { min: 0, max: 100, label: 'H₂, % об’єму' },
              y: { min: 0, max: 100, label: `${L.h2Energy}, %` },
              series: [
                { id: 'diag', color: 'mist', dash: true, opacity: 0.5, width: 1.6 },
                { id: 'e', color: 'mist', width: 2.6 },
              ],
              legend: false,
            },
            init: (c: Chart) => {
              c.setData('diag', [0, 100], [0, 100]);
              c.setData('e', curveX, curveX.map((v) => hydrogenEnergyShare(v / 100) * 100));
            },
            update: (c: Chart) => {
              if (drawnX === x()) return;
              drawnX = x();
              c.setMarker('now', { x: x() * 100, y: eH2() * 100, label: fmtUnit(Math.round(eH2() * 100), '%'), color: 'yellow' });
            },
          },
          { type: 'readout', id: 'em.cut', label: L.co2Cut, unit: '%', digits: 1, get: () => eH2() * 100 },
        ],
      },
      callouts: [
        { anchor: () => em.cloudAt.clone().add(new Vector3(0, cloudRadius(shown) + 2, 0)), text: () => fill(L.cloudLabel, L.cloud, fmtUnit(Math.round(total()), 'g/kWh')), priority: 0 },
        { anchor: () => em.ghostAt.clone().add(new Vector3(0, cloudRadius(COAL_LIFECYCLE_G_KWH) + 2, 0)), text: () => fill(L.cloudLabel, L.ghost, fmtUnit(COAL_LIFECYCLE_G_KWH, 'g/kWh')), priority: 1 },
        { anchor: () => em.leakPoints[2]!.clone().add(new Vector3(0, 10, 0)), text: () => `${L.leaks} · ${fmtUnit(Math.round(leak() * 1000) / 10, '%')}`, color: 'violet', side: 'right', priority: 2 },
      ],
      hotspots: [hot(() => em.flareAt, HOTSPOTS['emissions-hydrogen'].flare), hot(() => em.burnerAt.clone().add(new Vector3(0, 3, 0)), HOTSPOTS['emissions-hydrogen'].h2flame)],
    },
    update(dt) {
      live.gtTarget = 1;
      shown += (total() - shown) * Math.min(1, dt * 3);
      em.setCloud(shown);
      em.setLeak(leak());
      em.setHydrogen(x());
    },
  };
};
