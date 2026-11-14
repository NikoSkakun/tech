/**
 * Step 3 `chain-reaction` — «Ланцюгова реакція і k_eff». The sandbox (model M2): a glass cube of uranium nuclei,
 * water, absorber rods. Every 0,5 s one neutron generation flies: orange flashes are fissions, steel ones
 * absorption or leakage. The board shows k_eff on a 0…2 gauge (blue / green / amber zones), the state in
 * words, and N(g) on a log scale — the sandbox counts against the model line N₀·k^g. Controls: enrichment,
 * moderator, rods, zone size, «Запустити 1 нейтрон», «Скинути». It opens running at k ≈ 1,00.
 */
import { Vector3 } from 'three';
import type { CoreSize } from '@electricity/sim/plant-nuclear';
import { HOTSPOTS } from '../hotspots';
import { MICRO_POST, MICRO_TUNE } from '../looks';
import { buildSandbox } from '../parts/sandbox';
import { CAP, MAX_GENERATIONS, sandboxK, startRun, type SandboxParams, type SandboxRun } from '../sim-bindings/sandbox-run';
import { hot } from './hot';
import type { StepFactory } from './types';

const GEN_S = 0.5;
const ENRICH = [0.711, 3, 4.5, 20, 90] as const;
const ENRICH_ID = ['e07', 'e3', 'e45', 'e20', 'e90'] as const;

