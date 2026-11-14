/**
 * Step 4 `solenoid` — the coil and the electromagnet. A 40-turn copper solenoid (10 cm) lies on two saddles;
 * its field lines (Biot–Savart of 12 loops, traced in the plane of the axis) run straight inside and loop
 * outside like a bar magnet's, and the compass carpet shows the same picture (N / S tags at the ends). A steel
 * core rod slides in (drag or toggle): B jumps from mT to ≈ 1 T (model М3: tanh saturation, μ_eff = 200,
 * B_sat = 1,6 T) — lines get denser and brighter and the crane lifts n ∝ B² clips.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtSI } from '@/content';
import { createFlow, solenoidField, streamline, type RibbonLine } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { MAGNETS, SOLENOID, solenoid } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBLines } from '../parts/b-lines';
import { createCoil } from '../parts/coil';
import { CLIPS, createCrane } from '../parts/crane';
import { createSupply } from '../parts/supply';
import { group } from '../world';

const ID = 'solenoid';
const R = 0.24;
const L = 1.0;
const AXIS_Y = 0.36;
const OUT = 1.45;

export const solenoidStep: StepFactory = (bench) => {
  const { ctx, ui, carpet } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const coil = createCoil({ r: R, len: L, turns: 40, wire: 0.022, formerColor: 'slate' });
  coil.group.position.y = AXIS_Y;
  const sb = new Builder('saddles');
  for (const x of [-0.42, 0.42]) {
    sb.box(0.14, AXIS_Y - 0.12, 0.42, { at: [x, 0, 0], r: 0.03, c: ['ink', 'slate'] });
  }
  const saddles = sb.build();
  const rb = new Builder('core-rod');
  rb.cyl(0.15, 1.15, { axis: 'x', at: [-0.575, 0, 0], seg: 28, slot: 'metal', c: 'steel', bevel: 0.03 });
  rb.cyl(0.04, 0.12, { axis: 'x', at: [0.575, 0, 0], seg: 12, slot: 'metal', c: 'mist' });
  rb.sphere(0.07, { at: [0.72, 0, 0], seg: 14, c: 'ink' });
  const rod = new Group();
  rod.add(rb.build().group);
  rod.position.set(OUT, AXIS_Y, 0);
  const lines = createBLines(15 * 420, { width: 0.022, intensity: 1.3, dashSpeed: 0.4 });
  lines.mesh.position.y = AXIS_Y;
  const crane = createCrane(ctx.random.fork('clips'));
  crane.group.position.set(0.55, 0, -1.55);
  const supply = createSupply(0.6);
  supply.group.position.set(-1.35, 0, 1.15);
  supply.group.rotation.y = 0.35;
  supply.group.updateMatrix();
  // leads: supply terminals → the two ends of the winding
  const lb = new Builder('leads');
  const [e0, e1] = coil.ends.map((e) => e.clone().setY(e.y + AXIS_Y));
  const tp = supply.plus.position.clone().applyMatrix4(supply.group.matrix);
  const tm = supply.minus.position.clone().applyMatrix4(supply.group.matrix);
  lb.tube([tp, new Vector3(tp.x, 0.05, tp.z - 0.3), new Vector3(e0!.x - 0.2, 0.05, 0.45), new Vector3(e0!.x, 0.05, e0!.z + 0.1), e0!], 0.022, { slot: 'metal', c: 'coral' });
  lb.tube([tm, new Vector3(tm.x + 0.2, 0.05, tm.z - 0.1), new Vector3(e1!.x + 0.15, 0.05, 0.55), new Vector3(e1!.x, 0.05, e1!.z + 0.1), e1!], 0.022, { slot: 'metal', c: 'blue' });
  const leads = lb.build();
  const electrons = createFlow(ctx, {
    kind: 'electron',
    paths: coil.path.map((p) => p.clone().setY(p.y + AXIS_Y)),
    count: ctx.quality.count(90, 30),
    radius: 0.028,
    speed: 0,
  });
  set.add(coil.group, saddles.group, leads.group, rod, lines.mesh, crane.group, supply.group, electrons);

  /* ------------------------------------------------------------------------------------- state */
  const current = (): number => ui.value<number>('i4');
  const turns = (): number => ui.value<number>('n4');
  const st = { insert: 0, reversed: false, dragging: false };
  const model = () => {
    const air = solenoid(turns(), current(), false, st.reversed);
    const core = solenoid(turns(), current(), true, st.reversed);
    const f = st.insert;
    return { fieldT: air.fieldT + (core.fieldT - air.fieldT) * f, airT: air.fieldT, clips: Math.round(core.clips * f * f + air.clips) };
  };
  // unit-current field shape of the coil (12 loops), normalised to 1 at the centre
  const shape = solenoidField(new Vector3(), new Vector3(1, 0, 0), R, L, 1, 12);
  const tmp = new Vector3();
  const at = new Vector3();
  const centre = shape(new Vector3(), new Vector3()).x;
  const cache = new Map<number, [number, number]>();
  const shapeAt = (x: number, z: number): [number, number] => {
    const k = Math.round(x * 100) * 10000 + Math.round(z * 100);
    let v = cache.get(k);
    if (!v) {
      shape(at.set(x, 0, z), tmp);
      v = [tmp.x / centre, -tmp.z / centre];
      cache.set(k, v);
    }
    return v;
  };
  let lineKey = '';
  function retrace(): void {
    const dense = st.insert > 0.5;
    const key = `${st.reversed}:${dense}:${current() > 0}`;
    if (key === lineKey) return;
    lineKey = key;
    const n = dense ? 13 : 7;
    const out: RibbonLine[] = [];
    const field = (p: Vector3, o: Vector3): Vector3 => shape(p, o).multiplyScalar(st.reversed ? -1 : 1);
    for (let k = 0; k < n; k++) {
      const z = (((k + 0.5) / n) * 2 - 1) * R * 0.82;
      const s = streamline(field, new Vector3(0, 0, z), { step: 0.025, maxLength: 9, bothWays: true, detectLoop: true, bounds: { center: new Vector3(), radius: 2.4 } });
      out.push({ points: s.points, closed: s.closed });
    }
    lines.set(out);
  }

  /* ------------------------------------------------------------------------------- interaction */
  let slide: ReturnType<typeof ctx.tweens.to> | null = null;
  const moveRod = (inserted: boolean): void => {
    slide?.kill();
    slide = ctx.stage.scope.to(st, { insert: inserted ? 1 : 0 }, { duration: 0.8, ease: 'power2.inOut' });
  };
  ui.onChange('core4', (on) => (audio.play('click', { pitch: on ? 0.8 : 1.1 }), moveRod(Boolean(on))));
  const through = new Vector3();
  let grab = 0;
  ctx.input.register(rod, {
    tooltip: DOC.core,
    cursor: 'grab',
    enabled: () => bench.isCurrent(ID),
    dragStart: (e) => {
      st.dragging = true;
      slide?.kill();
      const p = e.planePoint(new Vector3(0, 0, 1), rod.getWorldPosition(through));
      grab = p ? set.worldToLocal(p).x - rod.position.x : 0;
    },
    drag: (e) => {
      const p = e.planePoint(new Vector3(0, 0, 1), rod.getWorldPosition(through));
      if (!p) return;
      const x = set.worldToLocal(p).x - grab;
      st.insert = Math.min(Math.max(1 - x / OUT, 0), 1);
    },
    dragEnd: () => {
      st.dragging = false;
      const on = st.insert > 0.5;
      ui.set('core4', on);
      moveRod(on);
    },
  });
  ctx.qa.probe('rod4', rod);
  ctx.qa.probe('coil4', coil.group);
  ctx.qa.expose(ID, () => {
    const m = model();
    return { fieldT: m.fieldT, airT: m.airT, clips: m.clips, insert: st.insert, reversed: st.reversed, lifted: crane.lifted, carpetEast: carpet.headingAt(1.4, 0) };
  });
  const v = new Vector3();
  const end = (sign: number) => (): Vector3 => coil.group.getWorldPosition(v).add(new Vector3((sign * L) / 2 + sign * 0.18, 0.32, 0));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.5, 3.8, 4.4],
        target: [0.05, 0.6, -0.25],
        fov: 34,
        frameAspect: 1.35,
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [0.1, 0.7, -0.2], radius: 2.4 },
      },
    },
    stage: {
      show: [set, carpet.group],
      enter: (info) => {
        st.insert = ui.value<boolean>('core4') ? 1 : 0;
        st.reversed = false;
        lineKey = '';
        retrace();
        carpet.layout(0, 0.1, 3.8);
        carpet.field = (x, z, out) => {
          const [sx, sy] = shapeAt(x, z);
          const b = model().fieldT * (current() > 0 ? 1 : 0);
          out.x = sx * b;
          out.y = sy * b + MAGNETS.earthT;
        };
        carpet.mask = (x, z) =>
          (Math.abs(x) < L / 2 + 0.12 && Math.abs(z) < R + 0.12) ||
          (x > L / 2 && x < rod.position.x + 0.75 && Math.abs(z) < 0.2) ||
          Math.hypot(x + 1.35, z - 1.15) < 0.55 ||
          Math.hypot(x - 1.45, z + 1.55) < 0.42 ||
          Math.hypot(x - 0.55, z + 1.55) < 0.38;
        if (info.instant) carpet.settle();
      },
    },
    ui: {
      reset: true,
      honesty: [{ kind: 'simplified', text: DOC.simplified }],
      controls: [
        { type: 'slider', id: 'i4', label: DOC.coilI, ...SOLENOID.currentRangeA, value: SOLENOID.currentRangeA.default, unit: 'A', digits: 2 },
        { type: 'slider', id: 'n4', label: DOC.turns, ...SOLENOID.turnsRange, value: SOLENOID.turnsRange.default, digits: 0 },
        { type: 'toggle', id: 'core4', label: DOC.core, value: false },
        { type: 'gauge', id: 'b4', kind: 'radial', label: DOC.bCentre, min: 0, max: 2, unit: 'T', digits: 2, zones: [{ from: 0, to: 1.5, color: 'green' }, { from: 1.5, to: 2, color: 'amber' }], get: () => model().fieldT },
        { type: 'readout', id: 'bmt4', label: DOC.bCentre, text: () => fmtSI(model().fieldT, 'T', { digits: 3 }) },
        { type: 'readout', id: 'clips4', label: DOC.clips, text: () => `${Math.round(crane.lifted)} / ${CLIPS}` },
        {
          type: 'button',
          id: 'pol4',
          label: DOC.polarity,
          icon: 'resetView',
          onClick: () => {
            st.reversed = !st.reversed;
            audio.play('toggle');
          },
        },
      ],
      callouts: [
        ...[1, -1].flatMap((sign) =>
          [false, true].map((rev) => ({
            anchor: end(sign),
            text: (sign > 0) !== rev ? OWN.north : OWN.south,
            color: (sign > 0) !== rev ? SEMANTIC.poleN : SEMANTIC.poleS,
            side: 'up' as const,
            visible: () => st.reversed === rev && current() > 0.001,
          })),
        ),
        { anchor: () => crane.magnet.getWorldPosition(v).setY(v.y + 0.3), text: OWN.crane, side: 'right' },
        { anchor: () => rod.getWorldPosition(v).setY(v.y - 0.22), text: OWN.coreRod, color: 'cyan', side: 'down', visible: () => st.insert < 0.5 && !st.dragging },
      ],
      hotspots: [
        { anchor: () => rod.getWorldPosition(v).setY(v.y + 0.18).setX(v.x - 0.2), content: 'core' },
        { anchor: end(1), content: 'coil-end-n' },
      ],
    },
    update(dt, t) {
      retrace();
      const m = model();
      rod.position.x = (1 - st.insert) * OUT;
      const i = current();
      const strength = Math.min(m.fieldT / 1.2, 1);
      lines.mesh.visible = i > 0.001;
      lines.mesh.intensity = 0.55 + 1.0 * Math.max(strength, Math.min(m.airT / 0.012, 0.4));
      lines.mesh.dashSpeed = 0.25 + 0.6 * strength;
      // the helix winds clockwise about +x: electrons along the path ⇔ conventional current against it ⇔ B along +x
      electrons.speed = (st.reversed ? -1 : 1) * 0.25 * i;
      electrons.density = i > 0.001 ? 1 : 0.4;
      crane.lifted += (m.clips - crane.lifted) * Math.min(dt * 4, 1);
      crane.update(dt, t);
      supply.level = i / 2;
      supply.update(t);
      bench.live.buzz = 0.2 + 0.4 * strength * (i > 0 ? 1 : 0);
    },
  };
};
