/**
 * Step 2 `fission` — «Поділ ядра: 200 MeV з одного атома». Inner space: the trembling U-235 drop, a slow
 * neutron on a cyan «рогатка» (drag it back and let go — or «Пустити нейтрон» in the dock), model M1 decides
 * fission or ricochet by the neutron energy. The board counts the released energy up to ≈ 200 MeV and splits
 * it into its parts; the mass scales show the lighter products and Δm·c²; «Порівняти з горінням» brings in
 * C + O₂ → CO₂ and its 4 eV.
 */
import { Vector3 } from 'three';
import { FISSION_ENERGY_MEV, FISSION_PROBABILITY, type NeutronEnergy } from '@electricity/sim/plant-nuclear';
import { HOTSPOTS } from '../hotspots';
import { MICRO_POST, MICRO_TUNE } from '../looks';
import { buildBalance, buildLattice, buildMolecule, buildU238, panLoads } from '../parts/fission-props';
import { buildFissionRig } from '../parts/fission-rig';
import { createLabel } from '../parts/label';
import { hot, probe } from './hot';
import type { StepFactory } from './types';

const PARTS = ['fragments', 'promptNeutrons', 'promptGamma', 'beta', 'decayGamma', 'antineutrinos'] as const;

export const fission: StepFactory = ({ ctx, ui, L, inner }) => {
  const set = inner.sets.fission;
  const rig = buildFissionRig(ctx);
  set.add(rig.group);
  set.add(buildLattice());
  const u238 = buildU238();
  u238.group.position.set(17, 7, -22);
  u238.pose({ wobble: 0.1, stretch: 0, heavy: new Vector3(), light: new Vector3(), split: 0 }, 0);
  set.add(u238.group);
  const balance = buildBalance();
  balance.group.position.set(5, -13, 9);
  balance.group.scale.setScalar(0.62);
  const loads = panLoads();
  balance.part('panL').add(loads.before);
  balance.part('panR').add(loads.after);
  loads.before.position.y = -2.9;
  loads.after.position.y = -2.9;
  set.add(balance.group);
  const dm = createLabel(L.massDefect, 'violet.light', 20);
  dm.position.set(5, -4.6, 9);
  set.add(dm);
  const mol = buildMolecule();
  mol.group.position.set(-15, -11, 6);
  set.add(mol.group);
  const ev = createLabel(L.fourEv, 'mist', 18);
  ev.position.set(-13, -8.6, 6);
  set.add(ev);

  const aMol = ctx.stage.actor(mol.group, { appear: 'pop' });
  const aEv = ctx.stage.actor(ev, { appear: 'fade' });
  const active = (): boolean => ctx.stage.current === 'fission';
  const w = (v: Vector3): Vector3 => set.localToWorld(v.clone());
  const plane = new Vector3(0, 0, 1);
  ctx.input.register(rig.handle, {
    cursor: 'grab',
    tooltip: L.slingshot,
    enabled: active,
    drag: (e) => {
      const p = e.planePoint(plane, w(rig.at.neutron));
      if (p) rig.aim(set.worldToLocal(p.clone()));
    },
    dragEnd: () => rig.fire(),
    click: () => rig.fire(),
  });
  probe('fission.handle', () => w(rig.at.neutron));
  ctx.qa.expose('fission', () => ({ phase: rig.phase, energy: rig.energy, released: rig.released, ...rig.count }));

  let burnT = 0;
  let evShown = false;
  let last = { ...rig.count };
  const energy = (): NeutronEnergy => ui.value<NeutronEnergy>('fi.energy');
  const compare = (): boolean => ui.value<boolean>('fi.burn');
  const total = 200;
  return {
    id: 'fission',
    stage: {
      camera: 'fission',
      envTune: MICRO_TUNE,
      post: MICRO_POST,
      enter: () => {
        rig.count.fission = rig.count.scatter = rig.count.miss = 0;
        last = { ...rig.count };
        rig.reset();
        burnT = 0;
        evShown = false;
      },
    },
    ui: {
      honesty: ['notToScale', { slowed: 1e12, text: L.slowedFission }],
      controls: [
        { type: 'segmented', id: 'fi.energy', label: L.neutronEnergy, items: [{ id: 'thermal', label: L.thermal }, { id: 'kev', label: L.kev }, { id: 'fast', label: L.fast }], value: 'thermal' },
        { type: 'button', id: 'fi.fire', label: L.fire, icon: 'play', primary: true, onClick: () => rig.fire() },
        { type: 'toggle', id: 'fi.burn', label: L.compareBurn, value: false, onChange: (on) => ctx.stage.toggle(aMol, on) },
        { type: 'readout', id: 'fi.p', label: L.probability, unit: '%', digits: 0, get: () => FISSION_PROBABILITY[energy()] * 100 },
      ],
      board: {
        title: L.split,
        size: 'md',
        children: [
          {
            type: 'stats',
            id: 'fi.stats',
            columns: 2,
            items: [
              { label: L.released, get: () => `${rig.released > 0.995 ? '≈ ' : ''}${Math.round(total * rig.released)} ${L.mev}` },
              { label: L.burn, get: () => (compare() ? L.fourEv : '—') },
            ],
          },
          {
            type: 'chart',
            id: 'fi.parts',
            chart: {
              height: 150,
              x: { min: 0.4, max: 6.6, ticks: [1, 2, 3, 4, 5, 6], format: (v) => [L.partFragments, 'n', 'γ', 'β', L.partDecayGamma, 'ν̄'][Math.round(v) - 1] ?? '' },
              y: { min: 1, max: 300, log: true, label: 'E, MeV' },
              legend: true,
              series: [{ id: 'heat', label: L.heatInFuel, color: 'orange', kind: 'bars' }, { id: 'lost', label: L.lost, color: 'steel', kind: 'bars' }],
            },
            update: (chart) => {
              const k = Math.max(0.006, rig.released);
              chart.setData('heat', [1, 2, 3, 4, 5], PARTS.slice(0, 5).map((p) => Math.max(1, FISSION_ENERGY_MEV[p] * k)));
              chart.setData('lost', [6], [Math.max(1, FISSION_ENERGY_MEV.antineutrinos * k)]);
            },
          },
          { type: 'readout', id: 'fi.ratio', label: L.ratio, text: () => L.ratioValue, visible: compare },
        ],
      },
      callouts: [
        { anchor: () => w(rig.at.nucleus).add(new Vector3(0, 4.2, 0)), text: () => (rig.phase === 'excited' ? L.u236 : L.u235), side: 'up', visible: () => rig.phase !== 'split', priority: 0 },
        { anchor: () => w(rig.at.heavy), text: L.ba, side: 'down', visible: () => rig.phase === 'split', priority: 0 },
        { anchor: () => w(rig.at.light), text: L.kr, side: 'down', visible: () => rig.phase === 'split', priority: 1 },
        { anchor: () => w(rig.at.neutron), text: L.slingshot, side: 'up', visible: () => rig.phase === 'ready', priority: 1 },
        { anchor: () => w(new Vector3(17, 11, -22)), text: L.u238, side: 'right', priority: 3 },
      ],
      hotspots: [hot(() => w(new Vector3(12, 3, -22)), HOTSPOTS.fission.u238), hot(() => w(new Vector3(-10, 11, -4)), HOTSPOTS.fission.antineutrino)],
    },
    update(dt, t) {
      rig.energy = energy();
      rig.update(dt, t);
      u238.group.rotation.y = t * 0.1;
      // results as short notices
      if (rig.count.fission > last.fission) ui.toast(L.resFission, { tone: 'ok' });
      else if (rig.count.scatter > last.scatter) ui.toast(L.resScatter, { tone: 'info' });
      else if (rig.count.miss > last.miss) ui.toast(L.resMiss, { tone: 'warning' });
      last = { ...rig.count };
      // balance: the left pan (U-235 + n) is a little heavier; after a fission the difference glows as Δm·c²
      const beam = balance.part('beam');
      beam.rotation.z = 0.09 + 0.012 * Math.sin(t * 1.3);
      balance.part('panL').rotation.z = -beam.rotation.z;
      balance.part('panR').rotation.z = -beam.rotation.z;
      dm.opacity = 0.35 + 0.65 * rig.released;
      burnT = compare() ? Math.min(1, burnT + dt / 1.6) : 0;
      mol.set(burnT);
      if (burnT > 0.95 !== evShown) ctx.stage.toggle(aEv, (evShown = burnT > 0.95));
    },
  };
};
