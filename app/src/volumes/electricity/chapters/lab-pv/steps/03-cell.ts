/**
 * Step 3 `cell` — the cut half-cell. Its layers slide apart with a slider and rebuild themselves when another
 * generation is chosen (tabs or the miniatures of the evolution strip); the texture microscope shows why a
 * pyramid gives light a second chance. Chips: typical module efficiency and cell V_oc of the generation.
 */
import { fmtNumber, fmtRange } from '@/content';
import type { StepFactory } from '../chapter';
import { cap, doc } from '../content';
import { CELL_TECHS, techById, type LayerSlot, type TechId } from '../data/cell-tech';
import { L } from '../labels';
import { createCellExtras } from '../parts/cell-extras';
import { createCellStack } from '../parts/cell-stack';
import { group } from '../world';

const ID = 'cell';
const SLOTS: readonly LayerSlot[] = ['grid', 'arc', 'front', 'base', 'back', 'rear'];

export const cell: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const stack = createCellStack();
  stack.group.position.set(0.1, 1.15, 0.2);
  stack.group.rotation.set(0.12, -0.5, 0);
  const extras = createCellExtras();
  const set = group('set:cell', 0, 0, 0, [stack.group, extras.group]);
  lab.stageRoot.add(set);

  const techId = (): TechId => ui.value<string>('tech3') as TechId;
  const tech = () => techById(techId());
  const explode = (): number => ui.value<number>('explode3') / 100;
  let applied: TechId | '' = '';
  let micro = false;
  for (const t of CELL_TECHS) {
    ctx.input.register(extras.tiles[t.id], {
      tooltip: `${L.tileTip}: ${t.tab}`,
      cursor: 'pointer',
      enabled: () => lab.isCurrent(ID),
      click: () => ui.set('tech3', t.id, { notify: true }),
    });
    ctx.qa.probe(`tile3-${t.id}`, extras.tiles[t.id]);
  }
  ctx.qa.expose('cell3', () => ({ tech: techId(), explode: explode(), micro, layers: SLOTS.filter((s) => stack.has(s)) }));

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.6, 4.4, 10.4], target: [0, 1.7, 0.6], frameAspect: 1.05, fov: 33, fit: { center: [0, 1.6, 0.5], radius: 3.9 }, orbit: { azimuth: 0.6, polar: 0.3 } },
      'cell-micro': { position: [-4.4, 2.7, 1.6], target: [-1.6, 0.95, -2.5], frameAspect: 1, fov: 30, fit: { center: [-1.55, 0.9, -2.5], radius: 1.6 } },
    },
    stage: {
      show: [set],
      enter() {
        applied = '';
        micro = false;
      },
    },
    ui: {
      hint: L.hint3,
      honesty: ['notToScale'],
      board: {
        title: L.board3,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'tech3-stats',
            columns: 2,
            items: [
              { label: cap(doc(ID, 2)), get: () => `${fmtRange(tech().efficiency[0], tech().efficiency[1])} %`, color: () => 'green' },
              { label: doc(ID, 3), get: () => `${fmtNumber(tech().vocV)} V`, color: () => 'sky' },
            ],
          },
          {
            type: 'table',
            id: 'tech3-table',
            rows: () => SLOTS.filter((s) => tech().layers[s]).map((s, i) => [`${i + 1}`, L[tech().layers[s]!.name]]),
            align: ['left', 'left'],
          },
        ],
      },
      controls: [
        { type: 'segmented', id: 'tech3', label: doc(ID, 1), items: CELL_TECHS.map((t) => ({ id: t.id, label: t.tab })), value: 'perc' },
        { type: 'slider', id: 'explode3', label: cap(doc(ID, 0)), min: 0, max: 100, step: 1, value: 55, unit: '%' },
        {
          type: 'button',
          id: 'micro3',
          label: doc(ID, 4),
          icon: 'search',
          onClick: () => {
            micro = !micro;
            void ctx.camera.go(micro ? 'cell-micro' : ID, { duration: 1.6 });
          },
        },
      ],
      callouts: [
        ...SLOTS.map((s) => ({
          anchor: stack.anchors[s],
          text: () => (tech().layers[s] ? L[tech().layers[s]!.name] : ''),
          side: 'right' as const,
          visible: () => !micro && explode() > 0.3 && stack.has(s),
        })),
        { anchor: extras.sisters.thinFilm, text: L.thinFilm, side: 'up', visible: () => !micro },
        { anchor: extras.sisters.tandem, text: L.tandem, side: 'up', visible: () => !micro },
        { anchor: extras.microscope, text: L.microscope, side: 'up', color: 'yellow', visible: () => micro },
      ],
      hotspots: [
        { anchor: stack.anchors.grid, content: 'silver-fingers', visible: () => !micro && stack.has('grid') },
        { anchor: () => stack.group.localToWorld(stack.anchors.base.position.clone().setX(-1.8)), content: 'mono-vs-poly', visible: () => !micro },
        { anchor: () => stack.group.localToWorld(stack.anchors.rear.position.clone().setX(-1.8)), content: 'bifacial', visible: () => !micro },
      ],
    },
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      if (techId() !== applied) stack.setTech(techById((applied = techId())));
      stack.setExplode(explode());
      stack.update(dt);
      stack.group.position.y = 1.15 + Math.sin(t * 0.8) * 0.04;
      stack.group.rotation.y = -0.5 + Math.sin(t * 0.35) * 0.06;
      extras.update(techId(), t, micro);
    },
  };
};
