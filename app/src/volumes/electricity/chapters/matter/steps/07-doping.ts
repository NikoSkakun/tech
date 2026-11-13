/**
 * Step 7 `doping` — n-type and p-type. The planar scheme is split: the left half (tinted `teal`) takes
 * phosphorus, whose fifth electron soon flies free and leaves a fixed «+» ion; the right half (tinted `pink`)
 * takes boron, whose missing electron becomes a wandering hole and leaves a fixed «−» ion. The concentration
 * sliders set the number of drawn dopants (1 drawn atom = very many real ones), the user can drag more from the
 * tray; the board shows n, p and ρ of both halves (§7) and that each half stays neutral.
 */
import { Mesh, Vector3 } from 'three';
import { audio } from '@/audio';

import { Builder, G } from '@/kit';
import { K, SEMANTIC } from '@/style';
import { DOPING_RANGE_PER_CM3, dopedSilicon } from '@electricity/sim/matter';
import { sci } from '../fmt';
import type { StepFactory } from '../chapter';
import { group } from '../chapter';
import { cap, docLabel } from '../content';
import { DOC, L } from '../labels';
import { createDopantView, type Dopant, type DopantKind } from '../parts/dopants';
import { atomIndex, COLS, createSiSheet, ROWS, SPACING } from '../parts/si-sheet';
import { HERO_Y } from '../world';

const ID = 'doping';
const IONISE_S = 0.9;
const PER_SIDE = 8;
const ORDER: Record<DopantKind, number[]> = {
  P: [
    [2, 4],
    [1, 2],
    [3, 6],
    [3, 1],
    [1, 5],
    [2, 3],
    [4, 4],
    [1, 7],
  ].map(([c, r]) => atomIndex(c!, r!)),
  B: [
    [7, 4],
    [8, 2],
    [6, 6],
    [6, 1],
    [8, 5],
    [7, 3],
    [5, 4],
    [8, 7],
  ].map(([c, r]) => atomIndex(c!, r!)),
};
const STOPS = Array.from({ length: 8 }, (_, k) => 10 ** (12 + k));
const drawnCount = (n: number): number => Math.min(Math.max(Math.round(Math.log10(n) - 11), 1), PER_SIDE);

