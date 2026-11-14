/**
 * Step 4 `control` — «Сповільнювач, стрижні, бор і запізнілі нейтрони». A cut through a piece of the core:
 * fuel rods, water, boric acid, two absorber rods. «Сповільнити нейтрон»: a 2 MeV neutron leaves a rod, hits
 * 19 hydrogen nuclei (coral flashes) and enters the next rod at 0,025 eV (orange flash: fission); the board
 * plots its energy per collision (log). A stray neutron now and then ends in an absorber rod (steel flash).
 * The delayed-neutron timer waits ≈ 13 s and lets a neutron go. The switch «Запізнілі нейтрони» and the
 * reactivity slider draw the power over 10 s (model M3 one group / prompt only — the «wall»).
 */
import { Vector3 } from 'three';
import { createHalo, createNeutron, createParticles, createTrail, pointEmitter } from '@/fx';
import { delayedStepResponse, promptGrowthPerSecond, promptOnlyPower } from '@electricity/sim/plant-nuclear';
import { HOTSPOTS } from '../hotspots';
import { MICRO_POST, MICRO_TUNE } from '../looks';
import { buildDelayed } from '../parts/delayed';
import { COLLISIONS, ROD_X, buildModeration } from '../parts/moderation';
import { hot } from './hot';
import type { StepFactory } from './types';

const DELAYED_AT = new Vector3(20, 9, 5);
/** Visual speed (m/s of the set) of a neutron of energy E: fast ones streak, thermal ones crawl. */
const speedOf = (e: number): number => 3 + 26 * Math.max(0, Math.log10(e / 0.025) / Math.log10(8e7));
const times = (n: number): string => `×${n >= 1e3 ? `${Math.round(n / 1e3)} 000` : n >= 10 ? Math.round(n) : n.toFixed(2).replace('.', ',')}`;
const eText = (e: number): string => (e >= 1e6 ? `${(e / 1e6).toFixed(1)} MeV` : e >= 1e3 ? `${(e / 1e3).toFixed(1)} keV` : e >= 1 ? `${e.toFixed(1)} eV` : `${e.toFixed(3)} eV`).replace('.', ',');

