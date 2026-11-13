/**
 * Step 5 `circuit` — closed, open and short circuit. AA cell → switch → fuse → lamp → back, with the standard
 * diagram on the board. A copper jumper can be dragged onto the lamp's terminals (the short-circuit current
 * runs through the fuse, which blows) or straight onto the battery holder (bypassing switch and fuse: the
 * cell heats up). The switch can sit in any of three places of the loop. Model: `createShortCircuit` (§5).
 */
import { Color, Vector3 } from 'three';
import { audio } from '@/audio';
import { damp } from '@/engine/api';
import { createShortCircuit as createShortFx, createSmoke } from '@/fx';
import { Builder } from '@/kit';
import { UI_STATUS, col, heatRamp } from '@/style';
import { SHORT_CIRCUIT, createShortCircuit, type JumperPosition } from '@electricity/sim/current';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBattery } from '../parts/battery';
import { createBulb } from '../parts/bulb';
import { createFuse } from '../parts/fuse';
import { createJumper } from '../parts/jumper';
import { anchorIn, createLead, route } from '../parts/leads';
import { Schematic, type SchematicPart } from '../parts/schematic';
import { createSwitch } from '../parts/switch';
import { group } from '../world';

const ID = 'circuit';
/** Seats on the back row, in the order the conventional current meets them (from «+»). */
const SLOTS = [2.3, 0.3, -1.9] as const;
const ROW_Z = -1.7;
const ORDERS: readonly (readonly SchematicPart[])[] = [
  ['switch', 'fuse', 'lamp'],
  ['fuse', 'switch', 'lamp'],
  ['fuse', 'lamp', 'switch'],
];
/** Lamp power in normal operation (1,44 V × 0,288 A) — full brightness. */
const LAMP_W =
  SHORT_CIRCUIT.lampOhm * (SHORT_CIRCUIT.emfV / (SHORT_CIRCUIT.internalOhm + SHORT_CIRCUIT.lampOhm)) ** 2;

