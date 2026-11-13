/**
 * The charge sandbox of steps 3 and 4: up to `max` charges on the table that can be dragged, a tray with spare
 * `+1`, `+2`, `−1`, `−2` nC charges on the rim (drag one onto the table, or tap it), and removal by dragging a
 * charge past the edge. Positions are kept in the simulation's units (metres on the table plane, nC); `version`
 * grows with every change so that the owner knows when to re-trace field lines.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { damp, type ChapterContext } from '@/engine/api';
import { Builder } from '@/kit';
import { clampToTable, SANDBOX, type TableCharge } from '@electricity/sim/charge-field';
import { CHARGE_Y, M, TABLE, TRAY } from '../layout';
import { createChargeBall } from './charge-ball';

const TRAY_VALUES = [1, 2, -1, -2] as const;
/** Charges keep at least this distance from each other (two seed circles of the field-line tracer). */
const MIN_GAP_M = 2 * SANDBOX.seedRadiusM + 0.002;

export interface Sandbox {
  group: Group;
  /** Charges on the table now (do not mutate; use `set`). */
  readonly charges: TableCharge[];
  /** Incremented on every change of the arrangement. */
  version: number;
  /** Most charges allowed on the table (6 in step 3, 4 in step 4). */
  max: number;
  /** Height (scene units) of a charge centre above the point (x, z) in metres — flat by default. */
  heightAt: (xM: number, zM: number) => number;
  /** Called after the learner changed the arrangement (not after `set`). */
  onEdit: () => void;
  /** Called when a charge is taken from the tray although `max` are on the table. */
  onFull: () => void;
  set(list: readonly TableCharge[]): void;
  update(dt: number, t: number): void;
}