export const control: StepFactory = ({ ctx, ui, L, inner }) => {
  const set = inner.sets.control;
  const mod = buildModeration(ctx);
  set.add(mod.group);
  const delayed = buildDelayed();
  delayed.group.position.copy(DELAYED_AT);
  set.add(delayed.group);
  const hero = createNeutron({ radius: 0.62 });
  const trail = createTrail(hero, { color: 'mist', duration: 0.6, width: 0.4, intensity: 1 });
  const halo = createHalo({ color: 'white', size: 3.4, intensity: 0.9 });
  hero.add(halo);
  const stray = createNeutron({ radius: 0.55 });
  const hFlash = createParticles(ctx, { count: 60, loop: false, emitter: pointEmitter(), sprite: 'soft', color: ['white', 'coral'], life: [0.35, 0.5], speed: [0, 0.2], size: [2.4, 0.6], intensity: 1.5 });
  const fFlash = createParticles(ctx, { count: 40, loop: false, emitter: pointEmitter(), sprite: 'soft', color: ['yellow', 'orange', 'red'], life: [0.7, 1], speed: [0, 0.5], size: [4.5, 1.5], intensity: 1.6 });
  const sFlash = createParticles(ctx, { count: 40, loop: false, emitter: pointEmitter(), sprite: 'soft', color: ['white', 'steel'], life: [0.4, 0.6], speed: [0, 0.2], size: [2.6, 0.6], intensity: 1.2 });
  set.add(hero, trail, stray, hFlash, fFlash, sFlash);

  // the walk as timed segments
  const pts = [mod.path.start, ...mod.path.hits, mod.path.end];
  const seg = pts.slice(1).map((p, i) => pts[i]!.distanceTo(p) / speedOf(mod.energy[i]!));
  let walkT = -1; // < 0: idle (neutron waits in the left rod)
  let hitsDone = 0;
  const slow = (): void => {
    walkT = 0;
    hitsDone = 0;
    trail.reset();
  };
  let strayT = 0;
  const strayFrom = new Vector3(ROD_X[2] + 1.4, -6, 1);
  const strayTo = new Vector3(8.75, -4, -3);
  const delayedOn = (): boolean => ui.value<string>('co.delayed') === 'on';
  const pcm = (): number => ui.value<number>('co.rho');
  const energyNow = (): number => mod.energy[Math.min(hitsDone, COLLISIONS)]!;
  const w = (v: Vector3): Vector3 => set.localToWorld(v.clone());
  ctx.qa.expose('control', () => ({ walking: walkT >= 0, hits: hitsDone, energy: energyNow(), delayed: delayedOn(), pcm: pcm() }));
  let chartT = 0;
  const [delayedTitle, delayedItems] = [L.delayedSwitch.title, L.delayedSwitch.items];
  return {
    id: 'control',
    stage: {
      camera: 'control',
      envTune: MICRO_TUNE,
      post: MICRO_POST,
      enter: (info) => {
        delayed.reset();
        chartT = 0;
        walkT = -1;
        hitsDone = 0;
        info.scope.delay(info.instant ? 0.4 : 1.2, slow);
      },
    },
    ui: {
      reset: true,
      honesty: [{ kind: 'notToScale', text: L.microChip }, { kind: 'simplified', text: L.simplified }],
      controls: [
        { type: 'button', id: 'co.slow', label: L.slowDown, icon: 'play', primary: true, onClick: slow },
        { type: 'segmented', id: 'co.delayed', label: delayedTitle, items: [{ id: 'on', label: delayedItems[0]! }, { id: 'off', label: delayedItems[1]! }], value: 'on', onChange: () => (chartT = 0) },
        { type: 'slider', id: 'co.rho', label: L.reactivity, min: 0, max: 100, step: 5, unit: 'pcm', value: 50, onChange: () => (chartT = 0) },
      ],
      board: {
        title: L.slowdownTitle,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'co.e',
            chart: { height: 120, x: { min: 0, max: 20, label: L.collisionsAxis }, y: { min: 0.01, max: 1e7, log: true, label: L.energyAxis, ticks: [0.01, 1, 1e3, 1e6] }, series: [{ id: 'e', color: 'mist', kind: 'step' }] },
            update: (chart) => {
              const n = Math.min(hitsDone, COLLISIONS);
              chart.setData('e', Array.from({ length: n + 1 }, (_, i) => i), mod.energy.slice(0, n + 1));
              chart.setMarker('now', { x: n, y: energyNow(), color: 'cyan', guides: false });
            },
          },
          { type: 'stats', id: 'co.now', columns: 3, items: [{ label: L.neutronEnergyNow, get: () => eText(energyNow()) }, { label: L.collisions, get: () => hitsDone }, { label: L.delayedTimer, get: () => `${Math.ceil(delayed.left)} s` }] },
          {
            type: 'chart',
            id: 'co.p',
            chart: {
              height: 120,
              legend: true,
              x: { min: 0, max: 10, label: 't, s' },
              y: { min: 1, max: 1000, log: true, label: L.powerAxis },
              series: [{ id: 'with', label: L.withDelayed, color: 'green' }, { id: 'without', label: L.promptOnly, color: 'red' }],
            },
            update: (chart) => {
              const ts = Array.from({ length: 101 }, (_, i) => (i / 100) * Math.min(10, chartT));
              chart.setData('with', ts, ts.map((t) => Math.max(1, delayedStepResponse(pcm(), t))));
              if (delayedOn()) chart.clearData('without');
              else chart.setData('without', ts, ts.map((t) => Math.max(1, promptOnlyPower(pcm(), t))));
              chart.setMarker('wall', !delayedOn() && promptOnlyPower(pcm(), Math.min(10, chartT)) >= 999 ? { x: 1.2, y: 600, label: L.wall, color: 'red', guides: false } : null);
            },
          },
          { type: 'readout', id: 'co.x', label: L.perSecond, text: () => times(delayedOn() ? delayedStepResponse(pcm(), 1) : promptGrowthPerSecond(pcm())), color: () => (delayedOn() ? 'green' : 'red') },
        ],
      },
      callouts: [
        { anchor: () => w(new Vector3(ROD_X[0], 15.5, 0)), text: L.fuelRod, side: 'up', priority: 1 },
        { anchor: () => w(new Vector3(8.75, 20, -4)), text: L.absorberRod, side: 'up', priority: 2 },
        { anchor: () => w(DELAYED_AT.clone().add(new Vector3(0, -4, 0))), text: L.fragmentLabel, side: 'down', priority: 3 },
        { anchor: () => w(new Vector3(0, -12, 4)), text: L.water, side: 'down', priority: 4 },
      ],
      hotspots: [hot(() => w(new Vector3(-8.75, 17, -4)), HOTSPOTS.control.b4c), hot(() => w(new Vector3(0, 8, 6)), HOTSPOTS.control.feedback)],
    },
    update(dt, t) {
      chartT += dt;
      delayed.update(dt, t);
      // hero walk
      if (walkT >= 0) {
        walkT += dt;
        let acc = 0;
        let i = 0;
        while (i < seg.length && acc + seg[i]! < walkT) acc += seg[i++]!;
        while (hitsDone < Math.min(i, COLLISIONS)) {
          const h = mod.path.hits[hitsDone++]!;
          hFlash.emit(1, { position: [h.x, h.y, h.z] });
        }
        if (i >= seg.length) {
          fFlash.emit(1, { position: [mod.path.end.x, mod.path.end.y, mod.path.end.z] });
          hero.position.copy(mod.path.end);
          walkT = -1;
        } else hero.position.copy(pts[i]!).lerp(pts[i + 1]!, (walkT - acc) / seg[i]!);
      } else if (hitsDone === 0) hero.position.copy(mod.path.start);
      hero.scale.setScalar(walkT >= 0 || hitsDone === 0 ? 1 : 0.001);
      // a stray thermal neutron drifts into an absorber rod every few seconds
      strayT = (strayT + dt) % 5;
      const u = Math.min(1, strayT / 2.4);
      stray.position.copy(strayFrom).lerp(strayTo, u);
      stray.scale.setScalar(strayT < 2.4 ? 1 : 0.001);
      if (strayT >= 2.4 && strayT - dt < 2.4) sFlash.emit(1, { position: [strayTo.x, strayTo.y, strayTo.z] });
      mod.absorbers.group.position.y = -2 + Math.sin(t * 0.25) * 1.2;
    },
  };
};