export const circuitStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const battery = createBattery();
  battery.group.position.set(0, 0, 1.9);
  const sw = createSwitch();
  const fuse = createFuse();
  const bulb = createBulb();
  const parts = { switch: sw.group, fuse: fuse.group, lamp: bulb.group };
  const seat = (part: SchematicPart, k: number, out: Vector3): Vector3 =>
    out.set(SLOTS[k]!, 0, part === 'lamp' ? ROW_Z + 0.24 : ROW_Z);
  ORDERS[0]!.forEach((p, k) => seat(p, k, parts[p].position));
  // a little engraved plate: the place of the «схема» hotspot
  const pb = new Builder('diagram-plate');
  pb.box(1.0, 0.06, 0.7, { rot: [-0.5, 0, 0], at: [0, 0.2, 0], r: 0.03, c: ['ink', 'slate'] });
  pb.box(0.1, 0.36, 0.1, { at: [0, 0, -0.05], r: 0.03, c: 'slate' });
  const plate = pb.build().group;
  plate.position.set(-2.9, 0, 0.5);
  const jumper = createJumper();
  set.add(battery.group, sw.group, fuse.group, bulb.group, plate, jumper.group);

  const T = ROW_Z + 0.24;
  const term = (k: number, s: 1 | -1): Vector3 => new Vector3(SLOTS[k]! + s * 0.58, 0.16, T);
  const leads = [
    createLead(
      route(anchorIn(set, battery.plus), term(0, 1), [
        [3.6, 1.9],
        [3.6, T],
      ]),
    ),
    createLead([term(0, -1), term(1, 1)], { bend: 0 }),
    createLead([term(1, -1), term(2, 1)], { bend: 0 }),
    createLead(
      route(term(2, -1), anchorIn(set, battery.minus), [
        [-3.6, T],
        [-3.6, 1.9],
      ]),
    ),
  ];
  set.add(...leads.map((l) => l.mesh));
  const burst = createShortFx(ctx, { size: 1.4 });
  const smoke = createSmoke(ctx, { radius: 0.08, height: 1.3, count: 14 });
  smoke.setEmitting(false, true);
  set.add(burst, smoke);

  /* ------------------------------------------------------------------------------------- state */
  const sim = createShortCircuit({ switchClosed: false, jumper: 'none', fuseInstalled: true });
  const diagram = new Schematic();
  let wasBlown = false;
  const place = (): number => Number(ui.value<string>('pos5'));
  const jumperAt = (): JumperPosition => ui.value<JumperPosition>('jumper5');
  const PARK = new Vector3(0.3, 0, 0.4);
  const targetOf = (j: JumperPosition, out: Vector3): Vector3 =>
    j === 'lamp'
      ? out.copy(bulb.group.position)
      : j === 'battery'
        ? out.copy(battery.group.position)
        : out.copy(PARK);
  const v = new Vector3();
  const BASE = col('steel').lerp(col('slate'), 0.55);
  const base = new Color();
  const hot = new Color();
  ctx.input.register(sw.group, {
    tooltip: DOC.switch,
    cursor: 'pointer',
    click: () => ui.set('sw5', !ui.value<boolean>('sw5'), { notify: true }),
    enabled: () => bench.isCurrent(ID),
  });
  ctx.input.register(jumper.group, {
    tooltip: OWN.jumper,
    cursor: 'grab',
    dragStart: () => {
      jumper.held = true;
      ui.set('jumper5', 'none', { notify: true });
    },
    drag: (e) => {
      const p = e.planePoint(v.set(0, 1, 0), bench.top.getWorldPosition(new Vector3()));
      if (p) jumper.target.copy(set.worldToLocal(p.clone())).setY(0).z -= 0.45;
    },
    dragEnd: () => {
      jumper.held = false;
      // snap to the nearest of the three places
      const options: JumperPosition[] = ['none', 'lamp', 'battery'];
      const here = jumper.target.clone();
      const best = options.reduce((a, b) =>
        targetOf(a, v).distanceTo(here) <= targetOf(b, new Vector3()).distanceTo(here) ? a : b,
      );
      ui.set('jumper5', best, { notify: true });
    },
    enabled: () => bench.isCurrent(ID),
  });
  ui.onChange('sw5', () => audio.play('relay'));
  ctx.qa.probe('jumper5', () => jumper.group.localToWorld(new Vector3(0, 0.24, 0.6))); // middle of the arch
  // where the pointer has to let go for each place (the jumper is carried by the middle of its arch)
  for (const j of ['lamp', 'battery'] as const)
    ctx.qa.probe(`drop5:${j}`, () =>
      set.localToWorld(targetOf(j, new Vector3()).add(new Vector3(0, 0.2, 0.45))),
    );
  ctx.qa.probe('switch5', sw.handle);
  ctx.qa.expose('circuit', () => ({
    ...sim.state,
    place: place(),
    jumper: jumperAt(),
    installed: fuse.installed,
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.6, 8.0, 9.0],
        target: [0, 0.5, 0.1],
        fov: 30,
        frameAspect: 1.1,
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [0, 0.6, 0], radius: 4.5 },
      },
    },
    stage: {
      show: [
        battery.group,
        sw.group,
        fuse.group,
        bulb.group,
        plate,
        jumper.group,
        ...leads.map((l) => l.mesh),
      ],
      enter: () => {
        sim.set({ switchClosed: false, jumper: 'none', fuseInstalled: true });
        sim.replaceFuse();
        wasBlown = false;
        smoke.setEmitting(false, true);
        sw.closed = false;
        sw.snap();
        jumper.group.position.copy(PARK);
      },
    },
    ui: {
      reset: true,
      hint: OWN.hintCircuit,
      honesty: ['simplified'],
      board: {
        title: OWN.diagram,
        size: 'sm',
        children: [{ type: 'custom', id: 'diagram5', node: diagram }],
      },
      controls: [
        { type: 'toggle', id: 'sw5', label: DOC.switch, value: false },
        { type: 'toggle', id: 'fuse5', label: DOC.fuse, value: true },
        {
          type: 'segmented',
          id: 'jumper5',
          label: OWN.jumper,
          items: [
            { id: 'none', label: OWN.jumperOff },
            { id: 'lamp', label: OWN.jumperLamp },
            { id: 'battery', label: OWN.jumperBattery },
          ],
          value: 'none',
        },
        {
          type: 'segmented',
          id: 'pos5',
          label: OWN.switchPlace,
          items: OWN.switchPlaces.map((label, k) => ({ id: String(k), label })),
          value: '0',
        },
        {
          type: 'gauge',
          id: 'temp5',
          kind: 'linear',
          label: OWN.batteryTemp,
          min: 20,
          max: 80,
          unit: '°C',
          digits: 0,
          zones: [
            { from: 20, to: 45, color: UI_STATUS.ok },
            { from: 45, to: 60, color: UI_STATUS.warning },
            { from: 60, to: 80, color: UI_STATUS.alarm },
          ],
          get: () => sim.state.batteryTemperatureC,
        },
        {
          type: 'note',
          id: 'short5',
          text: OWN.dontRepeat,
          icon: 'warning',
          color: 'red',
          visible: () => sim.state.batteryShorted,
        },
        {
          type: 'note',
          id: 'scope5',
          text: DOC.fuseScope,
          icon: 'info',
          color: 'amber',
          visible: () => jumperAt() === 'battery',
        },
        {
          type: 'note',
          id: 'hot5',
          text: DOC.overheat,
          icon: 'warning',
          color: 'red',
          visible: () => sim.state.overheatWarning,
        },
        {
          type: 'button',
          id: 'new5',
          label: DOC.newFuse,
          icon: 'plus',
          onClick: () => (sim.replaceFuse(), audio.play('click')),
          visible: () => sim.state.fuseBlown,
        },
      ],
      callouts: [
        { anchor: bulb.glass, text: OWN.lamp, side: 'up' },
        {
          anchor: fuse.wire,
          text: () => (fuse.installed ? DOC.fuse : DOC.noFuse),
          side: 'up',
          color: 'amber',
        },
        { anchor: sw.handle, text: DOC.switch, side: 'up' },
        {
          anchor: () => jumper.group.getWorldPosition(v).setY(v.y + 0.3),
          text: OWN.jumper,
          color: 'orange',
          side: 'down',
        },
      ],
      hotspots: [
        { anchor: () => fuse.wire.getWorldPosition(v).setZ(v.z + 0.55), content: 'fuse-wire' },
        { anchor: () => plate.getWorldPosition(v).setY(v.y + 0.3), content: 'schematic' },
      ],
    },
    update(dt, t) {
      const on = bench.isCurrent(ID);
      if (on)
        sim.set({
          switchClosed: ui.value<boolean>('sw5'),
          jumper: jumper.held ? 'none' : jumperAt(),
          fuseInstalled: ui.value<boolean>('fuse5'),
        });
      const st = on ? sim.step(dt) : sim.state;
      // the three components glide to the seats of the chosen order
      const order = ORDERS[place()] ?? ORDERS[0]!;
      order.forEach((p, k) => {
        const g = parts[p];
        seat(p, k, v);
        g.position.x = damp(g.position.x, v.x, 7, dt);
      });
      sw.closed = on && ui.value<boolean>('sw5');
      sw.update(dt);
      fuse.installed = ui.value<boolean>('fuse5');
      fuse.blown = st.fuseBlown;
      fuse.load = st.fuseCurrentA / SHORT_CIRCUIT.fuseRatedA;
      fuse.update(t);
      if (st.fuseBlown && !wasBlown && on) {
        set.worldToLocal(fuse.wire.getWorldPosition(v));
        burst.fire([v.x, v.y, v.z]);
        smoke.position.copy(v);
        smoke.setEmitting(true);
        ctx.stage.scope.delay(1.4, () => smoke.setEmitting(false));
        audio.play('spark');
        ui.toast(OWN.fuseBlew, { tone: 'warning' });
      }
      wasBlown = st.fuseBlown;
      const i = on ? st.fuseCurrentA : 0;
      const k = Math.min(i / 7, 1);
      // normal 0,29 A: calm pulses; short circuit: racing, blinding pulses and wires heating toward red
      base.copy(BASE);
      if (k > 0.25) base.lerp(heatRamp(k, hot), k * (0.75 + 0.25 * Math.sin(t * 9)));
      for (const lead of leads) {
        lead.drive(i > 0 ? 0.5 + 3.2 * k : 0, i > 0 ? 0.6 + 2.2 * k : 0);
        lead.tint(base);
      }
      bulb.brightness = on ? Math.sqrt(Math.min(st.lampPowerW / LAMP_W, 1)) : 0;
      bulb.update(t);
      battery.heat = Math.min(
        Math.max((st.batteryTemperatureC - SHORT_CIRCUIT.ambientC) / 50, st.batteryShorted ? 0.25 : 0),
        1,
      );
      if (!jumper.held) {
        targetOf(jumperAt(), jumper.target);
        jumper.span = jumperAt() === 'battery' ? 2.24 : 1.16;
      }
      jumper.heat = st.batteryShorted && jumperAt() !== 'none' ? 0.75 + 0.2 * Math.sin(t * 11) : 0;
      jumper.update(dt, t);
      diagram.set({
        order: [...order].reverse(),
        closed: sw.closed,
        fuseInstalled: fuse.installed,
        fuseBlown: st.fuseBlown,
        lamp: bulb.brightness,
        jumper: jumper.held ? 'none' : jumperAt(),
        live: i > 0.01,
        short: st.batteryShorted,
      });
      bench.live.buzz = st.batteryShorted ? 1 : i > 0 ? 0.25 : 0;
    },
  };
};
