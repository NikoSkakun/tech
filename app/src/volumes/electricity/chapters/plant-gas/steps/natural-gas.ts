/**
 * Step 2 `natural-gas` — «Природний газ: метан». Low along the pipeline to the gas receiving station: a
 * transparent run of pipe with methane molecules streaming in (`violet` gas), specks of dust caught by the
 * filter screen, the station's filter → heater → meter → booster; over the pipe the «реакція» on a loop. The
 * fuel switch changes the reaction and lifts one bar in each chart (energy per kg, CO₂ per GJ). «1 m³ газу»
 * puts a 1 × 1 × 1 m cube by the pipe and says how much electricity it gives on a CCGT and on a simple GT.
 */
import { Mesh, Vector3 } from 'three';
import { fmtNumber, fmtUnit } from '@/content';
import { createMeshFlow } from '@/fx';
import type { ControlSpec } from '@/hud';
import { G } from '@/kit';
import { K } from '@/style';
import type { Chart } from '@/ui3d';
import { GAS_KWH_PER_M3, combinedCycle, electricityFromCubicMetreKWh } from '@electricity/sim/plant-gas';
import { HOTSPOTS } from '../hotspots';
import { fill } from '../labels';
import { GAS, ISLAND } from '../layout';
import { buildMolecules } from '../parts/molecules';
import { EQUATION, buildReaction, type Fuel } from '../parts/reaction';
import { hot } from './hot';
import type { StepFactory } from './types';

/** Document values: LHV per kg and emission factor per GJ (IPCC 2006). */
const FUELS: Record<Fuel, { mjPerKg: number; co2PerGJ: number; x: number }> = {
  coal: { mjPerKg: 25, co2PerGJ: 94.6, x: 1 },
  gas: { mjPerKg: 50, co2PerGJ: 56.1, x: 2 },
  h2: { mjPerKg: 120, co2PerGJ: 0, x: 3 },
};

