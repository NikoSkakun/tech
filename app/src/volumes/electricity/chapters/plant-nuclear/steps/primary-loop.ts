/**
 * Step 7 `primary-loop` — «Два контури: перший під тиском, другий — пара». The opened containment from above:
 * four loops (hot legs `sky`, cold legs `blue`, violet sparks = radioactive coolant), horizontal steam
 * generators, main pumps turning, the pressurizer with bubbles; steam (`white`) leaves through the wall to the
 * opened turbine hall (separator-reheaters, K-1000, condenser) and the third circuit runs to the tower.
 * Model M4: «Тиск у компенсаторі» → margin to boiling T_sat(p) − 320 °C; below zero the hot legs fill with
 * bubbles and a red notice appears; «Нагрівачі» / «Розпилення» drive the pressure (`createPressurizer`).
 * «Показати контури» highlights one circuit; the pipes tell their medium, pressure and temperature on hover,
 * and the same three lines stand in the board's table (nothing hover-only).
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { createBubbles, createHalo, createParticles, curveEmitter, pointEmitter } from '@/fx';
import { HOT_LEG_C, createPressurizer, saturationTempC } from '@electricity/sim/plant-nuclear';
import { HOTSPOTS } from '../hotspots';
import { CONTAINMENT_TUNE } from '../looks';
import { hot } from './hot';
import type { StepFactory } from './types';

type Circuit = 'all' | 'first' | 'second' | 'third';

export const primaryLoop: StepFactory = ({ ctx, ui, L, live, plant, actors }) => {
  const it = plant.interior;
  const isl = plant.island;
  const pz = createPressurizer();
  let mode: 'idle' | 'heaters' | 'spray' = 'idle';
  let modeLeft = 0;
  const run = (m: 'heaters' | 'spray'): void => {
    mode = m;
    modeLeft = 8;
    pz.setMode(m);
  };
  // pressurizer life: bubbles in the water, heater glow, spray drops
  const pzg = it.loops.pressurizer;
  const bubbles = createBubbles(ctx, { size: [1.8, 5.5, 1.8], radius: 0.12, rise: 1.2 });
  bubbles.position.copy(pzg.anchorLocal('heaters')).add(new Vector3(0, 3, 0));
  const heat = createHalo({ color: 'orange', size: 4, intensity: 1.2 });
  heat.position.copy(pzg.anchorLocal('heaters'));
  const spray = createParticles(ctx, { count: 200, emitter: pointEmitter([0, 0, 0], { axis: [0, -1, 0], spread: 0.5 }), sprite: 'drop', color: ['white', 'sky.light'], life: [0.6, 0.9], speed: [2, 3], gravity: [0, -6, 0], size: [0.18, 0.1] });
  spray.position.copy(pzg.anchorLocal('spray'));
  pzg.group.add(bubbles, heat, spray);
  // boiling in the hot legs (margin < 0)
  const boil = it.loops.paths.hot.slice(0, 4).map((p) => {
    const b = createParticles(ctx, { count: 160, emitter: curveEmitter(new CatmullRomCurve3(p), { radius: 0.3 }), sprite: 'bubble', color: 'white', life: [0.5, 1], speed: [0.2, 0.6], size: [0.22, 0.32] });
    it.group.add(b);
    return b;
  });
  // tooltips on the pipes (desktop nicety; the board's table says the same)
  const active = (): boolean => ctx.stage.current === 'primary-loop';
  ctx.input.register(it.loops.primary.group, { tooltip: L.pipe1, enabled: active });
  ctx.input.register(it.loops.secondary.group, { tooltip: L.pipe2, enabled: active });
  ctx.input.register(isl.secondary.group, { tooltip: L.pipe2, enabled: active });
  ctx.input.register(isl.third.group, { tooltip: L.pipe3, enabled: active });

  const margin = (): number => saturationTempC(pz.pressureMPa) - HOT_LEG_C;
  const circuit = (): Circuit => ui.value<Circuit>('pl.c');
  const fade = (models: { mats: { list(): unknown[] } }[], f: number): void => {
    for (const m of models) for (const mat of m.mats.list() as { fade: number }[]) mat.fade = f;
  };
  const w = (p: Vector3): Vector3 => it.world(p);
  ctx.qa.expose('loop', () => ({ p: pz.pressureMPa, margin: margin(), mode, circuit: circuit(), boiling: margin() < 0 }));
  return {
    id: 'primary-loop',
    stage: {
      camera: 'primary-loop',
      show: [actors.interior, actors.island],
      envTune: CONTAINMENT_TUNE,
      enter: () => {
        it.restore();
        pz.setPressure(15.7);
        pz.setMode('idle');
        mode = 'idle';
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', { kind: 'simplified', text: L.simplified }],
      controls: [
        { type: 'slider', id: 'pl.p', label: L.pressure, min: 10, max: 17, step: 0.1, unit: 'MPa', digits: 1, value: 15.7, onChange: (v) => pz.setPressure(v) },
        { type: 'button', id: 'pl.heat', label: L.heaters, icon: 'arrowRight', onClick: () => run('heaters') },
        { type: 'button', id: 'pl.spray', label: L.spray, icon: 'arrowLeft', onClick: () => run('spray') },
        { type: 'segmented', id: 'pl.c', label: L.circuits, items: [{ id: 'first', label: L.first }, { id: 'second', label: L.second }, { id: 'third', label: L.third }, { id: 'all', label: L.all }], value: 'all' },
      ],
      board: {
        title: L.circuitTable,
        size: 'md',
        children: [
          { type: 'readout', id: 'pl.m', label: L.margin, unit: '°C', digits: 1, get: margin, color: (v) => (v < 0 ? 'red' : v < 8 ? 'amber' : 'green') },
          { type: 'stats', id: 'pl.ts', columns: 2, items: [{ label: L.boilingAt, get: () => `${saturationTempC(pz.pressureMPa).toFixed(1).replace('.', ',')} °C` }, { label: L.hotLegT, get: () => `${HOT_LEG_C} °C` }] },
          { type: 'note', id: 'pl.boil', text: L.boiling, icon: 'warning', color: 'red', visible: () => margin() < 0 },
          { type: 'table', id: 'pl.tab', head: ['', L.medium, 'p', 'T'], rows: [[L.first, L.circuit1, L.circuit1Pressure, L.circuit1Temp], [L.second, L.circuit2, L.circuit2Pressure, L.circuit2Temp], [L.third, L.circuit3, L.circuit3Pressure, L.circuit3Temp]], highlight: () => ['first', 'second', 'third'].indexOf(circuit()) },
          { type: 'note', id: 'pl.rad', text: L.radioactive, icon: 'dot', color: 'violet' },
        ],
      },
      callouts: [
        { anchor: () => w(it.loops.at.sg), text: L.steamGenerator, side: 'up', priority: 0 },
        { anchor: () => w(it.loops.at.pressurizer), text: L.pressurizerName, side: 'up', priority: 1 },
        { anchor: () => w(it.loops.at.pump), text: L.pump, side: 'right', priority: 2 },
        { anchor: () => isl.at.turbine, text: L.turbine, side: 'up', priority: 3 },
        { anchor: () => isl.at.msr, text: L.msr, side: 'up', priority: 4 },
        { anchor: () => isl.at.condenser, text: L.condenser, side: 'right', priority: 5 },
        { anchor: () => isl.at.third, text: L.toTower, side: 'right', priority: 6 },
      ],
      hotspots: [hot(() => w(it.loops.at.sg.clone().add(new Vector3(3, -1, 0))), HOTSPOTS['primary-loop'].sg), hot(() => w(it.loops.at.valve), HOTSPOTS['primary-loop'].valves)],
    },
    update(dt) {
      live.hallOpen = true;
      if (mode !== 'idle') {
        modeLeft -= dt;
        if (modeLeft <= 0) {
          mode = 'idle';
          pz.setMode('idle');
        }
      }
      pz.step(dt);
      if (Math.abs(ui.value<number>('pl.p') - pz.pressureMPa) > 0.04) ui.set('pl.p', Math.round(pz.pressureMPa * 10) / 10);
      heat.fade = mode === 'heaters' ? 1 : 0.25;
      spray.rate = mode === 'spray' ? 1 : 0;
      const boiling = margin() < 0;
      for (const b of boil) b.rate = boiling ? 1 : 0;
      // circuits: the chosen one stays solid and its flows bright, the others dim
      const c = circuit();
      const on = (x: Circuit): number => (c === 'all' || c === x ? 1 : 0.22);
      fade([it.loops.primary, it.rpv.vessel, it.loops.pressurizer, ...it.loops.sgs], on('first'));
      fade([it.loops.secondary, isl.secondary, isl.turbine], on('second'));
      fade([isl.third], on('third'));
      const f = it.flows;
      for (const x of [f.cold, f.hot, f.sparks, f.vesselCold, f.vesselHot]) x.fade = on('first');
      for (const x of [f.steam, f.feed, isl.flows.steam]) x.fade = on('second');
      for (const x of [isl.flows.third, isl.flows.thirdBack]) x.fade = on('third');
    },
  };
};