export const dopingStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const set = group(`set:${ID}`, 0, HERO_Y + 0.5, 0);
  lab.stand.add(set);
  const sheet = createSiSheet(ctx);
  sheet.split = true;
  sheet.lifetime = Infinity;
  sheet.holeStep = 0.8;
  const view = createDopantView(new Vector3(0, -(ROWS / 2) * SPACING - 0.2, 1.3));
  const W = (COLS / 2) * SPACING;
  const H = ROWS * SPACING;
  const plate = (x: number, color: 'teal' | 'pink'): Mesh => {
    const m = new Mesh(
      G.rbox(W - 0.08, H + 0.1, 0.06, 0.03, 2),
      K.glass({ color, opacity: 0.16, edgeOpacity: 0.6 }),
    );
    m.position.set(x, 0, -0.25);
    return m;
  };
  // cleanroom chip on the podium: a tiny package with pins and a shiny die
  const cb = new Builder('chip');
  cb.box(0.9, 0.1, 0.9, { r: 0.03, c: 'ink' });
  cb.box(0.4, 0.03, 0.4, { r: 0.01, slot: 'metal', c: 'sky.light', at: [0, 0.1, 0] });
  for (let k = 0; k < 6; k++)
    for (const s of [-1, 1])
      cb.box(0.06, 0.03, 0.14, { r: 0, slot: 'metal', c: 'mist', at: [-0.32 + k * 0.128, 0.02, s * 0.5] });
  const chip = cb.build().group;
  chip.position.set(2.7, 0.06, 1.7);
  chip.rotation.y = 0.5;
  sheet.group.add(plate(-W / 2, 'teal'), plate(W / 2, 'pink'));
  set.add(sheet.group, view.group);
  lab.stand.add(chip);

  const dopants: (Dopant & { manual: boolean })[] = [];
  const nd = (): number => ui.value<number>('ND7');
  const na = (): number => ui.value<number>('NA7');
  const nType = (): ReturnType<typeof dopedSilicon> => dopedSilicon('n', nd());
  const pType = (): ReturnType<typeof dopedSilicon> => dopedSilicon('p', na());
  const occupied = (atom: number): boolean => dopants.some((d) => d.atom === atom);
  const add = (kind: DopantKind, atom: number, manual: boolean): void => {
    dopants.push({ kind, atom, age: 0, ionised: false, manual });
    sheet.atomScale[atom] = 0;
    if (kind === 'P')
      sheet.free.push({
        pos: sheet.atomPos[atom]!.clone(),
        vel: new Vector3(0.6, 0, 0),
        age: 0,
        tether: atom,
      });
    else {
      // boron has only 3 valence electrons: one of its bonds starts empty
      const slot = sheet.slots.findIndex((s) => s.filled && (s.a === atom || s.b === atom));
      if (slot >= 0) sheet.makeHole(slot);
    }
  };
  const remove = (k: number): void => {
    const d = dopants[k]!;
    dopants.splice(k, 1);
    sheet.atomScale[d.atom] = 1;
    if (d.kind === 'P') {
      const i = sheet.free.findIndex((e) => e.tether === d.atom || e.pos.x < 0);
      if (i >= 0) sheet.free.splice(i, 1);
    } else {
      const h = sheet.holes.findIndex((s) => sheet.slots[s]!.pos.x > 0);
      if (h >= 0) {
        sheet.slots[sheet.holes[h]!]!.filled = true;
        sheet.holes.splice(h, 1);
      }
    }
  };
  const sync = (): void => {
    for (const kind of ['P', 'B'] as const) {
      const want = drawnCount(kind === 'P' ? nd() : na());
      const auto = (): number => dopants.filter((d) => d.kind === kind && !d.manual).length;
      while (auto() > want) remove(dopants.map((d) => d.kind === kind && !d.manual).lastIndexOf(true));
      for (const atom of ORDER[kind]) {
        if (auto() >= want || dopants.filter((d) => d.kind === kind).length >= PER_SIDE) break;
        if (!occupied(atom)) add(kind, atom, false);
      }
    }
  };
  ui.onChange('ND7', () => audio.play('tick'));
  ui.onChange('NA7', () => audio.play('tick'));
  const reset = (instant: boolean): void => {
    dopants.length = 0;
    sheet.free.length = 0;
    sheet.holes.length = 0;
    sheet.hops.length = 0;
    sheet.atomScale.fill(1);
    for (const s of sheet.slots) s.filled = true;
    sync();
    if (instant) for (const d of dopants) d.age = IONISE_S + 0.5;
  };
  setupTray();

  const v = new Vector3();
  const firstIon = (): Vector3 => {
    const d = dopants.find((x) => x.kind === 'P') ?? dopants[0];
    return set.localToWorld(v.copy(sheet.atomPos[d?.atom ?? ORDER.P[0]!]!));
  };
  ctx.qa.probe('trayP', view.trayP);
  ctx.qa.probe('trayB', view.trayB);
  ctx.qa.probe('node7', () => set.localToWorld(v.copy(sheet.atomPos[atomIndex(1, 1)]!)));
  ctx.qa.probe('nodeB7', () => set.localToWorld(v.copy(sheet.atomPos[atomIndex(9, 6)]!)));
  ctx.qa.expose(ID, () => ({
    donors: dopants.filter((d) => d.kind === 'P').length,
    acceptors: dopants.filter((d) => d.kind === 'B').length,
    ionised: dopants.filter((d) => d.ionised).length,
    free: sheet.free.filter((e) => e.tether < 0).length,
    holes: sheet.holes.length,
    n: nType().electronsPerCm3,
    p: pType().holesPerCm3,
    rhoN: nType().resistivityOhmM,
    rhoP: pType().resistivityOhmM,
  }));
  const conc = (x: number): string => `${sci(x, 1)} cm⁻³`;

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.5, HERO_Y + 1.7, 10.2],
        target: [0, HERO_Y + 0.15, 0],
        fov: 32,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0, HERO_Y + 0.2, 0], radius: 3.7 },
      },
    },
    stage: {
      show: [sheet.group, view.group, chip],
      enter: (info) => reset(info.instant),
    },
    ui: {
      honesty: [{ text: docLabel(ID, 4) }, { text: DOC.planar }],
      controls: [
        {
          type: 'slider',
          id: 'ND7',
          label: L.dop.nd,
          min: DOPING_RANGE_PER_CM3.min,
          max: DOPING_RANGE_PER_CM3.max,
          value: DOPING_RANGE_PER_CM3.default,
          scale: 'log',
          stops: STOPS,
          format: conc,
        },
        {
          type: 'slider',
          id: 'NA7',
          label: L.dop.na,
          min: DOPING_RANGE_PER_CM3.min,
          max: DOPING_RANGE_PER_CM3.max,
          value: DOPING_RANGE_PER_CM3.default,
          scale: 'log',
          stops: STOPS,
          format: conc,
        },
        { type: 'note', id: 'drag7', text: L.dop.drag, icon: 'hand' },
      ],
      board: {
        title: cap(docLabel(ID, 2)),
        size: 'md',
        children: [
          {
            type: 'table',
            id: 'tbl7',
            head: ['', L.dop.nHead, L.dop.pHead],
            rows: () => [
              [cap(DOC.freeElectrons), conc(nType().electronsPerCm3), conc(pType().electronsPerCm3)],
              [cap(DOC.holes), conc(nType().holesPerCm3), conc(pType().holesPerCm3)],
              [L.dop.rho, `${sci(nType().resistivityOhmM, 1)} Ω·m`, `${sci(pType().resistivityOhmM, 1)} Ω·m`],
              [L.dop.charge, '0', '0'],
            ],
          },
        ],
      },
      callouts: [
        {
          anchor: () => set.localToWorld(v.set(-W / 2, (ROWS / 2) * SPACING + 0.2, 0)),
          text: L.dop.nSide,
          color: SEMANTIC.nRegion,
          side: 'up',
        },
        {
          anchor: () => set.localToWorld(v.set(W / 2, (ROWS / 2) * SPACING + 0.2, 0)),
          text: L.dop.pSide,
          color: SEMANTIC.pRegion,
          side: 'up',
        },
        {
          anchor: () => view.trayP.getWorldPosition(v),
          text: DOC.phosphorus,
          color: SEMANTIC.donor,
          side: 'left',
        },
        {
          anchor: () => view.trayB.getWorldPosition(v),
          text: DOC.boron,
          color: SEMANTIC.acceptor,
          side: 'right',
        },
      ],
      hotspots: [
        { anchor: () => firstIon().add(new Vector3(0.3, 0.3, 0)), content: 'fixed-ion' },
        { anchor: () => chip.getWorldPosition(v).add(new Vector3(0, 0.3, 0)), content: 'cleanroom' },
      ],
    },
    update(dt, t) {
      sync();
      for (const d of dopants) {
        d.age += dt;
        if (d.ionised || d.age < IONISE_S) continue;
        d.ionised = true;
        if (d.kind === 'P') {
          const e = sheet.free.find((x) => x.tether === d.atom);
          if (e) e.tether = -1;
          audio.play('tick', { pitch: 1.7, gain: 0.35 });
        } else {
          // a neighbouring electron fills boron's empty bond: the hole moves away, B becomes «−»
          const h = sheet.holes.findIndex(
            (s) => sheet.slots[s]!.a === d.atom || sheet.slots[s]!.b === d.atom,
          );
          const at = sheet.slots[sheet.holes[h] ?? -1];
          const to = at?.near.find(
            (n) =>
              sheet.slots[n]!.filled &&
              sheet.slots[n]!.a !== d.atom &&
              sheet.slots[n]!.b !== d.atom &&
              sheet.slots[n]!.pos.x > 0,
          );
          if (h >= 0 && to !== undefined) sheet.hopHole(h, to);
          audio.play('tick', { pitch: 1.2, gain: 0.35 });
        }
      }
      sheet.update(dt, t);
      view.draw(dopants, sheet.atomPos, t);
      lab.live.crackle = 0.2;
      lab.live.crackleRate = 0.3;
    },
  };

  function setupTray(): void {
    const hit = new Vector3();
    const local = new Vector3();
    const normal = new Vector3(0, 0, 1);
    for (const kind of ['P', 'B'] as const) {
      ctx.input.register(kind === 'P' ? view.trayP : view.trayB, {
        tooltip: kind === 'P' ? DOC.phosphorus : DOC.boron,
        cursor: 'grab',
        enabled: () => lab.isCurrent(ID),
        dragStart: () => {
          view.ghost = { kind, pos: new Vector3(0, -10, 0) };
          audio.play('click');
        },
        drag: (e) => {
          if (!view.ghost || !e.planePoint(normal, set.getWorldPosition(local), hit)) return;
          view.ghost.pos.copy(set.worldToLocal(hit));
        },
        dragEnd: () => {
          const g = view.ghost;
          view.ghost = null;
          if (!g) return;
          let best = -1;
          sheet.atomPos.forEach((p, i) => {
            if (
              (kind === 'P' ? p.x < 0 : p.x > 0) &&
              !occupied(i) &&
              p.distanceTo(g.pos) < 0.6 &&
              (best < 0 || p.distanceTo(g.pos) < sheet.atomPos[best]!.distanceTo(g.pos))
            )
              best = i;
          });
          if (best < 0 || dopants.filter((d) => d.kind === kind).length >= PER_SIDE)
            return void audio.play('error', { gain: 0.4 });
          add(kind, best, true);
          audio.play('success', { gain: 0.5 });
        },
      });
    }
  }
};