export function createSandbox(ctx: ChapterContext, enabled: () => boolean): Sandbox {
  const group = new Group();
  group.name = 'sandbox';
  const slots = Array.from({ length: SANDBOX.maxCharges }, (_, i) => ({
    ball: createChargeBall({ phase: i * 1.3 }),
    charge: null as TableCharge | null,
    shown: 0,
  }));
  for (const s of slots) group.add(s.ball.group);

  // the tray: a small shelf clamped to the left of the rim with one charge of each kind
  const tray = new Builder('charge-tray');
  const width = TRAY.pitch * TRAY_VALUES.length + 0.3;
  tray.box(width, 0.16, 1.05, { r: 0.08, c: ['bg.plum', 'slate'], at: [0, -0.3, 0] });
  tray.box(width - 0.2, 0.05, 0.85, { r: 0.02, slot: 'metal', c: 'steel', at: [0, -0.15, 0] });
  const shelf = tray.build().group;
  shelf.position.set(TRAY.x, 0, TRAY.z);
  shelf.rotation.y = TRAY.turn;
  group.add(shelf);
  const spares = TRAY_VALUES.map((q, i) => {
    const ball = createChargeBall({ phase: i });
    ball.set(q);
    ball.handle = false;
    ball.grab = 1.2; // neighbours on the tray are 0,82 apart
    ball.group.position.set((i - 1.5) * TRAY.pitch, 0.32, 0);
    shelf.add(ball.group);
    return ball;
  });

  const sandbox: Sandbox = {
    group,
    charges: [],
    version: 0,
    max: SANDBOX.maxCharges,
    heightAt: () => CHARGE_Y,
    onEdit: () => undefined,
    onFull: () => undefined,
    set(list) {
      slots.forEach((s, i) => (s.charge = list[i] ? { ...list[i] } : null));
      publish();
    },
    update(dt, t) {
      for (const s of slots) {
        s.shown = damp(s.shown, s.charge ? 1 : 0, 12, dt);
        s.ball.group.visible = s.shown > 0.02;
        if (s.charge) {
          s.ball.set(s.charge.chargeNC);
          s.ball.group.position.set(s.charge.x * M, sandbox.heightAt(s.charge.x, s.charge.z), s.charge.z * M);
        }
        s.ball.group.scale.setScalar(Math.max(s.shown, 1e-3));
        s.ball.update(dt, t);
      }
      for (const b of spares) b.update(dt, t);
    },
  };
  const publish = (): void => {
    sandbox.charges.length = 0;
    for (const s of slots) if (s.charge) sandbox.charges.push(s.charge);
    sandbox.version++;
  };

  /* ------------------------------------------------------------------------------- interaction */
  const up = new Vector3(0, 1, 0);
  const through = new Vector3(0, CHARGE_Y, 0);
  const hit = new Vector3();
  const offTable = (c: TableCharge): boolean => Math.hypot(c.x, c.z) * M > TABLE.play * 1.04;
  const move = (
    c: TableCharge,
    e: { planePoint(n: Vector3, p: Vector3, out?: Vector3): Vector3 | null },
  ): void => {
    // drag in the horizontal plane at the charge's own height (on the landscape of step 4 it is not flat)
    if (!e.planePoint(up, through.set(0, sandbox.heightAt(c.x, c.z), 0), hit)) return;
    hit.setY(0).clampLength(0, TABLE.radius + 1.6); // may leave the table (= remove), but not fly away
    c.x = hit.x / M;
    c.z = hit.z / M;
    separate(c);
    publish();
  };
  /** Keep a dragged charge off the others (the tracer needs the seed circles apart). */
  const separate = (c: TableCharge): void => {
    for (const o of sandbox.charges) {
      if (o === c) continue;
      const d = Math.hypot(c.x - o.x, c.z - o.z);
      if (d >= MIN_GAP_M) continue;
      const k = MIN_GAP_M / (d || 1);
      c.x = o.x + (d ? (c.x - o.x) * k : MIN_GAP_M);
      c.z = o.z + (d ? (c.z - o.z) * k : 0);
    }
  };
  const drop = (slot: (typeof slots)[number]): void => {
    const c = slot.charge;
    if (!c) return;
    if (offTable(c)) {
      slot.charge = null; // dragged past the rim: the charge is taken off the table
      audio.play('panelClose', { gain: 0.6 });
    } else Object.assign(c, clampToTable(c.x, c.z));
    publish();
    sandbox.onEdit();
  };
  const spawn = (q: number, x: number, z: number): (typeof slots)[number] | null => {
    const free = slots.find((s) => !s.charge);
    if (!free || sandbox.charges.length >= sandbox.max) {
      sandbox.onFull();
      return null;
    }
    free.charge = { x, z, chargeNC: q };
    free.shown = 0;
    separate(free.charge);
    publish();
    return free;
  };

  slots.forEach((slot, i) => {
    ctx.input.register(slot.ball.proxy, {
      tooltip: () =>
        `${slot.charge && slot.charge.chargeNC > 0 ? '+' : '−'}${Math.abs(slot.charge?.chargeNC ?? 0)} nC`,
      cursor: 'grab',
      enabled: () => enabled() && slot.charge !== null,
      hover: (over) => ctx.stage.scope.to(slot.ball, { hover: over ? 1 : 0 }, { duration: 0.12 }),
      dragStart: () => audio.play('click'),
      drag: (e) => slot.charge && move(slot.charge, e),
      dragEnd: () => drop(slot),
    });
    ctx.qa.probe(`charge-${i}`, slot.ball.proxy);
  });
  spares.forEach((ball, i) => {
    let taken: (typeof slots)[number] | null = null;
    ctx.input.register(ball.proxy, {
      tooltip: `${TRAY_VALUES[i]! > 0 ? '+' : '−'}${Math.abs(TRAY_VALUES[i]!)} nC`,
      cursor: 'grab',
      enabled,
      hover: (over) => ctx.stage.scope.to(ball, { hover: over ? 1 : 0 }, { duration: 0.12 }),
      // a tap puts the charge on a free spot of the table; a drag carries it there
      click: () => {
        const a = 2.4 * sandbox.charges.length + 0.6;
        if (spawn(TRAY_VALUES[i]!, Math.cos(a) * 0.09, Math.sin(a) * 0.09)) sandbox.onEdit();
      },
      dragStart: () => {
        ball.group.getWorldPosition(hit);
        taken = spawn(TRAY_VALUES[i]!, hit.x / M, hit.z / M);
        if (taken) audio.play('click');
      },
      drag: (e) => taken?.charge && move(taken.charge, e),
      dragEnd: () => taken && (drop(taken), (taken = null)),
    });
    ctx.qa.probe(`tray-${i}`, ball.proxy);
  });
  return sandbox;
}
