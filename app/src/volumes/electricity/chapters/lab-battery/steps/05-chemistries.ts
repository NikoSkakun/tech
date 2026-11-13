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
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { note, type Tone } from '../notes';
import { heroCell } from '../parts/cells';
import { CHEM_COLOR, createCrystal, type ChemId, type ExhibitId } from '../parts/crystals';
import { frame } from '../shots';
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
/**
 * The task cards of the document and the reason it gives for the right answers. `tab` is the caption on the
 * selector — short, so the five fit one row and the step column keeps its natural height (UI_API §3.1).
 */
const TASKS: readonly { id: TaskId; tab: string; label: string; why: string }[] = [
  { id: 'phone', tab: L.taskPhone, label: L.taskPhone, why: L.whyPhone },
  { id: 'home', tab: L.tabHome, label: L.taskHome, why: L.whyHome },
  { id: 'bus', tab: L.tabBus, label: L.taskBus, why: L.whyBus },
  { id: 'drone', tab: L.taskDrone, label: L.taskDrone, why: L.whyDrone },
  { id: 'polar', tab: L.tabPolar, label: L.taskPolar, why: L.whyPolar },
];
const VERDICT_TONE = { good: 'ok', ok: 'warning', bad: 'alarm' } as const satisfies Record<string, Tone>;
const ZERO = [0, 0, 0, 0, 0] as const;

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
        click: () => ui.set('chem5', id, { notify: true }),
      });
    ctx.qa.probe(`pedestal:${id}`, g);
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
  const hero = heroCell('white', '21700', 0.62);
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
  const sleeveAt = group('sleeve', 0, 0, 0, [sleeve]);
  sleeveAt.scale.setScalar(0.62);
  hero.group.add(sleeveAt);
  const heroAt = group('hero5', 0, 0, 0.2, [hero.group]);
  set.add(heroAt);

  /* ------------------------------------------------------------------------------ radar hologram */
  const radar = new RadarChart({
    size: 200,
    axes: [L.axisEnergy, L.axisPower, L.axisLife, L.axisSafety, L.axisPrice],
    series: [],
  });
  let onRadar: readonly ChemId[] = [];

  /* ----------------------------------------------------------------------------------- selection */
  const picked: ChemId[] = ['NMC', 'LFP']; // newest last; «Порівняти дві» shows both
  const verdict = { kind: 'good' as 'good' | 'ok' | 'bad', text: '' };
  const current = (): ChemId => picked[picked.length - 1]!;
  const shown = (): ChemId[] => (ui.value<boolean>('compare5') ? picked.slice(-2) : picked.slice(-1));
  const refresh = (instant = false): void => {
    const on = shown();
    for (const e of exhibits) {
      const to = { on: on.includes(e.id as ChemId) ? 1 : 0 };
      if (instant) Object.assign(e.state, to);
      else ctx.stage.scope.to(e.state, to, { duration: 0.35, ease: 'back.out', onUpdate: e.sync });
      e.sync();
    }
    // radar: a newly shown chemistry grows from the centre of the web, the others stay as they are
    const fresh = on.filter((id) => !onRadar.includes(id));
    radar.setSeries(
      on.map((id) => ({
        id,
        label: chemName(id),
        color: CHEM_COLOR[id],
        values: fresh.includes(id) ? ZERO : RADAR[id],
      })),
    );
    for (const id of fresh) radar.setValues(id, RADAR[id], { duration: instant ? 0 : 0.6 });
    onRadar = on;
    const c = K.toon({ color: CHEM_COLOR[current()] }).color; // resolve the token once
    ctx.stage.scope.to(sleeveMat.color, { r: c.r, g: c.g, b: c.b }, { duration: instant ? 0 : 0.5 });
    const task = TASKS.find((t) => t.id === ui.value<string>('task5'))!;
    const v = taskVerdict(task.id, current());
    const word = v === 'good' ? L.verdictGood : v === 'ok' ? L.verdictOk : L.verdictBad;
    verdict.kind = v;
    verdict.text = `${chemName(current())} → ${task.label}: ${word} (${task.why})`;
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
      [ID]: frame([0, 1.75, 0], 8.0, 4.5, {
        azimuth: 0.1,
        elevation: 0.3,
        orbit: { azimuth: 0.9, polar: 0.3 },
      }),
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
          items: CHEMS.map((id) => ({ id, label: chemName(id) })),
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
        note(
          'verdict5',
          () => verdict.text,
          () => VERDICT_TONE[verdict.kind],
        ),
      ],
      board: {
        size: 'md',
        children: [
          { type: 'custom', id: 'radar5', node: radar },
          {
            // the document's table, turned: one row per column, one column per chemistry on the radar
            type: 'table',
            id: 'facts5',
            rows: () =>
              CHEM_TABLE.headers.map((h, i) => [h, ...shown().map((id) => CHEM_TABLE.rows[id]![i]!)]),
          },
        ],
      },
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
        { anchor: () => top('LCO')().setY(v3.y - 0.75), content: 'cobalt' },
        { anchor: () => top('LFP')().setY(v3.y - 0.75), content: 'lmfp' },
      ],
    },
    probe: () => ({
      current: current(),
      shown: shown().join('+'),
      verdict: verdict.kind,
      radar: onRadar.join('+'),
    }),
    update(_dt, t) {
      exhibits.forEach((e, i) => (e.crystal.rotation.y = t * (0.25 + 0.5 * e.state.on) + i));
      heroAt.rotation.y = Math.sin(t * 0.4) * 0.25;
    },
  };
};
