/**
 * Step 5 `chemistries` — the showcase: seven chemistries (and a solid-state slice) on pedestals, a holographic
 * radar of the chosen one or two, the fact table from the document and the game «Вибери хімію для задачі».
 */
import { CylinderGeometry, Mesh, TorusGeometry, Vector3, type Group } from 'three';
import { audio } from '@/audio';
import { createLightShaft } from '@/fx';
import { K, MOTION } from '@/style';
import { RadarChart } from '@/ui3d';
import { CHEMS, CHEM_TABLE, RADAR, chemName, taskVerdict, type TaskId } from '../chem-data';
import { factTable, notices } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { CHEM_COLOR, createCrystal, createHeroCell, type ChemId, type ExhibitId } from '../parts';
import { group, mesh } from '../world';

const ID = 'chemistries';
/** Pedestal positions: six commercial chemistries on the back arc, the newcomers in front under spotlights. */
const SPOTS: Record<ExhibitId, readonly [number, number]> = {
  LCO: [-3.15, -0.5],
  NMC: [-1.95, -1.35],
  NCA: [-0.65, -1.8],
  LFP: [0.65, -1.8],
  LMO: [1.95, -1.35],
  LTO: [3.15, -0.5],
  'Na-ion': [-1.3, 1.75],
  solid: [1.3, 1.75],
};
/** `tab` is the short caption on the segmented control; the verdict spells the task out. */
const TASKS: readonly { id: TaskId; tab: string; label: string; why: string }[] = [
  { id: 'phone', tab: L.taskPhone, label: L.taskPhone, why: L.whyPhone },
  { id: 'home', tab: L.tabHome, label: L.taskHome, why: L.whyHome },
  { id: 'bus', tab: L.tabBus, label: L.taskBus, why: L.whyBus },
  { id: 'drone', tab: L.taskDrone, label: L.taskDrone, why: L.whyDrone },
  { id: 'polar', tab: L.tabPolar, label: L.taskPolar, why: L.whyPolar },
];

