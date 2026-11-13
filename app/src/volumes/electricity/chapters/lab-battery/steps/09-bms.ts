/**
 * Step 9 `bms` — an opened 16S module: every cell has a level glass you can drag, the BMS board watches the
 * voltages, bleeds or shuffles charge, opens its contactor and talks to the inverter over CAN.
 * Model: `createBms` (§M5) through `sim/bms-session.ts`.
 */
import { Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '@/audio';
import { fmtNumber, fmtUnit } from '@/content';
import { createWire } from '@/fx';
import { hybridInverter } from '@/kit';
import { CELL_LIMITS } from '@electricity/sim/lab-battery';
import { MOTION } from '@/style';
import { Button, Chart, row } from '@/ui3d';
import { factTable, notices, statGrid } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { BMS_CELLS, createBmsRig } from '../parts';
import { createBmsSession } from '../sim';
import { group, mesh } from '../world';

const ID = 'bms';
const LFP = CELL_LIMITS.LFP;

export const bms: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const rig = createBmsRig(mats);
  rig.group.position.set(-1.15, 0, 0.5);
  const wall = group('wall', 3.0, 0, -1.2);
  wall.rotation.y = -0.5;
  wall.add(mesh(new RoundedBoxGeometry(1.7, 3.2, 0.14, 3, 0.05), mats.plinth, 0, 1.6, -0.1));
  const inverter = hybridInverter();
  inverter.group.scale.setScalar(2.1);
  inverter.group.position.set(0, 2.2, 0);
  wall.add(inverter.group);
  const at = (p: Vector3): Vector3 => p.clone().add(rig.group.position);
  const power = createWire(
    [
      at(rig.plus),
      at(rig.plus).add(new Vector3(0.45, -0.9, 0.2)),
      new Vector3(2.6, 0.18, -0.4),
      new Vector3(2.75, 1.25, -1.0),
    ],
    { radius: 0.06, color: 'ink', repeat: 1.1, speed: 0, power: 0 },
  );
  // data, not energy: the CAN pair carries cyan "letters" from the BMS to the inverter
  const can = createWire(
    [
      at(rig.canPort),
      at(rig.canPort).add(new Vector3(0.7, 0.5, 0.1)),
      new Vector3(2.5, 3.1, -1.0),
      new Vector3(2.85, 2.9, -1.05),
    ],
    { radius: 0.03, color: 'slate', pulseColor: 'cyan', repeat: 2.6, speed: 1.3, length: 0.25, power: 1 },
  );
  const set = group(`set:${ID}`, 0, 0, 0, [rig.group, wall, power, can]);
  lab.stageRoot.add(set);

  const session = createBmsSession();
  /* --------------------------------------------------------------------------------------- board */
  const xs = Array.from({ length: BMS_CELLS }, (_, i) => i + 1);
  const chart = new Chart({
    height: 190,
    x: { min: 0.4, max: BMS_CELLS + 0.6, label: L.axisCell, ticks: [1, 4, 7, 10, 13, 16] },
    y: { min: 2.4, max: 3.8, label: L.axisVoltage },
    series: [
      { id: 'u', color: 'lime', kind: 'bars' },
      { id: 'ovp', label: `${L.lineOvp} ${fmtNumber(LFP.uMaxV, { digits: 2 })} V`, color: 'red', width: 1.4 },
      {
        id: 'uvp',
        label: `${L.lineUvp} ${fmtNumber(LFP.uMinV, { digits: 2 })} V`,
        color: 'amber',
        width: 1.4,
      },
    ],
  });
  chart.setData('ovp', [0.4, BMS_CELLS + 0.6], [LFP.uMaxV, LFP.uMaxV]);
  chart.setData('uvp', [0.4, BMS_CELLS + 0.6], [LFP.uMinV, LFP.uMinV]);
  const stats = statGrid([{ name: '16S', color: 'lime' }], [L.statPackU, L.statPackI, L.statModelTime]);
  // the two results the document names: usable capacity of the string and the time to equalise
  const facts = factTable('facts9', [L.usableCapacity, L.toEqual]);
  const notes = notices('notes9', { trip: { text: L.bmsEmergency, tone: 'warning' } });
  const run = (mode: 'charge' | 'discharge') => (): void => {
    notes.show('trip', false);
    session.start(mode);
    audio.play('relay');
  };
  const buttons = [
    new Button({
      label: L.charge,
      icon: 'plus',
      variant: 'primary',
      onClick: ui.action('charge9', run('charge')),
    }),
    new Button({ label: L.discharge, icon: 'minus', onClick: ui.action('discharge9', run('discharge')) }),
    new Button({
      label: L.unbalance,
      icon: 'layers',
      onClick: ui.action(
        'unbalance9',
        () => (session.unbalance(() => ctx.random.next()), audio.play('tick')),
      ),
    }),
  ];
  lab.holo.add(ID, {
    title: L.boardBms,
    width: 520,
    children: [
      chart,
      stats.node,
      facts.spec.node,
      row({ gap: 10, wrap: true, width: 'fill', children: buttons }),
      notes.spec.node,
    ],
  });

  /* ------------------------------------------------------------------ direct manipulation: glasses */
  rig.glasses.forEach((glass, i) => {
    const state = { hover: 0 };
    ctx.input.register(glass, {
      tooltip: () => `${L.cellGlass} · № ${i + 1}: ${fmtNumber(session.state.socPct[i]!, { digits: 0 })} %`,
      cursor: 'ns-resize',
      hover: (over) =>
        ctx.tweens.to(
          state,
          { hover: over ? 1 : 0 },
          { duration: MOTION.hover.duration, onUpdate: () => glass.scale.setScalar(1 + 0.12 * state.hover) },
        ),
      // dragging up fills the cell: 3 px per percent of SOC
      drag: (e) => session.setSoc(i, session.state.socPct[i]! - e.dy / 3),
    });
  });
  const v = new Vector3();
  let lastVolts = '';

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.9, 5.3, 13.4],
        target: [-2.3, 2.3, 0],
        fov: 28,
        orbit: { azimuth: 0.8, polar: 0.3 },
      },
    },
    stage: { show: [rig.group, wall, power, can], leave: () => audio.loop('hum').set({ gain: 0 }) },
    ui: {
      hint: L.hint9,
      honesty: ['simplified', { sped: 450 }],
      controls: [
        {
          type: 'slider',
          id: 'weak9',
          label: L.cell7Capacity,
          min: 70,
          max: 100,
          step: 1,
          unit: 'Ah',
          value: 100,
        },
        {
          type: 'segmented',
          id: 'balancing9',
          label: L.balancing,
          items: [
            { id: 'off', label: L.balOff },
            { id: 'passive', label: L.balPassive },
            { id: 'active', label: L.balActive },
          ],
          value: 'off',
        },
        {
          type: 'segmented',
          id: 'link9',
          label: L.link,
          items: [
            { id: 'can', label: L.can },
            { id: 'none', label: L.linkNone },
          ],
          value: 'can',
        },
      ],
      callouts: [
        {
          anchor: () => rig.board.getWorldPosition(v).setY(v.y + 1.35),
          text: L.bmsBoard,
          color: 'teal',
          side: 'up',
        },
        {
          anchor: () => rig.board.getWorldPosition(v).set(v.x - 0.8, v.y + 0.25, v.z + 0.15),
          text: L.balanceResistors,
          color: 'orange',
          side: 'left',
        },
        {
          anchor: () => can.getWorldPosition(v).set(v.x + 1.7, v.y + 3.0, v.z - 0.7),
          text: L.canCable,
          color: 'cyan',
          side: 'up',
        },
      ],
      hotspots: [
        { anchor: rig.shunt, title: 'Shunt — шунт' },
        { anchor: rig.contactor, title: 'Contactor — контактор' },
        { anchor: rig.precharge, title: 'Pre-charge resistor — резистор попереднього заряду' },
      ],
    },
    probe: () => ({
      soc: session.state.socPct.map((x) => Math.round(x * 10) / 10).join(),
      mode: session.state.mode,
      stop: session.state.stop,
      usable: session.state.usableCapacityAh,
      hours: session.hours,
      balancing: session.state.balancingA.some((a) => a !== 0),
      trip: notes.isShown('trip'),
      glass3: rig.glasses[3]!.getWorldPosition(v.clone()).toArray(),
    }),
    update(dt, t) {
      const live = lab.isCurrent(ID);
      session.params.balancing = ui.value<'off' | 'passive' | 'active'>('balancing9');
      session.params.link = ui.value<'can' | 'none'>('link9');
      session.params.weakAh = ui.value<number>('weak9');
      const stop = live ? session.tick(dt) : null;
      if (stop) {
        // «аварійне відключення BMS» only happens without the CAN link: the inverter charged blind
        notes.show('trip', stop === 'bms-emergency');
        audio.play(stop === 'complete' ? 'success' : 'breaker', { gain: 0.7 });
      }
      const s = session.state;
      rig.apply(
        {
          socPct: s.socPct,
          balancingA: s.balancingA,
          stopCell: s.stopCell,
          weakCell: session.params.weakAh < 100 ? session.weakCell : -1,
          contactorClosed: s.mode !== 'idle',
        },
        t,
      );
      const volts = s.cellVoltagesV.map((u) => u.toFixed(3)).join();
      if (volts !== lastVolts) {
        lastVolts = volts;
        chart.setData('u', xs, s.cellVoltagesV);
      }
      stats.set(0, 0, fmtNumber(s.packVoltageV, { digits: 2 }));
      stats.set(0, 1, fmtNumber(s.currentA, { digits: 1 }));
      stats.set(0, 2, fmtNumber(session.hours, { digits: 1 }));
      facts.set(0, fmtUnit(s.usableCapacityAh, 'Ah', { digits: 1 }));
      const tBal = session.balanceHours();
      facts.set(1, tBal === null ? '—' : fmtUnit(tBal, 'h', { maxDigits: 1 }));
      // 3D: power pulses follow the current (toward the pack while charging); CAN pulses only with a link
      const c = s.currentA / 50;
      power.material.speed += (-1.5 * c - power.material.speed) * Math.min(1, dt * 6);
      power.material.power = Math.min(Math.abs(c), 1.2);
      can.material.power = session.params.link === 'can' ? 1 : 0;
      inverter.setLeds({ grid: true, bat: s.mode !== 'idle', alarm: s.stop === 'bms-emergency' });
      audio.loop('hum').set({ gain: live && s.mode !== 'idle' ? 0.05 : 0, pitch: 1 });
    },
  };
};
