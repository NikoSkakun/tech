/**
 * Step 4 `module` — from cell to module. The layered hero module assembles itself on entry (glass › film ›
 * cells with ribbons › film › backsheet › frame › junction boxes) and can be taken apart again, turned by
 * dragging and flipped to its back; the electron snake runs through the three diode sections. In front of it
 * six toy cells show what series and parallel connections do to volts and amperes.
 */
import { Group, Mesh, PlaneGeometry, Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { damp } from '@/engine/api';
import { LM440, LM440_MODEL_MPP, MODULE_SIZE_MM, cellAssembly } from '@electricity/sim/lab-pv';
import { K } from '@/style';
import type { StepFactory } from '../chapter';
import { doc } from '../content';
import { L, fill } from '../labels';
import { BRICK_LAYOUTS, createBrickBoard, type BrickLayout } from '../parts/brick-board';
import { createLiveModule } from '../parts/lm440-live';
import { M, diodeSpot } from '../parts/lm440-layout';
import { createBenchModel } from '../sim-bindings/bench-model';
import { MODULE_SCALE, group } from '../world';

const ID = 'module';
const AREA_M2 = (MODULE_SIZE_MM.width * MODULE_SIZE_MM.height) / 1e6;

export const moduleStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const module = createLiveModule(ctx);
  const model = createBenchModel();
  const sample = model.sample({ g: 1000, tc: 25, shade: null, bypass: true, modules: 1, load: { kind: 'mpp' } });
  module.group.scale.setScalar(MODULE_SCALE);
  const tilt = new Group();
  tilt.rotation.x = 0.95;
  tilt.add(module.group);
  const turn = group('module-turntable', -0.5, 2.55, -0.5, [tilt]);
  // generous drag proxy around the laminate (both faces)
  const grip = new Mesh(new PlaneGeometry(M.W, M.L).rotateX(-Math.PI / 2), K.flat('cyan'));
  grip.material.colorWrite = false;
  grip.material.depthWrite = false;
  grip.material.side = 2;
  module.group.add(grip);
  const board = createBrickBoard();
  board.group.position.set(0.8, 0, 2.35);
  board.group.scale.setScalar(0.74);
  board.group.rotation.set(0.1, -0.2, 0);
  const set = group('set:module', 0, 0, 0, [turn, board.group]);
  lab.stageRoot.add(set);

  const build = ctx.stage.param('build4', 0, { duration: 3.4, ease: 'power2.inOut' });
  let yaw = 0;
  let yawTarget = 0;
  let backApplied = false;
  let layoutApplied: BrickLayout | '' = '';
  const exploded = (): number => Math.max(build.value, ui.value<number>('explode4') / 100);
  const layout = (): BrickLayout => ui.value<string>('bricks4') as BrickLayout;
  const assembly = (): ReturnType<typeof cellAssembly> => cellAssembly(BRICK_LAYOUTS[layout()].series, BRICK_LAYOUTS[layout()].parallel);
  const sectionsOn = (): boolean => ui.value<boolean>('sections4');
  ctx.input.register(grip, {
    tooltip: L.rotateTip,
    cursor: 'grab',
    enabled: () => lab.isCurrent(ID),
    drag: (e) => (yawTarget = Math.min(Math.PI, Math.max(-Math.PI, yawTarget + e.dx * 0.01))),
  });
  const v = new Vector3();
  const edge = (layer: keyof typeof module.layers, z: number) => (): Vector3 => module.layers[layer].localToWorld(v.set(M.W / 2 - 0.05, 0, z));
  const apart = (): boolean => exploded() > 0.35;
  ctx.qa.probe('module4', grip);
  ctx.qa.expose('module4', () => ({ yaw, explode: exploded(), sections: module.sections.visible, bricks: assembly(), layout: layout() }));

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.9, 4.6, 9.8], target: [-0.1, 2.3, 0.6], frameAspect: 0.85, fov: 34, fit: { center: [-0.1, 2.3, 0.6], radius: 3.5 }, orbit: { azimuth: 0.5, polar: 0.25 } },
      'module-back': { position: [0.2, 3.2, 6.4], target: [-0.5, 2.5, -0.5], frameAspect: 1, fov: 30, fit: { center: [-0.5, 2.5, -0.5], radius: 2.2 } },
    },
    stage: {
      show: [set],
      enter(info) {
        yaw = yawTarget = 0;
        backApplied = false;
        layoutApplied = '';
        // the assembly "conveyor": start apart and close the sandwich (skipped for deep links)
        if (!info.instant) {
          ctx.stage.setParam('build4', 1, { instant: true });
          ctx.stage.setParam('build4', 0, { duration: 3.4, ease: 'power2.inOut' });
        }
      },
    },
    ui: {
      hint: L.hint4,
      board: {
        title: L.board4,
        size: 'sm',
        children: [
          {
            type: 'table',
            id: 'label4',
            rows: [
              [L.pStc, `${fmtNumber(LM440_MODEL_MPP.pmpW)} W`],
              ['V_oc', `${fmtNumber(LM440.vocV)} V`],
              ['I_sc', `${fmtNumber(LM440.iscA)} A`],
              ['V_mp', `${fmtNumber(LM440_MODEL_MPP.vmpV)} V`],
              ['I_mp', `${fmtNumber(LM440_MODEL_MPP.impA)} A`],
              [L.area, `${fmtNumber(Math.round(AREA_M2 * 100) / 100)} m²`],
              [L.efficiency, `${fmtNumber(Math.round((LM440_MODEL_MPP.pmpW / (1000 * AREA_M2)) * 1000) / 10)} %`],
            ],
          },
          {
            type: 'stats',
            id: 'bricks4-stats',
            items: [
              { label: L.voltage, get: () => assembly().voltageV, unit: 'V', digits: 1, color: () => 'sky' },
              { label: L.current, get: () => assembly().currentA, unit: 'A', digits: 0, color: () => 'cyan' },
              { label: L.power, get: () => assembly().powerW, unit: 'W', digits: 1, color: () => 'yellow' },
            ],
          },
          { type: 'note', id: 'bricks4-note', icon: 'info', text: L.bricksNote },
        ],
      },
      controls: [
        { type: 'segmented', id: 'bricks4', label: doc(ID, 0), items: [{ id: 's6', label: L.layoutS6 }, { id: 's3p2', label: L.layoutS3P2 }, { id: 'p6', label: L.layoutP6 }], value: 's6' },
        { type: 'slider', id: 'explode4', label: L.explode, min: 0, max: 100, step: 1, value: 0, unit: '%' },
        { type: 'toggle', id: 'sections4', label: doc(ID, 2), value: false },
        { type: 'toggle', id: 'back4', label: L.backSide, value: false },
      ],
      callouts: [
        { anchor: edge('glass', -0.6), text: L.layerGlass, side: 'right', visible: apart },
        { anchor: edge('eva1', -0.3), text: L.layerFilm, side: 'right', visible: apart },
        { anchor: edge('cells', 0), text: L.layerCells, side: 'right', color: 'sky', visible: apart },
        { anchor: edge('back', 0.3), text: L.layerBack, side: 'right', visible: apart },
        { anchor: edge('frame', 0.6), text: L.layerFrame, side: 'right', visible: apart },
        { anchor: module.anchors.jbox, text: L.layerJbox, side: 'down', color: 'amber', visible: () => apart() || ui.value<boolean>('back4') },
        ...[0, 1, 2].map((s) => ({ anchor: (): Vector3 => module.group.localToWorld(diodeSpot(s, v).setZ(-0.55)), text: fill(L.sectionCallout, { n: s + 1 }), side: 'up' as const, visible: () => sectionsOn() && !apart() && s === 1 })),
      ],
      hotspots: [
        { anchor: module.anchors.label, content: 'label', visible: () => ui.value<boolean>('back4') },
        { anchor: module.anchors.frame, content: 'frame' },
        { anchor: module.anchors.plus, content: 'mc4' },
      ],
    },
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      const back = ui.value<boolean>('back4');
      if (back !== backApplied) {
        backApplied = back;
        yawTarget = back ? Math.PI : 0;
        void ctx.camera.go(back ? 'module-back' : ID, { duration: 1.5 });
      }
      if (layout() !== layoutApplied) board.setLayout((layoutApplied = layout()));
      yaw = damp(yaw, yawTarget, 5, dt);
      // an opened sandwich turns sideways by itself so the layers fan out across the view
      turn.rotation.y = yaw + 0.3 - 1.3 * exploded() + Math.sin(t * 0.4) * 0.05;
      tilt.rotation.x = 0.95 + 0.35 * exploded();
      turn.position.y = 2.6 + Math.sin(t * 0.9) * 0.03;
      module.setExplode(exploded());
      module.sections.visible = module.diodes.group.visible = sectionsOn();
      module.apply(sample, t, { tint: sectionsOn() ? 0.55 : 0, electrons: exploded() > 0.6 ? 0 : 1 });
      board.update(dt, t);
    },
  };
};
