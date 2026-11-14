/**
 * Step 8 `gas-engines` — «Газопоршневі установки і розподілена генерація». Winter night. The engine hall opens:
 * the hero V-engine runs in section (pistons, `yellow` sparks, `orange` flashes, the turbocharger turning), its
 * heat goes along the `orange` heat main to the lit town. «Такт за тактом» holds the engine and moves cylinder 1
 * one stroke per press (its callout names the stroke). «Вигляд → Мапа району» flies over the town: 20 container
 * units by the quarters or one 200 MW station at the edge; «Подія: одна установка вийшла з ладу» picks a
 * deterministic random unit — one quarter goes dark (5 %) or, with the single station, the whole town (100 %)
 * (no explosions or damage: the unit simply goes out, DECISIONS §7). «Тепло місту» 0…100 % → ε 45…87 % (M5).
 */
import { Vector3 } from 'three';
import { districtOutageShare, engineChp, type DistrictLayout } from '@electricity/sim/plant-gas';
import { HOTSPOTS } from '../hotspots';
import { cylinderX, bankAxis, ENGINE_GEO } from '../parts/engine';
import type { Stroke } from '../parts/engine-anim';
import { hot } from './hot';
import type { StepFactory } from './types';

export const gasEngines: StepFactory = ({ ctx, ui, L, live, isl, shell }) => {
  const { engines, town } = isl;
  const anim = engines.anim;
  const rng = ctx.random.fork('outage');
  let stepping = false;
  let failed: number[] = [];
  const layout = (): DistrictLayout => ui.value<DistrictLayout>('eng.layout');
  const strokeName: Record<Stroke, string> = { intake: L.strokeIntake, compression: L.strokeCompression, power: L.strokePower, exhaust: L.strokeExhaust };
  const local = (p: Vector3): Vector3 => p.clone().add(engines.heroAt);
  const cyl0 = (): Vector3 => local(new Vector3(cylinderX(0), ENGINE_GEO.crankY, 0).addScaledVector(bankAxis(true), ENGINE_GEO.rod + ENGINE_GEO.linerLength * 0.6));
  const stroke = (): void => {
    stepping = true;
    anim.speed = 0;
    // one stroke = half a crank turn; land on the next stroke boundary
    const target = (Math.floor(anim.crankAngle / Math.PI + 1e-3) + 1) * Math.PI;
    ctx.stage.scope.to(anim, { crankAngle: target }, { duration: 0.9, ease: 'power2.inOut' });
  };
  const runNormally = (): void => {
    stepping = false;
  };
  const view = (v: string): void => ctx.camera.go(v === 'map' ? 'gas-engines-map' : 'gas-engines', { duration: 1.8 });
  const fail = (): void => {
    const free = town.unit.map((_, i) => i).filter((i) => !failed.includes(i));
    if (!free.length) return;
    failed = [...failed, free[rng.int(0, free.length - 1)]!];
    if (ui.value<string>('eng.view') !== 'map') ui.set('eng.view', 'map', { notify: true });
  };
  const reset = (): void => {
    failed = [];
  };
  const off = (): number => districtOutageShare(layout(), failed.length);
  const onMap = (): boolean => ui.value<string>('eng.view') === 'map';
  ctx.qa.expose('engine', () => ({ stepping, crank: anim.crankAngle, stroke: anim.stroke(), off: off(), failed: failed.length, single: layout() === 'single200', eps: engineChp(ui.value<number>('eng.heat') / 100).fuelUtilisation }));
  return {
    id: 'gas-engines',
    stage: {
      camera: 'gas-engines',
      show: [...shell.outside.filter((a) => a !== shell.engineRoof && a !== shell.engineFront), shell.engines],
      env: 'night',
      enter: (info) => {
        stepping = false;
        failed = [];
        if (ui.value<string>('eng.view') === 'map') ctx.camera.go('gas-engines-map', { duration: info.instant ? 0 : 1.8 });
      },
      leave: () => {
        stepping = false;
        anim.speed = 6;
        town.powered.fill(1);
        town.failed.fill(false);
        town.single = 0;
      },
    },
    ui: {
      honesty: ['notToScale', { slowed: 10, visible: () => !stepping }, 'simplified'],
      controls: [
        {
          type: 'segmented',
          id: 'eng.view',
          label: L.view,
          items: [
            { id: 'engine', label: L.viewEngine },
            { id: 'map', label: L.districtMap },
          ],
          value: 'engine',
          onChange: view,
        },
        { type: 'slider', id: 'eng.heat', label: L.heatToCity, min: 0, max: 100, step: 1, value: 100, unit: '%', digits: 0 },
        {
          type: 'segmented',
          id: 'eng.layout',
          label: L.districtMap,
          items: [
            { id: 'single200', label: L.single200 },
            { id: 'twenty10', label: L.twenty10 },
          ],
          value: 'twenty10',
          onChange: reset,
        },
        { type: 'readout', id: 'eng.eps', label: L.fuelUse, unit: '%', digits: 0, get: () => engineChp(ui.value<number>('eng.heat') / 100).fuelUtilisation * 100 },
        { type: 'readout', id: 'eng.off', label: L.offShare, unit: '%', digits: 0, get: () => off() * 100, color: (v: number) => (v > 0 ? 'red' : 'green') },
        { type: 'button', id: 'eng.stroke', label: L.strokeByStroke, icon: 'next', onClick: stroke },
        { type: 'button', id: 'eng.run', label: L.runNormally, icon: 'play', visible: () => stepping, onClick: runNormally },
        { type: 'button', id: 'eng.fail', label: L.unitFails, icon: 'warning', onClick: fail },
        { type: 'button', id: 'eng.restore', label: L.restoreDistrict, icon: 'resetView', visible: () => failed.length > 0, onClick: reset },
      ],
      callouts: [
        { anchor: cyl0, text: () => (stepping ? strokeName[anim.stroke()] : L.engineHall), color: 'yellow', side: 'right', priority: 0, visible: () => !onMap() },
        { anchor: () => local(engines.hero.at.generator), text: L.generator, side: 'right', priority: 1, visible: () => !onMap() },
        { anchor: () => local(engines.hero.at.heat).add(new Vector3(0, -3.2, 0.8)), text: L.heatOut, color: 'orange', side: 'left', priority: 2, visible: () => !onMap() },
        { anchor: () => town.bigAt.clone().add(new Vector3(0, 40, 0)), text: L.bigStation, priority: 0, visible: () => onMap() && layout() === 'single200' },
      ],
      hotspots: [
        hot(() => local(engines.hero.at.turbo), HOTSPOTS['gas-engines'].turbo, { visible: () => !onMap() }),
        hot(() => town.unit[6]!.clone().add(new Vector3(0, 3, 0)), HOTSPOTS['gas-engines'].container, { visible: () => onMap() && layout() === 'twenty10' }),
      ],
    },
    update(dt) {
      live.nightTarget = 1;
      live.enginesTarget = 8;
      if (!stepping) anim.speed += (6 - anim.speed) * Math.min(1, dt * 3);
      const single = layout() === 'single200';
      town.single += ((single ? 1 : 0) - town.single) * Math.min(1, dt * 4);
      const share = off();
      town.powered.forEach((_, i) => (town.powered[i] = single ? (share > 0 ? 0 : 1) : failed.includes(i) ? 0 : 1));
      town.failed.forEach((_, i) => (town.failed[i] = failed.includes(i)));
      isl.heatFlow.density = ui.value<number>('eng.heat') / 100;
    },
  };
};