export const chainReaction: StepFactory = ({ ctx, ui, L, inner }) => {
  const set = inner.sets.sandbox;
  const box = buildSandbox(ctx);
  set.add(box.group);
  const params = (): SandboxParams => ({
    enrichment: ENRICH[ENRICH_ID.indexOf(ui.value<(typeof ENRICH_ID)[number]>('cr.e'))] ?? 4.5,
    moderator: ui.value<boolean>('cr.mod'),
    rods: ui.value<number>('cr.rods') / 100,
    size: ui.value<CoreSize>('cr.size'),
  });
  const k = (): number => sandboxK(params());
  let run: SandboxRun | null = null;
  let phaseT = 0;
  let seed = 1;
  const start = (n0: number): void => {
    const p = params();
    box.setSize(p.size);
    run = startRun(p, n0, box.members[p.size], (i) => box.near(i), (seed = (seed * 48271) % 2147483647));
    phaseT = 0;
  };
  const stop = (): void => {
    run = null;
    phaseT = 0;
  };
  for (const id of ['cr.e', 'cr.mod', 'cr.rods', 'cr.size']) ui.onChange(id, () => start(30));
  ctx.qa.expose('sandbox', () => ({ k: k(), g: run?.g ?? -1, n: run ? run.counts[run.g] : 0, running: !!run }));

  const pos = new Vector3();
  const end = new Vector3();
  const w = (v: Vector3): Vector3 => set.localToWorld(v.clone());
  const status = (): string => {
    const kv = k();
    return kv < 0.985 ? L.subcritical : kv <= 1.015 ? L.critical : L.supercritical;
  };
  const flightEnd = (i: number, out: Vector3): Vector3 => {
    const f = run!.flights[i]!;
    const from = box.centres[f.from]!;
    if (f.fate === 'fission') return out.copy(box.centres[f.to]!);
    const len = f.fate === 'leaked' ? box.half(params().size) * 2.2 : 4 + (i % 5);
    return out.set(...f.dir).multiplyScalar(len).add(from);
  };
  return {
    id: 'chain-reaction',
    stage: {
      camera: 'chain-reaction',
      envTune: MICRO_TUNE,
      post: MICRO_POST,
      enter: () => start(30),
      leave: () => stop(),
    },
    ui: {
      reset: true,
      honesty: [{ kind: 'simplified', text: L.sandboxChip }],
      controls: [
        { type: 'slider', id: 'cr.rods', label: L.rods, min: 0, max: 100, step: 1, unit: '%', value: 66 },
        { type: 'toggle', id: 'cr.mod', label: L.moderator, value: true },
        { type: 'segmented', id: 'cr.e', label: L.enrichment, items: ENRICH_ID.map((id) => ({ id, label: L[id] })), value: 'e45' },
        { type: 'segmented', id: 'cr.size', label: L.coreSize, items: [{ id: 'small', label: L.small }, { id: 'medium', label: L.medium }, { id: 'large', label: L.large }], value: 'large' },
        { type: 'button', id: 'cr.one', label: L.launch, icon: 'play', primary: true, onClick: () => start(1) },
        { type: 'button', id: 'cr.reset', label: L.reset, icon: 'resetView', onClick: stop },
      ],
      board: {
        title: L.kEff,
        size: 'md',
        children: [
          { type: 'gauge', id: 'cr.k', kind: 'linear', label: L.kEff, min: 0, max: 2, digits: 2, zones: [{ from: 0, to: 0.985, color: 'blue' }, { from: 0.985, to: 1.015, color: 'green' }, { from: 1.015, to: 2, color: 'amber' }], get: k },
          { type: 'readout', id: 'cr.state', label: L.state, text: status, color: () => (k() < 0.985 ? 'blue' : k() <= 1.015 ? 'green' : 'amber') },
          { type: 'note', id: 'cr.nomod', text: L.noModerator, icon: 'info', color: 'sky', visible: () => !ui.value<boolean>('cr.mod') && k() < 1 },
          { type: 'note', id: 'cr.weapon', text: L.weapons, icon: 'warning', color: 'red', visible: () => ui.value<string>('cr.e') === 'e90' },
          {
            type: 'chart',
            id: 'cr.n',
            chart: {
              height: 150,
              legend: true,
              x: { min: 0, max: MAX_GENERATIONS, label: L.generationAxis },
              y: { min: 1, max: 1e5, log: true, label: 'N' },
              series: [{ id: 'model', label: L.model, color: 'violet.light', dash: true }, { id: 'sim', label: L.sandbox, color: 'mist', kind: 'step' }],
            },
            update: (chart) => {
              const gs = Array.from({ length: MAX_GENERATIONS + 1 }, (_, g) => g);
              const n0 = run?.counts[0] ?? 1;
              chart.setData('model', gs, gs.map((g) => Math.min(2e5, n0 * k() ** g)));
              if (run) chart.setData('sim', gs.slice(0, run.g + 1), run.counts.slice(0, run.g + 1).map((c) => (c > 0 ? c : NaN)));
              else chart.clearData('sim');
            },
          },
          { type: 'stats', id: 'cr.now', columns: 2, items: [{ label: L.generationNow, get: () => (run ? run.g : 0) }, { label: L.neutronsNow, get: () => (run ? run.counts[run.g] ?? 0 : 0) }] },
        ],
      },
      callouts: [
        { anchor: () => w(new Vector3(0, box.half(params().size) * 0.6, 0)), text: L.density, side: 'up', visible: () => (run?.counts[run.g] ?? 0) > CAP, priority: 0 },
        { anchor: () => w(new Vector3(-box.half(params().size), box.half(params().size), box.half(params().size))), text: L.activeZone, side: 'left', priority: 1 },
      ],
      hotspots: [hot(() => w(new Vector3(box.half(params().size) + 3, box.half(params().size) - 2, 0)), HOTSPOTS['chain-reaction'].generation)],
    },
    update(dt) {
      box.setRods(ui.value<number>('cr.rods') / 100, params().size);
      const wet = ui.value<boolean>('cr.mod') ? 1 : 0;
      box.water.fade += Math.sign(wet - box.water.fade) * Math.min(Math.abs(wet - box.water.fade), dt * 2);
      const lines: { points: Vector3[] }[] = [];
      const n = run ? run.flights.length : 0;
      if (run) {
        phaseT += dt;
        if (phaseT >= GEN_S) {
          for (let i = 0; i < n; i++) box.flash(flightEnd(i, end), run.flights[i]!.fate === 'fission' ? 'fission' : 'loss');
          phaseT = 0;
          if (!run.next()) run = null;
        }
      }
      const u = Math.min(1, phaseT / GEN_S);
      for (let i = 0; i < CAP; i++) {
        if (!run || i >= run.flights.length) {
          box.neutrons.setPosition(i, 0, 0, 0, 0);
          continue;
        }
        const from = box.centres[run.flights[i]!.from]!;
        flightEnd(i, end);
        pos.copy(from).lerp(end, u);
        box.neutrons.setPosition(i, pos.x, pos.y, pos.z, 1);
        if (lines.length < 260) lines.push({ points: [from.clone().lerp(end, Math.max(0, u - 0.18)), pos.clone()] });
      }
      box.neutrons.commit();
      box.tails.setLines(lines);
      const count = run ? run.counts[run.g] ?? 0 : 0;
      box.density.fade = count > CAP ? Math.min(1, Math.log10(count / CAP) / 2 + 0.3) : 0;
    },
  };
};
