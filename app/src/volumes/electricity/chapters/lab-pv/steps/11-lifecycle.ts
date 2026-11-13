/**
 * Step 11 `lifecycle` — thirty years on a time ribbon. The module rides the track with the age slider and
 * slowly yellows and cracks; the board plots the warranted power `relativePower` of the chosen technology and
 * counts the energy 1 kWp has delivered in Kyiv (`cumulativeEnergyKwh`); the hourglass empties within the
 * first year (energy payback). «Розібрати» swaps the module for its raw materials with their masses.
 */
import { Color, Group, Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { RibbonLines } from '@/fx';
import { HALF_CELLS, MODULE_MATERIALS_KG, cumulativeEnergyKwh, relativePower, type CellTechnology } from '@electricity/sim/lab-pv';
import { col } from '@/style';
import type { StepFactory } from '../chapter';
import { doc, docPair, xref } from '../content';
import { L, fill } from '../labels';
import { createLm440 } from '../parts/lm440';
import { M } from '../parts/lm440-layout';
import { MATERIAL_ORDER, createMaterials, type MaterialId } from '../parts/materials';
import { YEARS, createTimeRibbon } from '../parts/time-ribbon';
import { MODULE_SCALE, group, shadows } from '../world';

const ID = 'lifecycle';
const PAYBACK_YEARS = 1; // energy payback ≈ 1 year in Europe (document)
const MAT_LABEL: Record<MaterialId, string> = { glass: L.matGlass, aluminium: L.matAluminium, polymers: L.matPolymers, silicon: L.matSilicon, copper: L.matCopper, silver: L.matSilver };
const mass = (kg: number): string => (kg >= 0.1 ? `${fmtNumber(kg)} kg` : `${fmtNumber(Math.round(kg * 1000))} g`);

export const lifecycle: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const ribbon = createTimeRibbon();
  const module = createLm440();
  module.setExplode(0);
  module.group.scale.setScalar(MODULE_SCALE * 0.52);
  shadows(module.layers.frame);
  const tilt = new Group();
  tilt.rotation.x = 1.05;
  tilt.add(module.group);
  const rider = group('rider', 0, 0, 0, [tilt]);
  // hairline cracks over the cells, growing with age
  const cracks = new RibbonLines({ capacity: 64, color: 'mist', width: 0.008, intensity: 0, blend: 'normal' });
  const rng = ctx.random.fork('cracks');
  cracks.setLines(
    Array.from({ length: 5 }, () => {
      let x = rng.range(-M.iw / 2 + 0.1, M.iw / 2 - 0.1);
      let z = rng.range(-M.il / 2 + 0.1, M.il / 2 - 0.3);
      return { points: Array.from({ length: 6 }, () => new Vector3((x += rng.range(-0.07, 0.07)), 0.004, (z += rng.range(0.02, 0.09)))) };
    }),
  );
  module.group.add(cracks);
  const materials = createMaterials();
  materials.group.position.set(0.1, 0.95, 2.0);
  materials.group.scale.setScalar(0.74);
  const set = group('set:lifecycle', 0, 0, 0.9, [ribbon.group]);
  rider.position.z = 0.9;
  lab.stageRoot.add(set, rider, materials.group);
  const riderActor = ctx.stage.actor(rider);
  const matActor = ctx.stage.actor(materials.group);

  const year = (): number => ui.value<number>('year11');
  const tech = (): CellTechnology => (ui.value<string>('tech11') === 'perc' ? 'PERC' : 'TOPCon');
  const [topconLabel, percLabel] = docPair(ID, 1);
  const nextLab = xref('lab-inverter', 'why-inverter');
  const chartTech = new WeakMap<object, string>(); // which technology each chart instance has drawn
  let apart = false;
  let shownYear = -1;
  let x = 0;
  const fresh = col('bg.indigo').lerp(col('blue'), 0.28);
  const old = col('bg.indigo').lerp(col('amber'), 0.4); // yellowed encapsulant over the same dark cells
  const c = new Color();
  const p = new Vector3();
  ctx.qa.probe('rider11', rider);
  ctx.qa.expose('life11', () => ({ year: year(), tech: tech(), power: relativePower(year(), tech()), energy: cumulativeEnergyKwh(year(), tech()), apart }));

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.4, 4.4, 10.2], target: [0, 1.25, 1.2], frameAspect: 1.0, fov: 34, fit: { center: [0, 1.3, 1.2], radius: 3.5 }, orbit: { azimuth: 0.5, polar: 0.25 } },
    },
    stage: {
      show: [set, riderActor],
      enter() {
        apart = false;
        shownYear = -1;
      },
    },
    ui: {
      hint: L.hint11,
      honesty: ['illustrative'],
      board: {
        title: L.board11,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'warranty11',
            chart: {
              height: 200,
              x: { min: 0, max: YEARS, label: L.yearAxis, years: false },
              y: { min: 80, max: 100, label: 'P, %' },
              series: [{ id: 'other', label: L.guaranteeOther, color: 'mist', dash: true, opacity: 0.6 }, { id: 'now', label: L.guaranteeNow, color: 'sky', width: 3 }],
            },
            update: (chart) => {
              const key = `${tech()}`;
              if (key !== chartTech.get(chart)) {
                chartTech.set(chart, key);
                const xs = Array.from({ length: YEARS + 1 }, (_, i) => i);
                chart.setData('now', xs, xs.map((y) => relativePower(y, tech()) * 100));
                chart.setData('other', xs, xs.map((y) => relativePower(y, tech() === 'PERC' ? 'TOPCon' : 'PERC') * 100));
              }
              chart.setMarker('age', { x: year(), y: relativePower(year(), tech()) * 100, color: 'yellow', guides: true });
            },
          },
          {
            type: 'stats',
            id: 'life11',
            columns: 2,
            items: [
              { label: L.pShare, get: () => relativePower(year(), tech()) * 100, unit: '%', digits: 1, color: () => 'sky' },
              { label: L.energyCum, get: () => cumulativeEnergyKwh(year(), tech()), unit: 'kWh', digits: 0, color: () => 'yellow' },
            ],
          },
          { type: 'note', id: 'payback11', icon: 'clock', text: doc(ID, 4), visible: () => year() >= PAYBACK_YEARS },
        ],
      },
      controls: [
        { type: 'slider', id: 'year11', label: L.ageYears, min: 0, max: YEARS, step: 1, value: 0 },
        { type: 'segmented', id: 'tech11', items: [{ id: 'topcon', label: topconLabel }, { id: 'perc', label: percLabel }], value: 'topcon' },
        { type: 'toggle', id: 'apart11', label: doc(ID, 2), value: false },
        // the document's portal to the next lab: shown only when that chapter exists in this build
        { type: 'button', id: 'next11', label: L.toInverters, icon: 'arrowRight', visible: () => Boolean(nextLab && ctx.nav.locate(nextLab)), onClick: () => void (nextLab && ctx.nav.open(nextLab)) },
      ],
      callouts: [
        { anchor: () => ribbon.hourglass.localToWorld(p.set(0, 1.75, 0)), text: doc(ID, 3), side: 'up', color: 'yellow' },
        ...MATERIAL_ORDER.map((id) => ({ anchor: materials.anchors[id], text: fill(MAT_LABEL[id], { m: mass(MODULE_MATERIALS_KG[id]) }), side: 'up' as const, visible: () => apart })),
      ],
      hotspots: [
        { anchor: () => module.group.localToWorld(p.set(0.2, 0.02, 0.3)), content: 'microcracks', visible: () => !apart },
        { anchor: () => (apart ? materials.anchors.glass.getWorldPosition(p) : module.group.localToWorld(p.set(-0.3, 0.02, -0.5))), content: 'glass' },
      ],
    },
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      // «Розібрати»: the module gives way to its raw materials (a sub-state the next step entry reverts)
      const want = ui.value<boolean>('apart11');
      if (want !== apart) {
        apart = want;
        ctx.stage.toggle(riderActor, !apart);
        ctx.stage.toggle(matActor, apart);
      }
      const age = year() / YEARS;
      x += (year() - x) * Math.min(1, dt * 4);
      ribbon.at(x, rider.position);
      rider.position.z += set.position.z;
      rider.position.y = 1.3 + Math.sin(t * 1.1) * 0.05;
      rider.rotation.y = ribbon.heading(x) * 0.35;
      ribbon.setSand(Math.max(0, 1 - x / PAYBACK_YEARS));
      if (year() !== shownYear) {
        shownYear = year();
        for (let i = 0; i < HALF_CELLS; i++) module.cells.setColorAt(i, c.copy(fresh).lerp(old, age * 0.5));
        if (module.cells.instanceColor) module.cells.instanceColor.needsUpdate = true;
        cracks.intensity = age * 1.3;
        cracks.visible = age > 0.08;
      }
      materials.update(t);
    },
  };
};