export const naturalGas: StepFactory = ({ ctx, ui, L, isl, shell }) => {
  const { gas } = isl;
  const py = ISLAND.y + GAS.pipeY;
  const g0 = new Vector3(GAS.station.x - 34, py, GAS.station.z);
  const g1 = new Vector3(GAS.station.x - 16, py, GAS.station.z);
  // the transparent run of pipe and what flows in it
  const glass = new Mesh(G.cyl(1.05, g1.x - g0.x, { seg: 32, open: true, bevel: 0 }), K.glass({ color: 'violet.light', opacity: 0.22 }));
  glass.rotation.z = -Math.PI / 2;
  glass.position.copy(g0);
  ctx.root.add(glass);
  const mol = buildMolecules();
  const methane = createMeshFlow(ctx, { geometry: mol.geometry.CH4, material: mol.material, path: [g0.clone().add(new Vector3(-4, 0, 0)), g1.clone().add(new Vector3(4, 0, 0))], count: 26, speed: 2.4, scale: [0.75, 0.75], jitter: 0.4, tumble: 1.5 });
  ctx.root.add(methane);
  const screen = g0.clone().lerp(g1, 0.8);
  const dust = createMeshFlow(ctx, { geometry: G.sphere(0.08, 6), material: K.toon({ color: 'slate' }), path: [g0.clone(), screen.clone()], count: 12, speed: 1.6, jitter: 0.45 });
  ctx.root.add(dust);
  const sieve = new Mesh(G.cyl(1.0, 0.06, { seg: 28, bevel: 0 }), K.toon({ color: 'steel' }));
  sieve.rotation.z = Math.PI / 2;
  sieve.position.copy(screen);
  ctx.root.add(sieve);
  const reaction = buildReaction(1.9);
  reaction.group.position.set(GAS.station.x - 25, py + 8.5, GAS.station.z + 5);
  ctx.root.add(reaction.group);
  const cube = new Mesh(G.rbox(1, 1, 1, 0.04), K.glass({ color: 'violet', opacity: 0.4 }));
  cube.position.set(GAS.station.x - 24, ISLAND.y + 0.5, GAS.station.z + 3.4);
  ctx.root.add(cube);
  const aCube = ctx.stage.actor(cube, { appear: 'pop' });
  const items = [glass, methane, dust, sieve, reaction.group];
  const fuel = (): Fuel => ui.value<Fuel>('ng.fuel');
  // illustrative fuel flow of the full CCGT through the meter: fuel power / heat of 1 m³
  const m3h = (combinedCycle({ pressureRatio: 20, titC: 1600, levels: 3, hrsg: true, firingMW: 0 }).fuelMW * 1000) / GAS_KWH_PER_M3;
  const cubeText = `${fill(L.cubeHeat, fmtNumber(GAS_KWH_PER_M3, { digits: 1 }))} → ${fill(L.cubeCcgt, fmtNumber(electricityFromCubicMetreKWh(0.57), { digits: 1 }))} · ${fill(L.cubeGt, fmtNumber(electricityFromCubicMetreKWh(0.35), { digits: 1 }))}`;
  let grow = 1;
  const bars = (key: 'mjPerKg' | 'co2PerGJ', max: number, unit: string, title: string): ControlSpec => ({
    type: 'chart',
    id: `ng.${key}`,
    chart: {
      height: 150,
      x: { min: 0.4, max: 3.6, ticks: [1, 2, 3], format: (v: number) => [L.fuelCoal, L.fuelGas, L.fuelH2][Math.round(v) - 1] ?? '' },
      y: { min: 0, max, label: `${title}, ${unit}` },
      series: [
        { id: 'all', color: 'mist', kind: 'bars', opacity: 0.45, width: 0.5 },
        { id: 'sel', color: 'yellow', kind: 'bars', width: 0.5 },
      ],
      legend: false,
    },
    init: (c: Chart) => c.setData('all', [1, 2, 3], [FUELS.coal[key], FUELS.gas[key], FUELS.h2[key]]),
    update: (c: Chart) => c.setData('sel', [FUELS[fuel()].x], [FUELS[fuel()][key] * grow]),
  });
  ctx.qa.expose('fuel', () => ({ fuel: reaction.fuel, cube: cube.visible && cube.scale.x > 0.5 }));
  return {
    id: 'natural-gas',
    stage: { camera: 'natural-gas', show: [...shell.outside, ...items] },
    ui: {
      honesty: ['notToScale', { enlarged: 1e10, text: L.moleculesEnlarged }],
      controls: [
        {
          type: 'segmented',
          id: 'ng.fuel',
          label: L.fuel,
          items: [
            { id: 'gas', label: L.fuelGas },
            { id: 'coal', label: L.fuelCoal },
            { id: 'h2', label: L.fuelH2 },
          ],
          value: 'gas',
          onChange: () => (grow = 0),
        },
        { type: 'button', id: 'ng.cube', label: L.cubicMetre, icon: 'play', onClick: () => ctx.stage.toggle(aCube, true) },
        { type: 'note', id: 'ng.cubeNote', icon: 'info', text: cubeText, visible: () => cube.visible && cube.scale.x > 0.5 },
      ],
      board: {
        title: L.fuel,
        size: 'sm',
        children: [bars('mjPerKg', 130, 'MJ/kg', L.energyPerKg), bars('co2PerGJ', 100, 'kg', L.co2PerGJ)],
      },
      callouts: [
        { anchor: () => reaction.group.position.clone().add(new Vector3(0, 3.2, 0)), text: () => `${L.reaction}: ${EQUATION[fuel()]}`, side: 'up' },
        { anchor: () => gas.at.filter, text: L.filter },
        { anchor: () => gas.at.heater, text: L.heater },
        { anchor: () => gas.at.meter, text: () => `${L.meter} · ${fmtUnit(Math.round(m3h / 1000) * 1000, 'm³/h')}`, side: 'up' },
        { anchor: () => cube.position.clone().add(new Vector3(0, 0.6, 0)), text: L.cubicMetre, visible: () => cube.visible && cube.scale.x > 0.5 },
      ],
      hotspots: [hot(() => gas.at.odorant, HOTSPOTS['natural-gas'].odorant), hot(() => gas.at.booster, HOTSPOTS['natural-gas'].booster)],
    },
    update(dt) {
      grow = Math.min(1, grow + dt * 1.6);
      reaction.fuel = fuel();
      reaction.update(dt);
    },
  };
};
