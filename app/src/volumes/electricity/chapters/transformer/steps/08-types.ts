/**
 * Step 8 `types` — the gallery: a turntable with six pedestals; the chosen exhibit turns to the front (segmented
 * control, arrows, or drag the turntable and let it snap), each drawn to fit its pedestal («не в масштабі») with a
 * capsule person at the exhibit's own scale. «Масштаб» lines all of them up at one true scale, largest to smallest,
 * with the person. Demos: the current transformer (bus current → 1 A ammeter; opening the secondary → danger, arc),
 * and the charger's transformer (frequency → core volume for 50 W, steel → ferrite above 1 kHz).
 * Models: `currentTransformer`, `smpsCoreVolume`.
 */
import { Vector3 } from 'three';
import { fmtSI, fmtUnit } from '@/content';
import { createArc } from '@/fx';
import { people } from '@/kit';
import { STATUS } from '@/ui3d';
import { CURRENT_TRANSFORMER, SMPS, currentTransformer, smpsCoreVolume } from '@electricity/sim/transformer';
import type { StepFactory } from '../chapter';
import { doc, hot } from '../labels';
import { OWN, OWN_LISTS } from '../labels-own';
import { EXHIBITS, createGallery, type ExhibitId } from '../parts/gallery';
import { createTurntable } from '../parts/turntable';
import { group } from '../world';

const ID = 'types';
const R = 4.4;
/** Largest dimension of the exhibit in front, world units (its neighbours get 45 %). */
const FIT = 2.75;
/** True-scale row: world units per metre. */
const TRUE_S = 0.21;
const STEP_A = (Math.PI * 2) / EXHIBITS.length;

