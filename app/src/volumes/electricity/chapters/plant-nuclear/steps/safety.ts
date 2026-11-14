/**
 * Step 9 `safety` — «Безпека: бар’єри, залишкове тепло, уроки аварій». The exhibit (`safety-exhibit.ts`): four
 * barriers around a pellet, the safety systems, the three diesel channels, the arch of the New Safe
 * Confinement. Scenario «Повне знеструмлення» on model M3: `АЗ` stops the chain reaction (the decay-heat
 * curve of Way–Wigner is drawn on the board, the marker runs at ×60); `Втратити охолодження` lets the coolant
 * heat up — amber at 345 °C (boiling), red at 370 °C (the core uncovers); `Запустити дизелі` restores cooling
 * after 15 s, `Гідроємності САОЗ` add 50 MW of heat removal for 10 min (both with their «спрощено» notes).
 * «Бар’єри» explodes the shells; tap one (or pick it in the dock) to read what it holds.
 */
import { Vector3 } from 'three';
import { createHalo } from '@/fx';
import { col } from '@/style';
import { REACTOR, createReactor, decayHeatFraction } from '@electricity/sim/plant-nuclear';
import { HOTSPOTS } from '../hotspots';
import { HALL_TUNE, INNER_POST } from '../looks';
import { BARRIER_IDS, buildSafetyExhibit, type BarrierId } from '../parts/safety-exhibit';
import { hot } from './hot';
import type { StepFactory } from './types';

const TAUS = Array.from({ length: 121 }, (_, i) => 10 ** ((i / 120) * Math.log10(3.15e7)));
const HOLDS: Record<BarrierId, 'holdPellet' | 'holdClad' | 'holdPrimary' | 'holdContainment'> = { pellet: 'holdPellet', clad: 'holdClad', primary: 'holdPrimary', containment: 'holdContainment' };
const NAMES: Record<BarrierId, 'barrierPellet' | 'barrierClad' | 'barrierPrimary' | 'barrierContainment'> = { pellet: 'barrierPellet', clad: 'barrierClad', primary: 'barrierPrimary', containment: 'barrierContainment' };

