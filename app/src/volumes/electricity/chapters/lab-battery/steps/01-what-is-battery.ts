/**
 * Step 1 `what-is-battery` — a galvanic cell on the podium, the ladder of standard potentials beside it and
 * the museum of battery history behind. Model: `galvanicPair` (§M1).
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { galvanicPair, type Electrode } from '@electricity/sim/lab-battery';
import { notices } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { METAL_LOOK, createDaniellCell, createLadder, createMuseum, reactive } from '../parts';
import { group } from '../world';

const ID = 'what-is-battery';
const low = new Vector3();

export const whatIsBattery: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const cell = createDaniellCell(ctx, mats);
  cell.group.position.set(-0.35, 0, 0.95);
  const museum = createMuseum();
  museum.group.position.set(1.75, 0, -1.5);
  museum.group.scale.setScalar(1.15);

  // the two metals in the beaker; a newly picked metal replaces the one chosen longer ago
  const chosen: Electrode[] = ['Zn', 'Cu'];
  const notes = notices(
    'notes1',
    {
      ideal: { text: L.idealised, tone: 'honesty' },
      water: { text: L.reactsWithWater, tone: 'alarm' },
      oneWay: { text: L.notRechargeable, tone: 'info' },
    },
    ['ideal'],
  );
  let emfV = 0;
  const apply = (instant = false): void => {
    const pair = galvanicPair(chosen[0]!, chosen[1]!);
    emfV = pair.emfV;
    cell.set(
      {
        anode: { ...METAL_LOOK[pair.anode], reactive: reactive(pair.anode) },
        cathode: { ...METAL_LOOK[pair.cathode], reactive: reactive(pair.cathode) },
        emfV,
      },
      instant,
    );
    ladder.setPair(pair.anode, pair.cathode, emfV);
    notes.show('water', pair.reactsWithWater);
  };
  const ladder = createLadder(ctx, mats, L.ladder, (metal) => {
    if (chosen.includes(metal)) return;
    chosen.shift();
    chosen.push(metal);
    audio.play('tick', { pitch: 1.1 });
    apply();
  });
  ladder.group.position.set(-3.55, 0, 0.0);
  ladder.group.rotation.y = 0.3;
  const set = group(`set:${ID}`, 0, 0, 0, [cell.group, ladder.group, museum.group]);
  lab.stageRoot.add(set);

  ui.onChange('mode1', (mode) => {
    cell.charging = mode === 'charge';
    notes.show('oneWay', cell.charging);
  });

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [2.5, 4.3, 11.3],
        target: [-0.7, 1.7, 0],
        fov: 28,
        orbit: { azimuth: 0.9, polar: 0.3 },
      },
    },
    stage: {
      show: [museum.group, ladder.group, cell.group],
      enter: (info) => {
        cell.charging = ui.value<string>('mode1') === 'charge';
        notes.show('oneWay', cell.charging);
        apply(info.instant);
      },
    },
    ui: {
      hint: L.hint1,
      honesty: ['simplified', 'notToScale'],
      controls: [
        {
          type: 'segmented',
          id: 'mode1',
          items: [
            { id: 'discharge', label: L.discharge },
            { id: 'charge', label: L.charge },
          ],
          value: 'discharge',
        },
        { type: 'readout', id: 'emf1', label: L.emf, unit: 'V', digits: 2, get: () => emfV },
        notes.spec,
      ],
      callouts: [
        {
          anchor: () => cell.anodeRod.localToWorld(low.set(0, -0.75, 0.16)),
          text: L.anode,
          color: 'blue',
          side: 'down',
        },
        {
          anchor: () => cell.cathodeRod.localToWorld(low.set(0, -0.75, 0.16)),
          text: L.cathode,
          color: 'coral',
          side: 'down',
        },
        { anchor: cell.lamp, text: L.electronsWire, color: 'cyan', side: 'up' },
        { anchor: museum.anchor('nimh'), text: L.niMh, side: 'up' },
        { anchor: museum.anchor('liion'), text: L.liIon1991, side: 'up' },
      ],
      hotspots: [
        { anchor: museum.anchor('volta'), title: 'Volta pile — стовп Вольти' },
        { anchor: museum.anchor('lead'), title: 'Lead-acid — свинцевий акумулятор' },
      ],
    },
    probe: () => ({
      emfV,
      pair: chosen.join('-'),
      charging: cell.charging,
      rungLi: ladder.rung('Li').getWorldPosition(low.clone()).toArray(),
      rungAg: ladder.rung('Ag').getWorldPosition(low.clone()).toArray(),
    }),
    update: (dt, t) => cell.update(dt, t),
  };
};
