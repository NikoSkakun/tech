/**
 * Step 4 `insulators` — breakdown. The gap cell (1 mm, drawn large) holds the chosen insulator; the voltage
 * slider (log, 0,1…200 kV) raises E = U/d (§4): field lines thicken, bound electrons lean (polarisation), from
 * 0,85·E_b avalanche chains flash, at E_b the gap breaks down — air recovers and sparks again while the voltage
 * stays, a solid keeps a charred track until «Відновити» brings a new sample.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit } from '@/content';
import { UI_STATUS } from '@/style';
import {
  avalancheChainLength,
  BREAKDOWN,
  breakdownState,
  INSULATORS,
  type InsulatorId,
} from '@electricity/sim/matter';
import type { StepFactory } from '../chapter';
import { group } from '../chapter';
import { cap, docItems, docLabel } from '../content';
import { L } from '../labels';
import { createGapCell, GAP } from '../parts/gap-cell';

const ID = 'insulators';
/** The cell stands on the podium (its stand reaches 1,7 below the gap centre). */
const CELL_Y = 1.72;
const IDS: InsulatorId[] = ['air', 'oil', 'glass', 'pvc', 'ptfe', 'mica'];

/** kV with sensible digits: 0,10 kV · 2,9 kV · 150 kV. */
const fmtKV = (u: number): string => fmtUnit(u, 'kV', { maxDigits: u < 1 ? 2 : u < 10 ? 1 : 0 });

export const insulatorsStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const set = group(`set:${ID}`, 0, CELL_Y, 0);
  lab.stand.add(set);
  const cell = createGapCell(ctx);
  set.add(cell.group);

  const material = (): InsulatorId => ui.value<string>('mat4') as InsulatorId;
  const volts = (): number => ui.value<number>('U4');
  const state = (): ReturnType<typeof breakdownState> => breakdownState(material(), volts());
  let broken = false;
  let sparkIn = 0;
  let acc = 0;
  let seed = 3;
  const solid = (): boolean => material() !== 'air' && material() !== 'oil';
  const restore = (): void => {
    broken = false;
    cell.setBurn(false);
    sparkIn = 0;
  };
  ui.onChange('mat4', () => {
    audio.play('click');
    cell.setMaterial(material());
    restore();
  });
  ui.onChange('U4', () => audio.play('tick', { pitch: 0.6 + 0.2 * Math.log10(volts() * 10), gain: 0.4 }));

  const v = new Vector3();
  ctx.qa.probe('cell4', cell.group);
  ctx.qa.expose(ID, () => ({ ...state(), material: material(), broken, solid: solid() }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [1.1, CELL_Y + 1.6, 6.8],
        target: [0, CELL_Y - 0.2, 0],
        fov: 32,
        orbit: { azimuth: 0.9, polar: 0.35 },
        fit: { center: [0, CELL_Y - 0.2, 0], radius: 2.6 },
      },
    },
    stage: {
      show: [cell.group],
      enter() {
        cell.setMaterial(material());
        restore();
      },
    },
    ui: {
      honesty: ['notToScale', 'illustrative'],
      controls: [
        {
          type: 'segmented',
          id: 'mat4',
          items: docItems(ID, 0).map((label, i) => ({ id: IDS[i]!, label })),
          value: 'air',
        },
        {
          type: 'slider',
          id: 'U4',
          label: L.ins.voltage,
          min: BREAKDOWN.voltageKV.min,
          max: BREAKDOWN.voltageKV.max,
          value: BREAKDOWN.voltageKV.default,
          scale: 'log',
          step: 2,
          unit: 'kV',
          format: fmtKV,
        },
        {
          type: 'stats',
          id: 'out4',
          items: [
            { label: L.ins.field, get: () => fmtUnit(state().fieldKVPerMm, 'kV/mm', { maxDigits: 2 }) },
            { label: L.ins.strength, get: () => fmtUnit(INSULATORS[material()], 'kV/mm') },
          ],
        },
        {
          type: 'gauge',
          id: 'margin4',
          kind: 'linear',
          label: cap(docLabel(ID, 1)),
          min: 0,
          max: 100,
          unit: '%',
          digits: 0,
          zones: [
            { from: 0, to: 15, color: UI_STATUS.alarm },
            { from: 15, to: 40, color: UI_STATUS.warning },
            { from: 40, to: 100, color: UI_STATUS.ok },
          ],
          get: () => Math.max(Math.min(state().margin * 100, 100), 0),
        },
        { type: 'note', id: 'broken4', text: L.ins.broken, icon: 'warning', visible: () => broken },
        {
          type: 'button',
          id: 'fix4',
          disabled: () => !broken,
          label: docLabel(ID, 2),
          icon: 'resetView',
          primary: true,
          onClick: fix,
        },
      ],
      callouts: [
        {
          anchor: () => set.localToWorld(v.set(-GAP / 2 - 1.75, 0.45, 0)),
          text: L.ins.minus,
          color: 'blue',
          side: 'up',
        },
        {
          anchor: () => set.localToWorld(v.set(GAP / 2 + 1.6, 0.45, 0)),
          text: L.ins.plus,
          color: 'coral',
          side: 'up',
        },
        { anchor: () => set.localToWorld(v.set(0, -1.05, 0.9)), text: L.ins.gap, side: 'down' },
      ],
      hotspots: [
        { anchor: () => set.localToWorld(v.copy(cell.molecule)), content: 'polarized-molecules' },
        { anchor: () => set.localToWorld(v.copy(cell.track)), content: 'burn-track', visible: () => broken },
      ],
    },
    update(dt, t) {
      const s = state();
      cell.ratio = s.ratio;
      acc += s.avalancheRatePerS * dt;
      if (s.avalanches && acc >= 1) {
        acc -= 1;
        cell.avalanche(avalancheChainLength(ctx.random));
        audio.play('spark', { gain: 0.25, pitch: 1.4 });
      }
      if (!s.avalanches) acc = 0;
      if (s.breakdown) {
        sparkIn -= dt;
        if (solid() && !broken) {
          broken = true;
          cell.strike();
          cell.setBurn(true, seed++);
          audio.play('zap');
        } else if (!solid() && sparkIn <= 0) {
          // air and oil heal: the spark comes back as long as the voltage stays
          sparkIn = 1.6;
          cell.strike();
          audio.play('zap', { gain: 0.8 });
        }
      }
      cell.update(dt, t);
      lab.live.hum = Math.min(s.ratio, 1) * 0.8;
      lab.live.crackle = s.avalanches || broken ? 0.7 : 0;
      lab.live.crackleRate = Math.min(s.avalancheRatePerS / 6, 1);
    },
  };

  function fix(): void {
    restore();
    cell.setMaterial(material());
    audio.play('success');
  }
};