export const safety: StepFactory = ({ ctx, ui, L, inner }) => {
  const set = inner.sets.safety;
  const ex = buildSafetyExhibit(ctx);
  set.add(ex.group);
  const core = createHalo({ color: 'orange', size: 5, intensity: 1.3 });
  core.position.set(-9, 1, 0.3);
  set.add(core);
  let reactor = createReactor();
  let spread = 0;
  let dieselRun = false;
  const st = () => reactor.state;
  const tau = (): number => (st().scramTimeS === null ? 0 : Math.max(1, st().timeS - st().scramTimeS!));
  const barriersOn = (): boolean => ui.value<boolean>('sa.barriers');
  const picked = (): BarrierId => ui.value<BarrierId>('sa.pick');
  const active = (): boolean => ctx.stage.current === 'safety';
  for (const id of BARRIER_IDS)
    ctx.input.register(ex.barriers[id].group, {
      cursor: 'pointer',
      tooltip: L[NAMES[id]],
      enabled: () => active() && barriersOn(),
      click: () => ui.set('sa.pick', id, { notify: true }),
    });
  const w = (p: Vector3): Vector3 => set.localToWorld(p.clone());
  const barrierAt = (id: BarrierId): Vector3 => w(ex.barriers[id].group.position.clone().add(ex.at[id]).sub(new Vector3(-9, 0, 0)));
  ctx.qa.expose('safety', () => ({ ...st(), tau: tau(), spread }));
  const tC = (): string => `${st().tempC.toFixed(1).replace('.', ',')} °C`;
  return {
    id: 'safety',
    stage: {
      camera: 'safety',
      envTune: HALL_TUNE,
      post: INNER_POST,
      enter: () => {
        reactor = createReactor();
        spread = 0;
        dieselRun = false;
      },
    },
    ui: {
      reset: true,
      honesty: [{ kind: 'simplified', text: L.approxFormula }],
      controls: [
        { type: 'button', id: 'sa.scram', label: L.scram, icon: 'warning', primary: true, disabled: () => st().scram, onClick: () => reactor.scram() },
        { type: 'button', id: 'sa.lose', label: L.loseCooling, icon: 'close', disabled: () => !st().scram || st().coolingLost, onClick: () => reactor.loseCooling() },
        { type: 'button', id: 'sa.diesels', label: L.diesels, icon: 'lightning', disabled: () => !st().coolingLost || st().dieselsAtS !== null, onClick: () => {
            reactor.startDiesels();
            dieselRun = true;
          } },
        { type: 'button', id: 'sa.acc', label: L.accumulators, icon: 'arrowRight', disabled: () => !st().scram || st().accumulatorUsed, onClick: () => reactor.accumulators() },
        { type: 'toggle', id: 'sa.barriers', label: L.barriers, value: false },
        { type: 'segmented', id: 'sa.pick', items: BARRIER_IDS.map((id) => ({ id, label: L[NAMES[id]] })), value: 'pellet', visible: barriersOn },
      ],
      board: {
        title: `${L.blackout} · ${L.decayTitle}`,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'sa.decay',
            chart: {
              height: 140,
              x: { min: 1, max: 3.15e7, log: true, label: `t ${L.sinceScram}, s`, ticks: [1, 60, 3600, 86400, 3.15e7], format: (v) => (v < 2 ? '1 s' : v < 100 ? L.minute : v < 5000 ? L.hour : v < 1e5 ? L.day : L.yearTick) },
              y: { min: 0.01, max: 10, log: true, label: L.decayAxis },
              series: [{ id: 'd', color: 'orange' }],
            },
            init: (chart) => chart.setData('d', TAUS, TAUS.map((t) => decayHeatFraction(t) * 100)),
            update: (chart) => chart.setMarker('now', st().scram ? { x: tau(), y: decayHeatFraction(tau()) * 100, color: 'cyan', label: `${(decayHeatFraction(tau()) * 100).toFixed(2).replace('.', ',')} %` } : null),
          },
          {
            type: 'stats',
            id: 'sa.now',
            columns: 3,
            items: [
              { label: L.coolantT, get: tC, color: () => (st().tempC >= REACTOR.uncoveringC ? 'red' : st().tempC >= REACTOR.boilingC ? 'amber' : 'green') },
              { label: L.decayNow, get: () => (st().scram ? `${Math.round(st().thermalMW)} MW` : '—') },
              { label: L.heatRemoval, get: () => `${Math.round(st().heatRemovalMW)} MW` },
            ],
          },
          { type: 'note', id: 'sa.boil', text: L.boilingRising, icon: 'warning', color: 'amber', visible: () => st().alarm === 'boiling' },
          { type: 'note', id: 'sa.uncover', text: L.uncovering, icon: 'warning', color: 'red', visible: () => st().alarm === 'uncovering' },
          { type: 'note', id: 'sa.model', text: L.coolingModelNote, icon: 'info', color: 'mist', visible: () => st().coolingLost },
          { type: 'note', id: 'sa.accn', text: L.accumulatorNote, icon: 'info', color: 'mist', visible: () => st().accumulatorUsed },
          { type: 'readout', id: 'sa.hold', label: L.holds, text: () => `${L[NAMES[picked()]]}: ${L[HOLDS[picked()]]}`, visible: barriersOn },
        ],
      },
      callouts: [
        ...BARRIER_IDS.map((id, i) => ({ anchor: () => barrierAt(id), text: L[NAMES[id]], side: 'left' as const, priority: i, visible: () => barriersOn() || i === 3 })),
        { anchor: () => w(ex.at.tank), text: L.eccs, side: 'up', priority: 4 },
        { anchor: () => w(ex.at.channels), text: L.channels, side: 'right', priority: 5 },
        { anchor: () => w(ex.at.nsc), text: L.nsc, side: 'up', priority: 6 },
      ],
      hotspots: [
        hot(() => w(ex.at.tank.clone().add(new Vector3(2.6, -1.5, 1))), HOTSPOTS.safety.accumulator),
        hot(() => barrierAt('containment').add(new Vector3(-4, -2.5, 0)), HOTSPOTS.safety.recombiners),
        hot(() => w(ex.at.nsc.clone().add(new Vector3(2.2, -1, 0.5))), HOTSPOTS.safety.nsc),
      ],
    },
    update(dt) {
      reactor.step(dt * (st().scram ? 60 : 1));
      const s = st();
      spread += ((barriersOn() ? 1 : 0) - spread) * Math.min(1, dt * 3);
      ex.spread = spread;
      ex.update();
      // highlight the picked barrier (others dim) while the barrier view is on
      for (const id of BARRIER_IDS) for (const m of ex.barriers[id].mats.list() as unknown as { fade: number }[]) m.fade = barriersOn() && id !== picked() ? 0.3 : 1;
      // the fuel's glow follows the heat it makes; amber / red with the alarms
      const heat = s.thermalMW / 3000;
      core.fade = Math.min(1, 0.25 + 0.75 * Math.sqrt(heat) * 3);
      core.color.copy(col(s.alarm === 'uncovering' ? 'red' : s.alarm === 'boiling' ? 'amber' : 'orange'));
      core.position.copy(ex.barriers.pellet.group.position).add(new Vector3(0, 1, 0.3));
      ex.smoke.forEach((sm) => sm.setEmitting(dieselRun));
      ex.setTanks(s.accumulatorUntilS === null ? 1 : s.accumulatorUsed ? Math.max(0.08, (s.accumulatorUntilS - s.timeS) / 600) : 1);
    },
  };
};
