/**
 * Step 7 `series-parallel` — the circuit constructor and Kirchhoff's laws. Pick a tool, tap two nodes of the
 * 6×4 grid to place a part between them, tap parts with the hand to switch / burn / select them. Every change
 * is solved by the shared modified-nodal-analysis solver (`solveBuilder`, §7): potentials tint the leads,
 * pulses follow the currents, junctions show ΣI = 0, «Обійти контур» walks a loop and sums the voltages.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import type { DragInfo } from '@/engine/api';
import { fmtNumber, fmtUnit } from '@/content';
import { house } from '@/kit';
import {
  BUILDER,
  BUILDER_PRESETS,
  kvlWalk,
  repairLamps,
  resetSources,
  solveBuilder,
  type BuilderPresetId,
  type BuilderSolution,
  type Part,
  type PartKind,
} from '@electricity/sim/current';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { GRID_PITCH, createCircuitGrid } from '../parts/circuit-grid';
import { createCircuitTray } from '../parts/circuit-tray';
import {
  ALL_NODES,
  addPart,
  loopsThroughSource,
  patchPart,
  placementError,
  removePart,
} from '../sim-bindings/builder-edit';
import { group } from '../world';

const ID = 'series-parallel';
const PRESETS: readonly BuilderPresetId[] = ['series', 'parallel', 'mixed', 'garland', 'divider'];
const TOOLS = ['hand', 'wire', 'resistor', 'lamp', 'switch', 'ammeter', 'source', 'erase'] as const;
type Tool = (typeof TOOLS)[number];
const WALK_SPEED = 2.4; // units/s of the KVL ball
const SCALE = 1.2;
const TRAY_Z = 2.85; // set-local centre line of the parts tray, in front of the board's first row
const UP = new Vector3(0, 1, 0);

export const seriesParallelStep: StepFactory = (bench) => {
  const { ctx, ui, mats } = bench;
  // the whole constructor is drawn 1.2× so parts, nodes and leads read at 720p; picking works in set-local units
  const set = group(`set:${ID}`, -0.15, 0, -0.85);
  set.scale.setScalar(SCALE);
  bench.top.add(set);
  const grid = createCircuitGrid(mats);
  const tray = createCircuitTray(TRAY_Z);
  const home = house({ width: 7, depth: 6, floors: 1, seed: 4 });
  home.group.scale.setScalar(0.1);
  home.group.position.set(2.25, 0, -2.35);
  home.group.rotation.y = -0.5;
  set.add(grid.group, tray.group, home.group);

  /* ------------------------------------------------------------------------------------- state */
  let parts: Part[] = [];
  let solution: BuilderSolution = solveBuilder(parts).solution;
  let walk: { loop: string[]; terms: number[]; s: number; lengths: number[] } | null = null;
  let walkCount = 0;
  let kvlText = '';
  const resolve = (): void => {
    const out = solveBuilder(parts);
    parts = out.parts;
    solution = out.solution;
    grid.sync(parts);
    if (grid.selected && !parts.some((p) => p.id === grid.selected)) grid.selected = null;
    if (out.solution.newlyBurnt.length) {
      audio.play('spark');
      ui.toast(OWN.lampBurnt, { tone: 'warning' });
    }
    if (out.solution.newlyTripped.length) {
      audio.play('breaker');
      ui.toast(DOC.shortAlarm, { tone: 'alarm' });
    }
    walk = null;
    kvlText = '';
  };
  const load = (id: BuilderPresetId): void => {
    parts = BUILDER_PRESETS[id].map((p) => ({ ...p }));
    grid.pending = grid.selected = null;
    resolve();
  };
  const selected = (): Part | undefined => parts.find((p) => p.id === grid.selected);
  const tap = (p: Vector3): void => {
    const tool = ui.value<Tool>('tool7');
    if (tool === 'hand' || tool === 'erase') {
      const id = grid.partAt(p);
      const part = parts.find((x) => x.id === id);
      grid.selected = null;
      if (!part) return;
      audio.play('click');
      if (tool === 'erase') parts = removePart(parts, part.id);
      else if (part.kind === 'switch') parts = patchPart(parts, part.id, { closed: part.closed === false });
      else if (part.kind === 'lamp')
        parts = patchPart(parts, part.id, { burnt: true }); // «перегоріти»
      else {
        grid.selected = part.id;
        if (part.kind === 'source') ui.set('emf7', part.emfV ?? BUILDER.emfRangeV.default);
        if (part.kind === 'resistor') ui.set('r7', part.resistanceOhm ?? 10);
        return;
      }
      resolve();
      return;
    }
    const node = grid.nodeAt(p);
    if (!node) return;
    audio.play('tick');
    if (!grid.pending) {
      grid.pending = node;
      return;
    }
    place(tool as PartKind, grid.pending, node);
    grid.pending = null;
  };
  const place = (kind: PartKind, a: string, b: string): void => {
    const error = placementError(parts, a, b);
    if (!error) {
      parts = addPart(parts, kind, a, b);
      resolve();
    } else if (error !== 'same')
      ui.toast(error === 'diagonal' ? OWN.errDiagonal : OWN.errOccupied, { tone: 'warning' });
  };
  // the tray: carry a part onto the board (primary), or tap it to make it the active tool
  for (const item of tray.items) {
    ctx.input.register(item.hit, {
      cursor: 'grab',
      tooltip: OWN.tools[TOOLS.indexOf(item.kind as Tool)],
      click: () => {
        audio.play('tick');
        ui.set('tool7', item.kind);
        grid.pending = null;
      },
      dragStart: () => {
        audio.play('tick');
        tray.held = item;
        tray.invite = false;
        grid.pending = grid.selected = null;
      },
      drag: (e) => {
        const p = e.planePoint(UP, set.localToWorld(onPlane.set(0, 0, 0)), onPlane);
        if (p) tray.carry(set.worldToLocal(p), grid.nodePos);
      },
      dragEnd: () => {
        const s = tray.snap;
        tray.held = null;
        tray.snap = null;
        if (s) place(item.kind, s.a, s.b);
      },
      enabled: () => bench.isCurrent(ID),
    });
    ctx.qa.probe(`tray7:${item.kind}`, () => set.localToWorld(item.home.clone().setY(0.3)));
  }
  // a placed part dragged off the board is removed (the script's «drag деталі геть»); dropped on the board
  // it springs back
  let lifted: { id: string; at: Vector3 } | null = null;
  const onPlane = new Vector3();
  const reach = (p: Vector3): boolean =>
    Math.abs(p.x) < ((BUILDER.columns - 1) / 2) * GRID_PITCH + 0.45 &&
    Math.abs(p.z) < ((BUILDER.rows - 1) / 2) * GRID_PITCH + 0.45;
  const pointer = (e: DragInfo): Vector3 | null => {
    const p = e.planePoint(UP, set.localToWorld(onPlane.set(0, 0, 0)), onPlane);
    return p && set.worldToLocal(p);
  };
  ctx.input.register(grid.pick, {
    cursor: 'pointer',
    click: (e) => e.point && tap(set.worldToLocal(e.point.clone())),
    dragStart: (e) => {
      const p = e.startPoint && set.worldToLocal(e.startPoint.clone());
      const id = p && grid.partAt(p);
      lifted = p && id ? { id, at: p } : null;
      grid.pending = grid.selected = null;
    },
    drag: (e) => {
      const p = lifted && pointer(e);
      if (p && lifted) grid.view(lifted.id)?.group.position.set(p.x - lifted.at.x, 0.3, p.z - lifted.at.z);
    },
    dragEnd: (e) => {
      if (!lifted) return;
      const p = pointer(e);
      const view = grid.view(lifted.id);
      if (p && !reach(p)) {
        audio.play('click');
        parts = removePart(parts, lifted.id);
        resolve();
      } else view?.group.position.set(0, 0, 0);
      lifted = null;
    },
    enabled: () => bench.isCurrent(ID),
  });
  ui.onChange('preset7', (id) => load(id as BuilderPresetId));
  ui.onChange('tool7', () => (grid.pending = null));
  ui.onChange('emf7', (v) => {
    if (selected()?.kind !== 'source') return;
    parts = patchPart(parts, grid.selected!, { emfV: Number(v), tripped: false });
    resolve();
  });
  ui.onChange('r7', (v) => {
    if (selected()?.kind !== 'resistor') return;
    parts = patchPart(parts, grid.selected!, { resistanceOhm: Number(v) });
    resolve();
  });
  const startWalk = (): void => {
    const loops = loopsThroughSource(parts);
    if (loops.length === 0) return void ui.toast(OWN.noLoop, { tone: 'warning' });
    const loop = loops[walkCount++ % loops.length]!;
    // rises are positive: the source lifts by +ℰ, every load drops
    const terms = kvlWalk(solution, loop).steps.map((x) => -(x ?? 0));
    const lengths = loop.map((n, k) =>
      grid.nodePos(n).distanceTo(grid.nodePos(loop[(k + 1) % loop.length]!)),
    );
    walk = { loop, terms, s: 0, lengths };
  };
  const source = (): Part | undefined => parts.find((p) => p.kind === 'source');
  const sourceAmps = (): number => Math.abs(solution.parts.get(source()?.id ?? '')?.currentA ?? 0);
  const v = new Vector3();
  const w = new Vector3();
  for (const n of ALL_NODES)
    ctx.qa.probe(`node7:${n}`, () => set.localToWorld(grid.nodePos(n, new Vector3())));
  ctx.qa.expose('builder', () => ({
    parts: parts.map((p) => {
      const r = solution.parts.get(p.id);
      const mid = grid.view(p.id)?.mid ?? v.set(0, 0, 0);
      return {
        id: p.id,
        kind: p.kind,
        a: p.a,
        b: p.b,
        amps: r?.currentA ?? 0,
        volts: r?.voltageV ?? 0,
        burnt: !!p.burnt,
        closed: p.closed,
        tripped: !!p.tripped,
        emfV: p.emfV,
        ohm: p.resistanceOhm,
        mid: set.localToWorld(mid.clone()).toArray(),
      };
    }),
    short: solution.shortCircuit,
    kcl: solution.maxKclResidualA,
    pending: grid.pending,
    selected: grid.selected,
    kvl: kvlText,
    walking: walk !== null,
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [-0.15, 10.9, 5.05],
        target: [-0.15, 0, -0.2],
        fov: 30,
        frameAspect: 1.25,
        orbit: { azimuth: 0.6, polar: 0.25 },
        fit: { center: [0, 0.4, 0], radius: 4.6 },
      },
    },
    stage: {
      show: [grid.group, tray.group, home.group],
      // a first visit starts from the series preset; later visits find the table as it was left
      enter: () => {
        if (parts.length === 0) load(ui.value<BuilderPresetId>('preset7'));
        grid.pending = null;
        walk = null;
      },
    },
    ui: {
      hint: OWN.hintBuilder,
      honesty: ['simplified'],
      board: {
        title: OWN.kirchhoff,
        size: 'md',
        children: [
          {
            type: 'segmented',
            id: 'preset7',
            label: OWN.presets,
            items: PRESETS.map((id, k) => ({ id, label: DOC.presets[k]! })),
            value: 'series',
          },
          {
            type: 'note',
            id: 'kvl7',
            icon: 'info',
            color: 'yellow',
            text: () => (kvlText ? `ΣU: ${kvlText}` : OWN.kvlIdle),
          },
          {
            type: 'stats',
            id: 'out7',
            columns: 2,
            items: [
              { label: OWN.sourceCurrent, get: () => fmtUnit(sourceAmps(), 'A', { maxDigits: 2 }) },
              {
                label: OWN.loopR,
                get: () =>
                  sourceAmps() > 1e-6 && source()
                    ? fmtUnit((source()!.emfV ?? 0) / sourceAmps(), 'Ω', { maxDigits: 2 })
                    : '∞',
              },
            ],
          },
          {
            type: 'note',
            id: 'short7',
            icon: 'warning',
            color: 'red',
            text: DOC.shortAlarm,
            visible: () => solution.shortCircuit,
          },
        ],
      },
      controls: [
        {
          type: 'segmented',
          id: 'tool7',
          label: OWN.tool,
          items: TOOLS.map((id, k) => ({ id, label: OWN.tools[k]! })),
          value: 'hand',
        },
        {
          type: 'slider',
          id: 'emf7',
          label: OWN.emfOf,
          ...BUILDER.emfRangeV,
          value: BUILDER.emfRangeV.default,
          unit: 'V',
          digits: 1,
          visible: () => selected()?.kind === 'source',
        },
        {
          type: 'slider',
          id: 'r7',
          label: OWN.resistanceOf,
          min: 1,
          max: 100,
          value: 10,
          stops: BUILDER.resistorValuesOhm,
          unit: 'Ω',
          visible: () => selected()?.kind === 'resistor',
        },
        { type: 'button', id: 'walk7', label: DOC.walkLoop, icon: 'play', primary: true, onClick: startWalk },
        {
          type: 'button',
          id: 'repair7',
          label: DOC.repair,
          icon: 'check',
          onClick: () => ((parts = repairLamps(parts)), resolve()),
          visible: () => parts.some((p) => p.burnt),
        },
        {
          type: 'button',
          id: 'reset7',
          label: OWN.resetSource,
          icon: 'lightning',
          onClick: () => ((parts = resetSources(parts)), resolve()),
          visible: () => parts.some((p) => p.tripped),
        },
        {
          type: 'button',
          id: 'clear7',
          label: OWN.clearTable,
          icon: 'close',
          onClick: () => ((parts = []), resolve()),
        },
      ],
      callouts: [
        { anchor: () => home.group.getWorldPosition(v).setY(v.y + 0.75), text: OWN.flat, side: 'up' },
      ],
      hotspots: [
        {
          // at a junction when the circuit has one, else at a node of the top rail
          anchor: () => {
            const j = parts.find(
              (p) =>
                (solution.parts.get(p.id)?.currentA ?? 0) !== 0 &&
                parts.filter((q) => q.a === p.a || q.b === p.a).length >= 3,
            );
            return set.localToWorld(grid.nodePos(j?.a ?? '2,0', v)).setY(v.y + 0.25);
          },
          content: 'node-balance',
        },
        {
          anchor: () => home.group.getWorldPosition(v).set(v.x - 0.55, v.y + 0.2, v.z + 0.4),
          content: 'home-wiring',
        },
      ],
    },
    update(dt, t) {
      if (walk) {
        // the ball runs node to node; passing a part adds its voltage step to the running sum
        walk.s += WALK_SPEED * dt;
        let k = 0;
        let rest = walk.s;
        while (k < walk.lengths.length && rest >= walk.lengths[k]!) rest -= walk.lengths[k++]!;
        const shown = walk.terms.slice(0, k).filter((x) => Math.abs(x) > 1e-6);
        kvlText = shown
          .map((x, n) => `${x >= 0 ? (n ? '+ ' : '+') : '− '}${fmtNumber(Math.abs(x), { maxDigits: 2 })}`)
          .join(' ');
        if (k >= walk.lengths.length) {
          kvlText += ' = 0';
          grid.ball = null;
          walk = null;
          audio.play('success');
        } else {
          grid.nodePos(walk.loop[k]!, v);
          grid.nodePos(walk.loop[(k + 1) % walk.loop.length]!, w);
          grid.ball = v.lerp(w, rest / walk.lengths[k]!);
        }
      } else grid.ball = null;
      grid.apply(parts, solution, t);
      const tool = ui.value<Tool>('tool7');
      tray.active = tool === 'hand' || tool === 'erase' ? null : tool;
      if (ctx.reducedMotion) tray.invite = false; // no idle hopping under reduced motion
      tray.update(dt, t);
      bench.live.buzz = Math.min(sourceAmps() / 6, 1) * 0.6;
    },
  };
};
