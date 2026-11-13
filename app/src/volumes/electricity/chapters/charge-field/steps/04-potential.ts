/**
 * Step 4 `potential` — «Потенціал і напруга». The table top becomes the potential landscape (sim §4, fx sheet +
 * iso-lines, `parts/landscape.ts`); field lines lie on the slopes; a test ball rolls down the energy slope
 * (`createMovingCharge` with friction), for a negative ball the relief flips; two voltmeter probes read
 * U = φ_A − φ_B (`voltmeter`) and flash green on one iso-line.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, NBSP } from '@/content';
import { damp } from '@/engine/api';
import {
  BALL_DEFAULTS,
  clampToTable,
  createMovingCharge,
  POTENTIAL,
  POTENTIAL_PRESETS,
  probePotential,
  toPointCharges,
  traceFieldLines,
  voltmeter,
  type TableCharge,
} from '@electricity/sim/charge-field';
import type { StepFactory } from '../chapter';
import { cap, docLabel, factPairs } from '../content';
import { DOC, L } from '../labels';
import { M } from '../layout';
import { createChargeBall } from '../parts/charge-ball';
import { createLandscape } from '../parts/landscape';
import { createNeedle, type Needle } from '../parts/needle';

type Preset = keyof typeof POTENTIAL_PRESETS;
const PRESETS: readonly Preset[] = ['hillAndWell', 'twoHills'];
const START = { x: 0, z: 0.05 }; // the model's control release point

/**
 * Floors of the voltage "lift" (document: «шкала-„ліфт“ з прикладами напруг»): the «назва: значення» facts of
 * the step, highest first. `volts` is parsed from the written value («~70 mV», «750 kV») only to order them.
 */
const PREFIX: Record<string, number> = { m: 1e-3, k: 1e3, M: 1e6 };
const FLOORS = factPairs('potential')
  .map(({ name, value }) => {
    const m = /([\d,]+)\s*([mkM]?)V/.exec(value);
    return { name, value, volts: m ? Number(m[1]!.replace(',', '.')) * (PREFIX[m[2]!] ?? 1) : NaN };
  })
  .filter((f) => Number.isFinite(f.volts))
  .sort((a, b) => b.volts - a.volts);

const fmtV = (v: number): string => `${fmtNumber(v, { maxDigits: Math.abs(v) < 10 ? 1 : 0, sign: true })} V`;

