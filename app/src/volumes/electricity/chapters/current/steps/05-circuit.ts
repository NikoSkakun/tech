/**
 * Step 5 `circuit` — closed, open and short circuit. AA cell → switch → fuse → lamp → back, with the standard
 * diagram on the board. A copper jumper can be dragged onto the lamp's terminals (the short-circuit current
 * runs through the fuse, which blows) or straight onto the battery holder (bypassing switch and fuse: the
 * cell heats up). The switch can sit in any of three places of the loop. Model: `createShortCircuit` (§5).
 */
import { Color, Vector3, type Group } from 'three';
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
import { createJumper, createJumperGhost } from '../parts/jumper';
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

/**
 * The circuit's diagram engraved on the little plate (so it reads as a plaque, not a blank stand-in): the
 * loop with a lamp ⊗, a fuse ▭, a switch and a cell, in plate-surface coordinates.
 */
/** The plate leans back toward the viewer, so its face (and the engraving) is seen, not its edge. */
const PLATE_TILT = 0.75;

function engraving(): Group {
  const b = new Builder('diagram-engraving');
  const line = (x0: number, z0: number, x1: number, z1: number): void => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    b.box(len, 0.02, 0.03, {
      at: [(x0 + x1) / 2, 0.045, (z0 + z1) / 2],
      rot: [0, -Math.atan2(z1 - z0, x1 - x0), 0],
      r: 0,
      c: 'cyan',
    });
  };
  const [L, R, T, B] = [-0.38, 0.38, -0.2, 0.2];
  line(L, T, -0.26, T); // top rail: lamp, fuse, switch
  line(-0.1, T, -0.02, T);
  line(0.14, T, 0.2, T);
  line(0.31, T - 0.07, 0.2, T); // the open blade of the switch
  line(0.3, T, R, T);
  line(R, T, R, B);
  line(R, B, 0.04, B); // bottom rail with the cell
  line(-0.04, B, L, B);
  line(L, B, L, T);
  b.ring(0.075, 0.02, { at: [-0.18, 0.045, T], seg: 24, c: 'cyan' });
  line(-0.23, T - 0.05, -0.13, T + 0.05);
  line(-0.23, T + 0.05, -0.13, T - 0.05);
  b.box(0.16, 0.02, 0.07, { at: [0.06, 0.045, T], r: 0, c: 'cyan' });
  b.box(0.022, 0.02, 0.16, { at: [0.04, 0.045, B], r: 0, c: 'coral' }); // «+»: the long plate
  b.box(0.022, 0.02, 0.09, { at: [-0.04, 0.045, B], r: 0, c: 'sky' });
  const g = b.build().group;
  g.rotation.x = PLATE_TILT; // lies on the plate's tilted face
  g.position.y = 0.2;
  return g;
}

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
  pb.box(1.0, 0.06, 0.7, { rot: [PLATE_TILT, 0, 0], at: [0, 0.2, 0], r: 0.03, c: 'ink' });
  pb.box(0.1, 0.36, 0.1, { at: [0, 0, -0.05], r: 0.03, c: 'slate' });
  const plate = pb.build().group;
  plate.add(engraving());
  plate.position.set(-2.9, 0, 0.5);
  const jumper = createJumper();
  // glowing outlines where the jumper can go: on the lamp while it is parked, on both places while carried
  const ghosts = { lamp: createJumperGhost(), battery: createJumperGhost() };
  ghosts.battery.span = 2.24;
  set.add(battery.group, sw.group, fuse.group, bulb.group, plate, jumper.group);
  set.add(ghosts.lamp.group, ghosts.battery.group);

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
  const w = new Vector3();
  /** The nearest of the three places to a point of the table (where a carried jumper snaps). */
  const nearestPlace = (here: Vector3): JumperPosition =>
    (['none', 'lamp', 'battery'] as const).reduce((a, b) =>
      targetOf(a, v).distanceTo(here) <= targetOf(b, w).distanceTo(here) ? a : b,
    );
  const BASE = col('steel').lerp(col('slate'), 0.55);
  const base = new Color();
  const hot = new Color();
  // tap the switch to flip it; drag it along the row to another place in the circuit (script: «drag
  // тумблера в інше місце кола»): the other two parts make room while it is carried
  let swHeldX: number | null = null;
  const nearestSlot = (x: number): number =>
    SLOTS.reduce((best, s, k) => (Math.abs(s - x) < Math.abs(SLOTS[best]! - x) ? k : best), 0);
  ctx.input.register(sw.group, {
    tooltip: DOC.switch,
    cursor: 'grab',
    click: () => ui.set('sw5', !ui.value<boolean>('sw5'), { notify: true }),
    dragStart: () => (swHeldX = sw.group.position.x),
    drag: (e) => {
      const p = e.planePoint(v.set(0, 1, 0), bench.top.getWorldPosition(w));
      if (p) swHeldX = Math.min(Math.max(set.worldToLocal(p).x, SLOTS[2]), SLOTS[0]);
    },
    dragEnd: () => {
      if (swHeldX === null) return;
      ui.set('pos5', String(nearestSlot(swHeldX)), { notify: true });
      swHeldX = null;
    },
    enabled: () => bench.isCurrent(ID),
  });
  for (let k = 0; k < SLOTS.length; k++)
    ctx.qa.probe(`seat5:${k}`, () => set.localToWorld(new Vector3(SLOTS[k], 0.3, ROW_Z)));
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
      ui.set('jumper5', nearestPlace(jumper.target), { notify: true });
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
        ghosts.lamp.group,
        ghosts.battery.group,
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
        swHeldX = null;
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
      const order = ORDERS[swHeldX !== null ? nearestSlot(swHeldX) : place()] ?? ORDERS[0]!;
      order.forEach((p, k) => {
        const g = parts[p];
        seat(p, k, v);
        if (p === 'switch' && swHeldX !== null) v.x = swHeldX;
        g.position.x = damp(g.position.x, v.x, swHeldX !== null && p === 'switch' ? 30 : 7, dt);
      });
      sw.group.position.y = damp(sw.group.position.y, swHeldX !== null ? 0.25 : 0, 12, dt);
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
      const near = nearestPlace(jumper.target);
      for (const j of ['lamp', 'battery'] as const) {
        const ghost = ghosts[j];
        targetOf(j, ghost.group.position);
        ghost.strength = jumper.held ? (near === j ? 1 : 0.4) : j === 'lamp' && jumperAt() === 'none' ? 0.85 : 0;
        ghost.update(t);
      }
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
