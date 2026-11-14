/**
 * Step 11 `fuel-cycle` — «Паливний цикл і відпрацьоване паливо». The belt of stages (`cycle-belt.ts`); the
 * yearly mass flows of a 1000 MW unit stand in the board's table (chip «оцінка»). «Рік» moves an assembly from
 * its last year in the reactor through the pool to dry storage; its heat (decay heat of model M5, relative to
 * one day after unloading, log) falls. «Скільки займає?» shows the 40-year spent fuel as one 4,6 m cube of UO₂
 * beside a stadium. The enrichment calculator (model M6): x_P and x_T → kg of natural uranium per kg of fuel.
 */
import { Vector3 } from 'three';
import { decayHeatFraction, feedPerProduct, tailsPerProduct } from '@electricity/sim/plant-nuclear';
import { HOTSPOTS } from '../hotspots';
import { HALL_TUNE, INNER_POST } from '../looks';
import { STAGES, buildCycleBelt } from '../parts/cycle-belt';
import { hot } from './hot';
import type { StepFactory } from './types';

const YEAR_S = 3.156e7;
const DAY_S = 86400;
/** Belt position (stage units) of the riding assembly in year y: 1 = last year in the reactor, 2–4 pool, 5 dry. */
const stageOf = (y: number): number => (y <= 1.5 ? 5 : y <= 2 ? 5 + (y - 1.5) * 2 : y <= 4.5 ? 6 : y <= 5 ? 6 + (y - 4.5) * 2 : 7);

export const fuelCycle: StepFactory = ({ ui, L, inner, ctx }) => {
  const set = inner.sets.cycle;
  const belt = buildCycleBelt();
  set.add(belt.group);
  const aHow = ctx.stage.actor(belt.howMuch, { appear: 'pop' });
  const year = (): number => ui.value<number>('fc.year');
  const xP = (): number => ui.value<number>('fc.xp');
  const xT = (): number => ui.value<number>('fc.xt');
  const heatRel = (): number => (year() <= 1.5 ? 1 : decayHeatFraction((year() - 1.5) * YEAR_S + DAY_S) / decayHeatFraction(DAY_S));
  let how = false;
  const w = (p: Vector3): Vector3 => set.localToWorld(p.clone());
  const fmt = (v: number, d = 2): string => v.toFixed(d).replace('.', ',');
  ctx.qa.expose('cycle', () => ({ year: year(), heat: heatRel(), feed: feedPerProduct(xP(), xT()), how }));
  return {
    id: 'fuel-cycle',
    stage: { camera: 'fuel-cycle', envTune: HALL_TUNE, post: INNER_POST, enter: () => (how = false) },
    ui: {
      reset: true,
      honesty: ['notToScale', { kind: 'illustrative', text: L.estimate }],
      controls: [
        { type: 'slider', id: 'fc.year', label: L.year, min: 1, max: 5, step: 0.1, digits: 1, value: 1, marks: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })) },
        { type: 'button', id: 'fc.how', label: L.howMuch, icon: 'scale', onClick: () => ctx.stage.toggle(aHow, (how = !how)) },
        { type: 'slider', id: 'fc.xp', label: L.xP, min: 3, max: 5, step: 0.1, unit: '%', digits: 1, value: 4.5 },
        { type: 'slider', id: 'fc.xt', label: L.xT, min: 0.2, max: 0.3, step: 0.01, unit: '%', digits: 2, value: 0.25 },
      ],
      board: {
        title: L.cycleTitle,
        size: 'sm',
        children: [
          { type: 'table', id: 'fc.flows', rows: [[L.stMine, L.flowNatural], [L.stConversion, L.flowUf6], [L.stEnrich, L.flowEnriched], [L.stFab, L.flowFuel], [L.stPool, L.flowSpent]] },
          { type: 'stats', id: 'fc.calc', columns: 2, items: [{ label: L.feedRatio, get: () => `${fmt(feedPerProduct(xP(), xT()))} kg` }, { label: L.tailsRatio, get: () => `${fmt(tailsPerProduct(xP(), xT()))} kg` }] },
          { type: 'readout', id: 'fc.heat', label: `${L.faHeat} (${L.faHeatRel})`, text: () => (year() <= 1.5 ? '—' : `${fmt(heatRel() * 100, heatRel() < 0.1 ? 1 : 0)} %`) },
          { type: 'note', id: 'fc.snf', text: () => `${L.snf40} · ${L.snfCube} · ${L.casks70}`, icon: 'info', color: 'mist', visible: () => how },
        ],
      },
      callouts: [
        ...STAGES.map((id, i) => ({ anchor: () => w(belt.at.stage[i]!), text: L[id], side: (i % 2 ? 'up' : 'down') as 'up' | 'down', priority: i === 6 || i === 3 ? 0 : 2 + i, color: id === 'stMill' ? ('amber' as const) : undefined })),
        { anchor: () => w(belt.at.reprocess), text: L.stReprocess, side: 'up', priority: 10 },
        { anchor: () => w(belt.at.repository), text: L.stRepository, side: 'right', priority: 1 },
        { anchor: () => w(belt.at.cube), text: L.snfCube, side: 'up', visible: () => how, priority: 0 },
        { anchor: () => w(belt.at.stadium), text: L.stadium, side: 'up', visible: () => how, priority: 1 },
      ],
      hotspots: [hot(() => w(belt.at.stage[3]!.clone().add(new Vector3(3, -2, 2))), HOTSPOTS['fuel-cycle'].centrifuge), hot(() => w(belt.at.repository.clone().add(new Vector3(-5, 0, 0))), HOTSPOTS['fuel-cycle'].onkalo)],
    },
    update(dt) {
      for (const c of belt.centrifuges) c.rotation.y += dt * 9;
      belt.ride(stageOf(year()));
    },
  };
};