export const types: StepFactory = (tx) => {
  const { ui, ctx } = tx;
  const gal = createGallery();
  const table = createTurntable(ctx, R, EXHIBITS.length);
  const holders = gal.list.map((e) => group(`exhibit:${e.id}`, 0, 0, 0, [e.group]));
  const person = people([{ at: [0, 0, 0], action: 'idle', color: 'coral' }], ctx.random.fork('person'));
  const personHolder = group('person', 0, 0, 0, [person.group]);
  const arc = createArc({ from: [-0.1, 1.08, 0.34], to: [0.1, 1.08, 0.34], color: 'violet', branches: 1, width: 0.03 });
  arc.power = 0;
  gal.ct.group.add(arc);
  const set = group(`set:${ID}`, 0, 0, 0, [table.group, ...holders, personHolder]);
  tx.stageRoot.add(set);

  const ex = (): ExhibitId => ui.value<string>('ex8') as ExhibitId;
  const idx = (): number => EXHIBITS.indexOf(ex());
  const row = (): boolean => ui.value<boolean>('scale8');
  const bus = (): number => ui.value<number>('bus8');
  const open = (): boolean => ui.value<boolean>('open8');
  const f = (): number => ui.value<number>('f8');
  const ctr = (): ReturnType<typeof currentTransformer> => currentTransformer(bus(), open());
  const core = (): ReturnType<typeof smpsCoreVolume> => smpsCoreVolume(f());
  let angle = 0;
  let drag = 0;
  let dragging = false;
  let m = 0;
  const focus = EXHIBITS.map(() => 0);
  // true-scale row: largest (left) to smallest (right), 1 m gaps
  const rowX: number[] = [];
  {
    const total = gal.list.reduce((s, e) => s + e.size * TRUE_S + 0.35, 0);
    let x = -total / 2 + 0.6;
    for (const e of gal.list) {
      rowX.push(x + (e.size * TRUE_S) / 2);
      x += e.size * TRUE_S + 0.35;
    }
  }
  const go = (d: number): void => {
    const i = (idx() + d + EXHIBITS.length) % EXHIBITS.length;
    ui.set('ex8', EXHIBITS[i]!, { notify: true });
  };
  ctx.input.register(table.proxy, {
    tooltip: OWN.spin8,
    cursor: 'grab',
    dragStart: () => (dragging = true),
    drag: (e) => (drag += e.dx * 0.008),
    dragEnd: () => {
      dragging = false;
      const steps = Math.round(-(angle + drag) / STEP_A);
      drag = 0;
      const i = ((steps % EXHIBITS.length) + EXHIBITS.length) % EXHIBITS.length;
      ui.set('ex8', EXHIBITS[i]!, { notify: true });
    },
    enabled: () => tx.isCurrent(ID) && !row(),
  });
  // QA: two points on the turntable rim in front, for a drag that spins it
  ctx.qa.probe('turntable-a', () => tx.stageRoot.localToWorld(new Vector3(-2.2, 0.3, R + 0.6)));
  ctx.qa.probe('turntable-b', () => tx.stageRoot.localToWorld(new Vector3(1.4, 0.3, R + 0.6)));
  const holderAt = (id: ExhibitId, h: number): (() => Vector3) => {
    const out = new Vector3();
    return () => holders[EXHIBITS.indexOf(id)]!.localToWorld(out.set(0, h, 0));
  };
  const front = (id: ExhibitId): boolean => !row() && ex() === id;
  const names = OWN_LISTS.exhibits8;
  const facts = OWN_LISTS.facts8;

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0, 2.8, R + 5.7],
        target: [0, 1.3, R - 0.3],
        fov: 32,
        frameAspect: 1.4,
        orbit: { azimuth: 0.7, polar: 0.3 },
        fit: { center: [0, 1.3, R - 0.3], radius: 2.8 },
      },
      'types-row': {
        // aimed right of the row's centre: the panel covers the right of the frame, and the two smallest exhibits
        // (and their labels) sit at the right end of the row
        position: [0.9, 2.7, 9.8],
        target: [0.9, 0.9, 0.6],
        fov: 32,
        frameAspect: 1.8,
        fit: { center: [0.2, 0.9, 0.6], radius: 4.9 },
      },
    },
    stage: {
      show: [set],
      enter: (info) => {
        angle = -idx() * STEP_A;
        m = row() ? 1 : 0;
        focus.forEach((_, i) => (focus[i] = i === idx() ? 1 : 0));
        if (row() && !info.instant) ctx.camera.go('types-row');
      },
    },
    ui: {
      hint: OWN.hint8,
      honesty: [{ kind: 'notToScale', visible: () => !row() }, { kind: 'simplified', text: doc(ID, 5), visible: () => ex() === 'smps' }],
      controls: [
        { type: 'segmented', id: 'ex8', items: EXHIBITS.map((id, i) => ({ id, label: names[i]! })), value: 'gsu', onChange: () => tx.sound.click(1.1) },
        { type: 'readout', id: 'info8', label: OWN.ratings8, text: () => facts[idx()]! },
        { type: 'toggle', id: 'scale8', label: doc(ID, 0), value: false, onChange: (v) => ctx.camera.go(v ? 'types-row' : ID) },
        { type: 'slider', id: 'bus8', label: doc(ID, 1), min: CURRENT_TRANSFORMER.busRangeA.min, max: CURRENT_TRANSFORMER.busRangeA.max, step: 10, value: 600, unit: 'A', digits: 0, visible: () => ex() === 'ct' },
        { type: 'toggle', id: 'open8', label: doc(ID, 2), value: false, visible: () => ex() === 'ct', onChange: (v) => v && tx.sound.zap() },
        { type: 'readout', id: 'sec8', label: OWN.secondary8, text: () => fmtUnit(ctr().secondaryA, 'A', { digits: 2 }), visible: () => ex() === 'ct' },
        { type: 'note', id: 'danger8', text: OWN.danger8, icon: 'warning', color: STATUS.alarm, visible: () => ex() === 'ct' && open() },
        { type: 'slider', id: 'f8', label: doc(ID, 3), min: SMPS.frequencyRangeHz.min, max: SMPS.frequencyRangeHz.max, scale: 'log', step: 2, value: 50, format: (v) => fmtSI(v, 'Hz'), visible: () => ex() === 'smps' },
        { type: 'readout', id: 'vol8', label: OWN.volume8, text: () => `${fmtUnit(core().volumeCm3, 'cm³', { digits: core().volumeCm3 < 10 ? 1 : 0 })} · ${core().material === 'ferrite' ? OWN.ferrite8 : OWN.steel8}`, visible: () => ex() === 'smps' },
        { type: 'note', id: 'min8', text: OWN.min8, icon: 'info', visible: () => ex() === 'smps' && core().atMinimum },
        { type: 'button', id: 'prev8', label: OWN.prev8, icon: 'arrowLeft', onClick: () => go(-1), disabled: () => row() },
        { type: 'button', id: 'next8', label: OWN.next8, icon: 'arrowRight', onClick: () => go(1), disabled: () => row() },
      ],
      callouts: [
        { anchor: holderAt('gsu', 0), text: names[0]!, side: 'down', visible: () => row() },
        { anchor: holderAt('dist', 0), text: names[2]!, side: 'down', visible: () => row() },
        { anchor: holderAt('iso', 0.25), text: names[4]!, side: 'up', visible: () => row() },
        { anchor: holderAt('smps', 0.05), text: names[5]!, side: 'down', visible: () => row() },
        { anchor: () => personHolder.localToWorld(new Vector3(0, 1.9, 0)), text: OWN.person8, side: 'up', visible: () => !row() && ex() !== 'iso' && ex() !== 'smps' },
      ],
      hotspots: [
        { anchor: holderAt('auto', 6), content: hot(ID, 0), visible: () => front('auto') },
        { anchor: holderAt('ct', 1.9), content: hot(ID, 1), visible: () => front('ct') },
        { anchor: holderAt('smps', 0.05), content: hot(ID, 2), visible: () => front('smps') },
      ],
    },
    probe: () => ({ ex: ex(), row: row(), m, angle, bus: bus(), open: open(), secA: ctr().secondaryA, danger: ctr().danger, f: f(), vol: core().volumeCm3, material: core().material }),
    update(dt, t) {
      const target = -idx() * STEP_A;
      if (!dragging) angle += (target - angle) * Math.min(1, dt * 4);
      const a = angle + drag;
      table.group.rotation.y = a;
      m += ((row() ? 1 : 0) - m) * Math.min(1, dt * 3);
      table.setFade(1 - m);
      gal.list.forEach((e, i) => {
        const h = holders[i]!;
        const th = a + i * STEP_A;
        const slot = new Vector3(Math.sin(th) * R, table.top, Math.cos(th) * R);
        focus[i]! += ((i === idx() ? 1 : 0) - focus[i]!) * Math.min(1, dt * 4);
        const fit = (FIT / e.size) * (0.45 + 0.55 * focus[i]!);
        const s = fit + (TRUE_S - fit) * m;
        h.position.set(slot.x + (rowX[i]! - slot.x) * m, slot.y * (1 - m), slot.z + (0.6 - slot.z) * m);
        h.rotation.y = th * (1 - m) + (e.id === 'ct' ? -0.5 : 0) * m;
        h.scale.setScalar(s);
      });
      // the person: beside the front exhibit at its scale, or in the true-scale row in the gap after the largest unit
      const fe = gal.list[idx()]!;
      const ps = (FIT / fe.size) * (1 - m) + TRUE_S * m;
      personHolder.scale.setScalar(ps);
      personHolder.visible = m > 0.5 || (fe.id !== 'iso' && fe.id !== 'smps');
      personHolder.position.set((1 - m) * (FIT * 0.62) + m * (rowX[0]! + (gal.list[0]!.size * TRUE_S) / 2 + 0.17), table.top * (1 - m), (1 - m) * (R + 0.5) + m * 1.3);
      person.update(dt, t);
      const c = ctr();
      gal.ct.ammeter.part('needle').rotation.z = 0.9 - Math.min(1, c.secondaryA) * 1.8;
      arc.power = ex() === 'ct' && c.danger ? 0.8 + 0.2 * Math.sin(t * 30) : 0;
      const k = core();
      gal.smps.setCore(k.volumeCm3, k.material === 'ferrite');
      tx.sound.hum = ex() === 'smps' ? 0.04 : 0.1;
      tx.sound.buzz = arc.power > 0 ? 0.35 : 0;
      tx.sound.buzzPitch = 2.2;
    },
  };
};