export const potentialStep: StepFactory = ({ ctx, ui, world }) => {
  const { sandbox, lines } = world;
  const on = (): boolean => ctx.stage.current === 'potential';
  const land = createLandscape();
  const set = new Group();
  set.name = 'step-potential';
  ctx.root.add(land.group, set);
  const landActor = ctx.stage.actor(land.group, { appear: 'fade' });
  const relief = ctx.stage.param('relief', 1, { duration: 0.9, ease: 'power2.inOut' });
  let mine: TableCharge[] = POTENTIAL_PRESETS.hillAndWell.map((c) => ({ ...c }));
  let own = mine;

  const ball = createChargeBall({ base: 0.24 });
  const mover = createMovingCharge({ ...BALL_DEFAULTS, charges: [] }, START);
  const needles: [Needle, Needle] = [createNeedle('red', -0.03, 0.075), createNeedle('ink', 0.1, -0.05)];
  set.add(ball.group, needles[0].group, needles[1].group);

  const sign = (): 1 | -1 => (ui.value<string>('ballSign') === 'minus' ? -1 : 1);
  const meter = (): ReturnType<typeof voltmeter> =>
    voltmeter(sandbox.charges, needles[0], needles[1], land.stepV);
  const roll = (x = START.x, z = START.z): void => {
    mover.set({
      charges: toPointCharges(sandbox.charges),
      chargePerMassCPerKg: sign() * BALL_DEFAULTS.chargePerMassCPerKg,
    });
    mover.release(x, z);
  };

  let seen = -1;
  let drawnSign = 0;
  let wait = 0;
  let perch = 0;
  const refresh = (): void => {
    seen = sandbox.version;
    drawnSign = land.sign;
    const charges = sandbox.charges;
    land.refresh(charges);
    lines.set(
      traceFieldLines(charges),
      !charges.some((c) => c.chargeNC > 0),
      (x, z) => land.heightAt(x, z) + 0.07,
    );
    mover.set({ charges: toPointCharges(charges) });
    if (mover.state.status !== 'moving' && !dragging) mover.release(mover.state.x, mover.state.z);
    if (on()) mine = charges.map((c) => ({ ...c }));
    if (on() && ui.value<string>('potPreset') === 'own') own = mine;
  };

  /* --------------------------------------------------------------------------------- dragging */
  const up = new Vector3(0, 1, 0);
  const through = new Vector3();
  const hit = new Vector3();
  let dragging = false;
  /**
   * The lift board takes a column of the screen away from the landscape, so it waits for the moment it has
   * something to say: it comes in when the learner first moves a voltmeter probe, and stays.
   */
  let measured = false;
  const dragOn = (
    target: { x: number; z: number },
    anchor: Group,
    e: { planePoint(n: Vector3, p: Vector3, out?: Vector3): Vector3 | null },
  ): void => {
    if (!e.planePoint(up, through.copy(anchor.position), hit)) return;
    Object.assign(target, clampToTable(hit.x / M, hit.z / M));
  };
  /**
   * A probe dragged close to the other probe's iso-line snaps onto it: a few Newton steps along the gradient of
   * the exact potential. Without it U = 0 would need a precision of ≈ 0,05 mm in a field of 10 kV/m.
   */
  const snap = (needle: Needle, other: Needle): void => {
    const phi = (x: number, z: number): number => probePotential(sandbox.charges, x, z);
    const goal = phi(other.x, other.z);
    let { x, z } = needle;
    if (Math.abs(phi(x, z) - goal) > 0.2 * land.stepV) return;
    const h = 1e-4;
    for (let k = 0; k < 8; k++) {
      const gx = (phi(x + h, z) - phi(x - h, z)) / (2 * h);
      const gz = (phi(x, z + h) - phi(x, z - h)) / (2 * h);
      const g2 = gx * gx + gz * gz;
      if (g2 < 1e-3) return;
      const f = phi(x, z) - goal;
      x -= (f * gx) / g2;
      z -= (f * gz) / g2;
    }
    if (Math.hypot(x - needle.x, z - needle.z) > 0.004 || Math.abs(phi(x, z) - goal) > 0.3) return;
    needle.x = x;
    needle.z = z;
  };
  ctx.input.register(ball.proxy, {
    tooltip: L.potential.ball,
    cursor: 'grab',
    enabled: on,
    hover: (over) => ctx.stage.scope.to(ball, { hover: over ? 1 : 0 }, { duration: 0.12 }),
    dragStart: () => ((dragging = true), audio.play('click')),
    drag: (e) => dragOn(mover.state, ball.group, e),
    dragEnd: () => ((dragging = false), roll(mover.state.x, mover.state.z)),
  });
  needles.forEach((needle, i) => {
    ctx.input.register(needle.handle, {
      tooltip: i ? L.potential.probeB : L.potential.probeA,
      cursor: 'grab',
      enabled: on,
      hover: (over) => ctx.stage.scope.to(needle, { hover: over ? 1 : 0 }, { duration: 0.12 }),
      dragStart: () => (measured = true),
      drag: (e) => (dragOn(needle, needle.group, e), snap(needle, needles[1 - i]!)),
    });
    ctx.qa.probe(`needle-${i ? 'b' : 'a'}`, needle.handle);
  });
  ctx.qa.probe('test-ball', ball.proxy);
  ctx.qa.expose('potential', () => ({
    charges: sandbox.charges.map((c) => ({ ...c })),
    sign: land.sign,
    stepV: land.stepV,
    ...meter(),
    lift: { floors: FLOORS.map((f) => f.value), cabin: cabin(), shown: measured },
    ball: { ...mover.state },
    needles: needles.map((n) => ({ x: n.x, z: n.z })),
  }));

  ui.onChange(
    'potPreset',
    (id) =>
      on() &&
      (id === 'own' || PRESETS.includes(id as Preset)) &&
      // «Свій набір» brings back the learner's own arrangement
      (sandbox.set(id === 'own' ? own : POTENTIAL_PRESETS[id as Preset]), audio.play('toggle')),
  );
  ui.onChange('ballSign', () => {
    if (!on()) return;
    ctx.stage.setParam('relief', sign());
    roll(mover.state.x, mover.state.z);
  });
  ui.onChange('isoStep', (v) => ((land.stepV = Number(v)), (seen = -1)));

  /** Row of the lift where the measured |U| stands: under every example with a higher voltage. */
  const cabin = (): number => {
    const u = Math.abs(meter().voltageV);
    return FLOORS.filter((f) => f.volts > u).length;
  };
  const spot = new Vector3();
  return {
    id: 'potential',
    stage: {
      // the glass top is not listed: it dissolves into the landscape
      show: [landActor.object, sandbox.group, lines.lines, set],
      camera: 'potential',
      enter(info) {
        dragging = false;
        sandbox.max = POTENTIAL.maxCharges;
        sandbox.heightAt = (x, z) => land.heightAt(x, z) + 0.14;
        sandbox.onEdit = () => ui.set('potPreset', 'own');
        sandbox.onFull = () => void ui.toast(L.potential.full, { tone: 'warning' });
        sandbox.set(mine);
        ctx.stage.toggle(lines.lines, true, { instant: true });
        lines.lines.reveal = 1;
        land.stepV = ui.value<number>('isoStep');
        land.sign = sign();
        ctx.stage.setParam('relief', sign(), { instant: true });
        refresh();
        roll();
        if (info.instant) return;
        // «стіл прогинається»: the relief grows out of the flat table
        land.sign = 0;
        relief.value = 0;
        ctx.stage.setParam('relief', sign(), { duration: 1.4 });
      },
    },
    ui: {
      hint: L.potential.ball,
      honesty: [{ text: DOC.compressed }, { text: cap(docLabel('potential', 3)), visible: () => sign() < 0 }],
      controls: [
        {
          type: 'segmented',
          id: 'potPreset',
          value: 'hillAndWell',
          items: [
            ...PRESETS.map((id, i) => ({ id, label: docLabel('potential', i) })),
            { id: 'own', label: L.field.own },
          ],
        },
        {
          type: 'segmented',
          id: 'ballSign',
          label: L.potential.sign,
          value: 'plus',
          items: [
            { id: 'plus', label: L.potential.plus },
            { id: 'minus', label: docLabel('potential', 2) },
          ],
        },
        {
          type: 'slider',
          id: 'isoStep',
          label: cap(docLabel('potential', 5)),
          min: 10,
          max: 100,
          stops: POTENTIAL.isolineStepsV,
          value: POTENTIAL.defaultIsolineStepV,
          unit: 'V',
          digits: 0,
        },
        {
          type: 'stats',
          id: 'potentialStats',
          columns: 3,
          items: [
            {
              label: L.potential.voltage,
              get: () => fmtV(meter().voltageV),
              color: () => (meter().sameIsoline ? 'green' : 'white'),
            },
            {
              label: L.potential.phiA,
              get: () => fmtV(probePotential(sandbox.charges, needles[0].x, needles[0].z)),
              color: () => 'red',
            },
            {
              label: L.potential.phiB,
              get: () => fmtV(probePotential(sandbox.charges, needles[1].x, needles[1].z)),
            },
          ],
        },
        {
          type: 'note',
          id: 'sameLine',
          text: L.potential.same,
          icon: 'check',
          color: 'green',
          visible: () => meter().sameIsoline,
        },
        {
          type: 'button',
          id: 'roll',
          label: L.potential.roll,
          icon: 'play',
          primary: true,
          onClick: () => roll(),
        },
      ],
      // The "lift": the voltage between the two probes takes its place among the example voltages of the facts.
      board: {
        title: L.potential.lift,
        size: 'sm',
        visible: () => measured,
        children: [
          {
            type: 'table',
            id: 'lift',
            rows: () => {
              const rows = FLOORS.map((f) => [f.name, f.value.replace(' ', NBSP)]);
              rows.splice(cabin(), 0, [
                L.potential.voltage,
                fmtV(Math.abs(meter().voltageV)).replace('+', ''),
              ]);
              return rows;
            },
            highlight: cabin,
          },
        ],
      },
      callouts: [
        {
          anchor: () => needles[0].group.position.clone().setY(needles[0].group.position.y + 1.6),
          text: 'A',
          side: 'up',
          color: 'red',
        },
        {
          anchor: () => needles[1].group.position.clone().setY(needles[1].group.position.y + 1.6),
          text: 'B',
          side: 'up',
        },
      ],
      hotspots: [
        { anchor: () => spot.set(0, land.heightAt(0, 0.1) + 0.3, 3), content: 'equipotential-line' },
        {
          anchor: () => {
            const c = sandbox.charges[0];
            return c
              ? spot.set(c.x * M * 0.72, land.heightAt(c.x * 0.72, c.z * 0.72) + 0.35, c.z * M * 0.72 - 0.5)
              : spot.set(0, 1, 0);
          },
          content: 'steep-slope',
          visible: () => sandbox.charges.length > 0,
        },
      ],
    },
    update(dt, t) {
      land.sign = relief.value;
      wait -= dt;
      const morphing = Math.abs(land.sign - drawnSign) > 1e-3;
      if (morphing || (sandbox.version !== seen && wait <= 0)) {
        wait = 1 / 30;
        refresh();
      }
      if (!dragging) mover.step(Math.min(dt, 1 / 30));
      const s = mover.state;
      ball.set(sign());
      // a ball caught by a charge perches on top of it: it stays readable there and can be picked up again
      // (inside the charge its pick sphere would be hidden by the bigger one of the charge)
      perch = damp(perch, s.status === 'captured' && !dragging ? 0.6 : 0, 8, dt);
      ball.group.position.set(s.x * M, land.heightAt(s.x, s.z) + 0.22 + perch, s.z * M);
      ball.update(dt, t);
      const same = meter().sameIsoline;
      for (const n of needles) {
        n.group.position.set(n.x * M, land.heightAt(n.x, n.z), n.z * M);
        n.flash = damp(n.flash, same ? 1 : 0, 6, dt);
        n.update();
      }
    },
  };
};
