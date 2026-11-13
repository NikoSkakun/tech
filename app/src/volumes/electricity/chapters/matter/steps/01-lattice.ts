/**
 * Step 1 `lattice` — the copper crystal. Over the podium a 6×6×6-cell block of Cu⁺ ion cores assembles layer by
 * layer; one unit cell is framed in `yellow` and lifts out to show its share of atoms (8·⅛ + 6·½ = 4); a pale
 * `cyan` fog of the electron sea fills the block. Without the sea the ions push apart and tremble.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { createProbabilityCloud } from '@/fx';
import { SEMANTIC } from '@/style';
import type { StepFactory } from '../chapter';
import { group } from '../chapter';
import { docLabel } from '../content';
import { L } from '../labels';
import { createFccBlock } from '../parts/fcc-block';
import { createUnitCell } from '../parts/unit-cell';
import { HERO_Y } from '../world';

const ID = 'lattice';
const A = 0.62;
const N = 6;

export const latticeStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const set = group(`set:${ID}`, 0, HERO_Y, 0);
  lab.stand.add(set);
  const block = createFccBlock({ cells: N, a: A, radius: 0.12 });
  const h = block.size / 2;
  const cell = createUnitCell(A, 0.16, new Vector3(h - A / 2, h - A / 2, h - A / 2));
  const fog = createProbabilityCloud({
    capacity: 7000,
    color: 'cyan',
    flash: 'cyan.light',
    size: 0.24,
    intensity: 0.5,
  });
  fog.fill(ctx.quality.count(2600, 1200), (_i, out) => {
    out[0] = (ctx.random.next() - 0.5) * block.size * 1.04;
    out[1] = (ctx.random.next() - 0.5) * block.size * 1.04;
    out[2] = (ctx.random.next() - 0.5) * block.size * 1.04;
  });
  fog.swirl = 0.08;
  set.add(block.group, cell.group, fog);
  ctx.stage.actor(cell.group);
  ctx.stage.actor(fog, { appear: 'fade' });

  let sea = 1; // 0…1, follows the toggle
  const cellOn = (): boolean => ui.value<boolean>('cell1');
  const seaOn = (): boolean => ui.value<boolean>('sea1');
  const replay = (): void => {
    cell.explode = 0;
    ctx.stage.scope.to(cell, { explode: 1 }, { duration: 2.2, ease: 'power2.inOut', delay: 0.3 });
  };
  ui.onChange('cell1', (on) => {
    audio.play('toggle');
    if (!lab.isCurrent(ID)) return;
    ctx.stage.toggle(cell.group, on as boolean);
    if (on) replay();
  });
  ui.onChange('sea1', (on) => {
    audio.play('toggle');
    if (lab.isCurrent(ID)) ctx.stage.toggle(fog, on as boolean);
  });

  const v = new Vector3();
  const ionAnchor = (): Vector3 => set.localToWorld(v.copy(block.sites[block.sites.length - 40]!));
  ctx.qa.probe('cell1', cell.group);
  ctx.qa.probe('block1', block.group);
  ctx.qa.expose(ID, () => ({
    assemble: block.assemble,
    explode: cell.explode,
    sea,
    swell: block.swell,
    atoms: block.sites.length,
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [6.4, 5.4, 12.8],
        target: [0.5, HERO_Y + 0.35, 0.3],
        fov: 32,
        orbit: { azimuth: 1.22, polar: 0.35 },
        fit: { center: [0.5, HERO_Y + 0.4, 0.4], radius: 3.4 },
      },
    },
    stage: {
      show: [block.group, cell.group, fog],
      enter(info) {
        sea = seaOn() ? 1 : 0;
        ctx.stage.toggle(cell.group, cellOn(), { instant: true });
        ctx.stage.toggle(fog, seaOn(), { instant: true });
        // reduced motion: no fly-in, the crystal simply is there
        if (info.instant || ctx.reducedMotion) {
          block.assemble = 1;
          cell.explode = cellOn() ? 1 : 0;
          return;
        }
        block.assemble = 0;
        cell.explode = 0;
        info.scope.to(block, { assemble: 1 }, { duration: 2.4, ease: 'power1.inOut' });
        if (cellOn())
          info.scope.to(cell, { explode: 1 }, { duration: 2.2, ease: 'power2.inOut', delay: 2.4 });
      },
    },
    ui: {
      controls: [
        { type: 'toggle', id: 'cell1', label: docLabel(ID, 0), value: true },
        { type: 'toggle', id: 'sea1', label: docLabel(ID, 2), value: true },
      ],
      callouts: [
        { anchor: ionAnchor, text: L.lattice.ion, side: 'left', color: 'coral' },
        {
          anchor: () => cell.group.getWorldPosition(v).add(new Vector3(0, A * 1.1, 0)),
          text: L.lattice.count,
          color: 'yellow',
          side: 'up',
          visible: () => cellOn() && cell.explode > 0.7,
        },
        {
          anchor: () => set.localToWorld(v.set(-h, h + 0.35, h)),
          text: L.lattice.ruler,
          side: 'left',
        },
        {
          anchor: () => set.localToWorld(v.set(-h * 0.4, -h * 0.55, h)),
          text: L.lattice.sea,
          color: SEMANTIC.electron,
          side: 'down',
          visible: () => seaOn(),
        },
        {
          anchor: () => set.localToWorld(v.set(-h * 0.4, -h * 0.55, h)),
          text: docLabel(ID, 3),
          color: 'amber',
          side: 'down',
          visible: () => !seaOn(),
        },
      ],
      hotspots: [
        {
          anchor: () => cell.group.getWorldPosition(v).add(new Vector3(A * 0.9, 0, 0)),
          content: 'unit-cell',
        },
        { anchor: () => ionAnchor().add(new Vector3(-0.35, 0.3, 0)), content: 'ion-core' },
      ],
    },
    update(dt, t) {
      sea += ((seaOn() ? 1 : 0) - sea) * Math.min(dt * 2.5, 1);
      block.swell = 1 - sea;
      block.jitter = 0.012 + 0.03 * (1 - sea);
      block.update(t);
      cell.update(t);
      fog.intensity = 0.45 + 0.1 * Math.sin(t * 1.3);
      set.rotation.y = 0.12 * Math.sin(t * 0.15);
    },
  };
};
