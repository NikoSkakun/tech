/**
 * Step 3 `field` — «Електричне поле». The sandbox: charges from the tray on the table (≤ 6), `amber` field
 * lines re-traced live while a charge is dragged (sim: `traceFieldLines`), a draggable test charge that shows
 * E⃗ and |E| (`probeField`), pins, the 16×16 arrow grid, and «Відпустити»: a released test charge whose path
 * (sim: `createMovingCharge`) leaves the field line it started on.
 */
import { Group, Mesh, OctahedronGeometry, SphereGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { createArrowField, gridPoints, RibbonLines, streamline, type VectorField } from '@/fx';
import {
  clampToTable,
  createMovingCharge,
  electricField,
  FIELD_PRESETS,
  RELEASE_DEFAULTS,
  SANDBOX,
  toPointCharges,
  traceFieldLines,
  type MovingCharge,
  type TableCharge,
} from '@electricity/sim/charge-field';
import { K, SEMANTIC } from '@/style';
import type { StepFactory } from '../chapter';
import { docLabel } from '../content';
import { fmtSciUnit } from '../fmt';
import { L } from '../labels';
import { CHARGE_Y, M, TABLE } from '../layout';
import { createFieldProbe } from '../parts/probe';

type Preset = keyof typeof FIELD_PRESETS;
const PRESETS: readonly Preset[] = ['single', 'dipole', 'likeCharges', 'quadrupole'];
const REFRESH_S = 1 / 30; // the document's limit for re-tracing while dragging

export const fieldStep: StepFactory = ({ ctx, ui, world }) => {
  const { sandbox, lines } = world;
  const on = (): boolean => ctx.stage.current === 'field';
  const set = new Group();
  set.name = 'step-field';
  ctx.root.add(set);
  let mine: TableCharge[] = FIELD_PRESETS.single.map((c) => ({ ...c }));

  /* ------------------------------------------------------------------- probe, pins, arrow grid */
  const probe = createFieldProbe();
  const fieldAt: VectorField = (p, out) => {
    const e = electricField(
      toPointCharges(sandbox.charges),
      { x: p.x / M, y: 0, z: p.z / M },
      SANDBOX.softeningM,
    );
    return out.set(e.x, 0, e.z);
  };
  const cells = gridPoints(
    new Vector3(0, CHARGE_Y, 0),
    [TABLE.play * 2, 0, TABLE.play * 2],
    [SANDBOX.gridSize, 1, SANDBOX.gridSize],
  );
  const grid = createArrowField(fieldAt, {
    points: cells.filter((p) => Math.hypot(p.x, p.z) < TABLE.play),
    color: SEMANTIC.fieldE,
    length: 0.56,
    reference: 2e4,
    magnitudeScale: 0.45,
  });
  // the released test charge: a ball, its path so far, and the field line through the starting point
  const runner = new Mesh(
    new SphereGeometry(0.13, 16, 12),
    K.glow({ color: SEMANTIC.proton, keepHue: true, whiten: 0.1, intensity: 1.6 }),
  );
  const path = new RibbonLines({
    capacity: 600,
    color: 'white',
    width: 0.05,
    intensity: 1.2,
    dashStrength: 0,
    base: 1,
    endFade: [0, 0],
  });
  const startLine = new RibbonLines({
    capacity: 500,
    color: 'yellow',
    width: 0.045,
    intensity: 1.1,
    dashRepeat: 2.2,
    dashStrength: 0.9,
    dashSpeed: 0.5,
    base: 0.15,
    keepHue: true,
  });
  const nullStar = new Mesh(
    new OctahedronGeometry(0.16),
    K.glow({ color: 'green', keepHue: true, whiten: 0, intensity: 1.7 }),
  );
  set.add(probe.group, grid, runner, path, startLine, nullStar);
  const probeActor = ctx.stage.actor(probe.group);
  const gridActor = ctx.stage.actor(grid, { appear: 'fade' });

  let mover: MovingCharge | null = null;
  const track: Vector3[] = [];
  const stopRun = (): void => {
    mover = null;
    track.length = 0;
    runner.visible = path.visible = startLine.visible = false;
  };
  const release = (): void => {
    if (!ui.value<boolean>('probe')) ui.set('probe', true, { notify: true });
    const start = clampToTable(probe.x, probe.z);
    mover = createMovingCharge({ ...RELEASE_DEFAULTS, charges: toPointCharges(sandbox.charges) }, start);
    track.length = 0;
    runner.visible = path.visible = startLine.visible = true;
    const line = streamline(fieldAt, new Vector3(start.x * M, CHARGE_Y, start.z * M), {
      step: 0.06,
      maxLength: 14,
      detectLoop: false,
      bounds: { center: new Vector3(0, CHARGE_Y, 0), radius: TABLE.radius },
      stops: sandbox.charges.map((c) => ({
        position: new Vector3(c.x * M, CHARGE_Y, c.z * M),
        radius: SANDBOX.sinkRadiusM * M,
      })),
    });
    startLine.setLines([{ points: line.points }]);
    audio.play('whooshUp', { gain: 0.4 });
  };

  /* --------------------------------------------------------------------------------- refreshing */
  let seen = -1;
  let wait = 0;
  const nullPoint = new Vector3();
  let hasNull = false;
  const refresh = (): void => {
    seen = sandbox.version;
    const charges = sandbox.charges;
    lines.set(traceFieldLines(charges), !charges.some((c) => c.chargeNC > 0));
    grid.sample(fieldAt);
    probe.refresh(charges);
    // exactly two like charges: the field vanishes between them, at distances in the ratio √|q₁| : √|q₂|
    const [a, b] = charges;
    hasNull = charges.length === 2 && a!.chargeNC * b!.chargeNC > 0;
    if (hasNull) {
      const k =
        Math.sqrt(Math.abs(a!.chargeNC)) /
        (Math.sqrt(Math.abs(a!.chargeNC)) + Math.sqrt(Math.abs(b!.chargeNC)));
      nullPoint.set((a!.x + (b!.x - a!.x) * k) * M, CHARGE_Y, (a!.z + (b!.z - a!.z) * k) * M);
    }
    if (on()) mine = charges.map((c) => ({ ...c }));
  };
  const applyPreset = (id: string): void => {
    if (!PRESETS.includes(id as Preset)) return;
    stopRun();
    sandbox.set(FIELD_PRESETS[id as Preset]);
    audio.play('toggle');
  };
  ui.onChange('fieldPreset', (id) => on() && applyPreset(String(id)));
  ui.onChange('probe', (v) => on() && ctx.stage.toggle(probeActor, v === true));
  ui.onChange('grid', (v) => {
    if (!on()) return;
    ctx.stage.toggle(gridActor, v === true);
    ctx.stage.toggle(lines.lines, v !== true);
  });

  /* -------------------------------------------------------------------------------- probe input */
  const up = new Vector3(0, 1, 0);
  const through = new Vector3(0, CHARGE_Y, 0);
  const hit = new Vector3();
  const hover = { v: 0 };
  ctx.input.register(probe.handle, {
    tooltip: L.field.probe,
    cursor: 'grab',
    enabled: () => on() && ui.value<boolean>('probe'),
    hover: (over) => ctx.stage.scope.to(hover, { v: over ? 1 : 0 }, { duration: 0.12 }),
    drag: (e) => {
      if (!e.planePoint(up, through, hit)) return;
      Object.assign(probe, clampToTable(hit.x / M, hit.z / M));
      probe.refresh(sandbox.charges);
    },
    // a tap leaves a pin with the vector at this point (document: «клік лишає „шпильку“»)
    click: () => {
      if (probe.pin()) audio.play('tick', { pitch: 1.4 });
      probe.refresh(sandbox.charges);
    },
  });
  ctx.qa.probe('probe', probe.handle);
  ctx.qa.expose('field', () => ({
    charges: sandbox.charges.map((c) => ({ ...c })),
    lines: lines.lines.visible,
    grid: ctx.stage.shown(gridActor),
    probe: { x: probe.x, z: probe.z, strength: probe.strength, pins: probe.pins },
    run: mover ? { ...mover.state } : null,
    nullPoint: hasNull,
  }));

  return {
    id: 'field',
    stage: {
      show: [world.top.object, sandbox.group, lines.lines, set],
      camera: 'field',
      enter(info) {
        stopRun();
        sandbox.max = SANDBOX.maxCharges;
        sandbox.heightAt = () => CHARGE_Y;
        sandbox.onEdit = () => (stopRun(), ui.set('fieldPreset', 'own'));
        sandbox.onFull = () => void ui.toast(L.field.full, { tone: 'warning' });
        sandbox.set(mine);
        refresh();
        const gridOn = ui.value<boolean>('grid');
        ctx.stage.toggle(probeActor, ui.value<boolean>('probe'), { instant: info.instant });
        ctx.stage.toggle(gridActor, gridOn, { instant: info.instant });
        ctx.stage.toggle(lines.lines, !gridOn, { instant: true });
        // the lines "develop" out of the charges when the step is entered by navigation
        lines.lines.reveal = 1;
        if (!info.instant && !gridOn) {
          lines.lines.reveal = 0;
          info.scope.to(lines.lines, { reveal: 1 }, { duration: 1.3, ease: 'power2.out' });
        }
      },
    },
    ui: {
      hint: L.field.tray,
      honesty: [{ kind: 'simplified', text: L.field.slice }],
      controls: [
        {
          type: 'segmented',
          id: 'fieldPreset',
          value: 'single',
          items: PRESETS.map((id, i) => ({ id, label: docLabel('field', i) })),
        },
        { type: 'toggle', id: 'probe', label: docLabel('field', 4), value: true },
        { type: 'toggle', id: 'grid', label: docLabel('field', 6), value: false },
        {
          type: 'stats',
          id: 'fieldStats',
          items: [
            {
              label: L.field.strength,
              get: () => (ui.value<boolean>('probe') ? fmtSciUnit(probe.strength, 'V/m') : '—'),
              color: () => 'amber',
            },
            { label: L.field.count, get: () => `${sandbox.charges.length} / ${SANDBOX.maxCharges}` },
          ],
        },
        {
          type: 'button',
          id: 'release',
          label: L.field.release,
          icon: 'play',
          primary: true,
          onClick: release,
        },
        {
          type: 'button',
          id: 'clearPins',
          label: L.field.clear,
          icon: 'close',
          visible: () => probe.pins > 0,
          onClick: () => (probe.clear(), probe.refresh(sandbox.charges)),
        },
      ],
      callouts: [{ anchor: runner, text: L.field.path, side: 'up', visible: () => mover !== null }],
      hotspots: [
        { anchor: () => nullPoint, content: 'null-point', visible: () => hasNull },
        {
          anchor: () =>
            hit.set(
              (sandbox.charges[0]?.x ?? 0) * M + 0.9,
              CHARGE_Y + 0.5,
              (sandbox.charges[0]?.z ?? 0) * M - 0.9,
            ),
          content: 'line-density',
          visible: () => sandbox.charges.length > 0 && !ui.value<boolean>('grid'),
        },
      ],
    },
    update(dt, t) {
      wait -= dt;
      if (sandbox.version !== seen && wait <= 0) {
        wait = REFRESH_S;
        if (mover) stopRun(); // the field changed under the released charge
        refresh();
      }
      nullStar.visible = hasNull;
      nullStar.position.copy(nullPoint);
      nullStar.rotation.y = t * 1.5;
      probe.handle.scale.setScalar(1 + 0.15 * hover.v);
      if (mover) {
        const s = mover.state.status === 'moving' ? mover.step(Math.min(dt, 1 / 30)) : mover.state;
        runner.position.set(s.x * M, CHARGE_Y, s.z * M);
        const last = track[track.length - 1];
        if (!last || last.distanceToSquared(runner.position) > 0.0025) {
          if (track.length < 590) track.push(runner.position.clone());
          if (track.length > 1) path.setLines([{ points: track }]);
        }
      }
    },
  };
};