export const chemistries: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const set = group(`set:${ID}`);
  lab.stageRoot.add(set);
  const plinth = new CylinderGeometry(0.62, 0.7, 0.55, 40);
  const exhibits = (Object.keys(SPOTS) as ExhibitId[]).map((id) => {
    const [x, z] = SPOTS[id];
    const g = group(`exhibit:${id}`, x, 0, z);
    const ringMat = K.glow({
      color: id === 'solid' ? 'mist' : CHEM_COLOR[id],
      intensity: 0.5,
      keepHue: true,
      whiten: 0,
      falloff: 0,
    });
    const ring = new Mesh(new TorusGeometry(0.66, 0.03, 8, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.56;
    const crystal = createCrystal(id);
    crystal.position.y = 0.62;
    g.add(mesh(plinth, mats.plinth, 0, 0.275, 0), ring, crystal);
    set.add(g);
    const state = { hover: 0, on: 0 };
    const sync = (): void => {
      ringMat.intensity = 0.5 + 0.6 * state.hover + 1.3 * state.on;
      crystal.position.y = 0.62 + 0.14 * state.on;
      crystal.scale.setScalar(1 + 0.08 * state.hover + 0.12 * state.on);
    };
    if (id !== 'solid')
      ctx.input.register(g, {
        tooltip: chemName(id),
        cursor: 'pointer',
        hover: (over) =>
          ctx.tweens.to(state, { hover: over ? 1 : 0 }, { duration: MOTION.hover.duration, onUpdate: sync }),
        click: () => ui.drive('chem5', id),
      });
    return { id, g, crystal, state, sync };
  });
  // the newcomers stand «у світлі прожектора майбутнього»
  for (const id of ['Na-ion', 'solid'] as const) {
    const shaft = createLightShaft({
      length: 3.6,
      radiusTop: 0.15,
      radiusBottom: 0.95,
      color: 'white',
      intensity: 0.55,
    });
    shaft.position.set(0, 4.1, 0);
    exhibits.find((e) => e.id === id)!.g.add(shaft);
  }
  // hero cell in the middle: its sleeve takes the colour of the chosen chemistry
  const hero = createHeroCell('white');
  hero.group.scale.setScalar(0.62);
  hero.group.rotation.y = 0.5;
  const sleeveMat = K.toon({ color: 'teal', gloss: 0.5 });
  const sleeve = mesh(
    new CylinderGeometry(0.368, 0.368, 0.9, 48, 1, true, 3.25, 4.55),
    sleeveMat,
    0,
    1.25,
    0,
    false,
  );
  hero.group.add(sleeve);
  const heroAt = group('hero5', 0, 0, 0.2, [hero.group]);
  set.add(heroAt);

  /* ------------------------------------------------------------------------------ radar hologram */
  const radar = new RadarChart({
    size: 196,
    axes: [L.axisEnergy, L.axisPower, L.axisLife, L.axisSafety, L.axisPrice],
    series: CHEMS.map((id) => ({ id, label: chemName(id), color: CHEM_COLOR[id], values: [0, 0, 0, 0, 0] })),
  });
  const shownAmount = Object.fromEntries(CHEMS.map((id) => [id, 0])) as Record<ChemId, number>;

  /* ----------------------------------------------------------------------------------- selection */
  const picked: ChemId[] = ['NMC', 'LFP']; // newest last; «Порівняти дві» shows both
  const table = factTable('facts5', CHEM_TABLE.headers.slice(1));
  lab.holo.add(ID, { width: 372, children: [radar, table.spec.node] });
  const verdict = notices('verdict5', {
    good: { text: L.verdictGood, tone: 'ok' },
    ok: { text: L.verdictOk, tone: 'warning' },
    bad: { text: L.verdictBad, tone: 'alarm' },
  });
  const current = (): ChemId => picked[picked.length - 1]!;
  const shown = (): ChemId[] => (ui.value<boolean>('compare5') ? picked.slice(-2) : picked.slice(-1));
  const refresh = (instant = false): void => {
    const on = shown();
    for (const e of exhibits) {
      const to = { on: on.includes(e.id as ChemId) ? 1 : 0 };
      if (instant) Object.assign(e.state, to);
      else ctx.tweens.to(e.state, to, { duration: 0.35, ease: 'back.out', onUpdate: e.sync });
      e.sync();
    }
    CHEM_TABLE.rows[current()]!.slice(1).forEach((cell, i) => table.set(i, cell));
    const c = K.toon({ color: CHEM_COLOR[current()] }).color; // resolve the token once
    ctx.tweens.to(sleeveMat.color, { r: c.r, g: c.g, b: c.b }, { duration: instant ? 0 : 0.5 });
    const task = TASKS.find((t) => t.id === ui.value<string>('task5'))!;
    const v = taskVerdict(task.id, current());
    const word = v === 'good' ? L.verdictGood : v === 'ok' ? L.verdictOk : L.verdictBad;
    verdict.setText(v, `${chemName(current())} → ${task.label}: ${word} (${task.why})`);
    verdict.only(v);
  };
  ui.onChange('chem5', (id) => {
    if (current() !== id) {
      picked.push(id as ChemId);
      picked.shift();
    }
    audio.play('tick', { pitch: 1.15 });
    refresh();
  });
  ui.onChange('compare5', () => refresh());
  ui.onChange('task5', () => refresh());
  const v3 = new Vector3();
  const top = (id: ExhibitId) => (): Vector3 => {
    const e = exhibits.find((x) => x.id === id)!;
    return e.g.getWorldPosition(v3).setY(v3.y + 1.75);
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [-0.6, 5.5, 12.9],
        target: [-1.75, 2.5, -0.2],
        fov: 28,
        orbit: { azimuth: 0.9, polar: 0.3 },
      },
    },
    stage: {
      show: [...exhibits.map((e) => e.g as Group), heroAt],
      enter: () => refresh(true),
    },
    ui: {
      hint: L.hint5,
      honesty: ['illustrative', 'notToScale'],
      controls: [
        {
          type: 'segmented',
          id: 'chem5',
          items: CHEMS.map((id) => ({ id, label: id === 'Na-ion' ? L.naTab : chemName(id) })),
          value: 'LFP',
        },
        { type: 'toggle', id: 'compare5', label: L.compareTwo, value: false },
        {
          type: 'segmented',
          id: 'task5',
          label: L.pickForTask,
          items: TASKS.map((t) => ({ id: t.id, label: t.tab })),
          value: 'home',
        },
        verdict.spec,
      ],
      callouts: [
        ...CHEMS.filter((id) => id !== 'Na-ion').map((id) => ({
          anchor: top(id),
          text: id,
          color: CHEM_COLOR[id],
          side: 'up' as const,
        })),
        { anchor: top('Na-ion'), text: L.naIon, color: 'orange', side: 'up' },
        { anchor: top('solid'), text: L.solidState, side: 'up' },
      ],
      hotspots: [
        { anchor: () => top('LCO')().setY(v3.y - 0.75), title: 'Cobalt — кобальт' },
        { anchor: () => top('LFP')().setY(v3.y - 0.75), title: 'LMFP — LiMnₓFe₁₋ₓPO₄' },
      ],
    },
    probe: () => ({
      current: current(),
      shown: shown().join('+'),
      verdict: (['good', 'ok', 'bad'] as const).find((k) => verdict.isShown(k)),
      pedestalLTO: top('LTO')()
        .clone()
        .setY(v3.y - 1.2)
        .toArray(),
    }),
    update(dt, t) {
      const on = shown();
      for (const id of CHEMS) {
        const target = on.includes(id) ? 1 : 0;
        const before = shownAmount[id];
        if (before === target) continue;
        // polygons grow from / shrink to the centre of the web
        const next =
          Math.abs(target - before) < 0.01 ? target : before + (target - before) * Math.min(1, dt * 7);
        shownAmount[id] = next;
        radar.setValues(
          id,
          RADAR[id].map((x) => x * next),
        );
      }
      exhibits.forEach((e, i) => (e.crystal.rotation.y = t * (0.25 + 0.5 * e.state.on) + i));
      heroAt.rotation.y = Math.sin(t * 0.4) * 0.25;
    },
  };
};
