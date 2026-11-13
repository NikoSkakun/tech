/**
 * Step 9 `measure` — voltmeter, ammeter, multimeter and the internal resistance of a source. A battery, a
 * switch, a 5 Ω lamp and a removable link form the loop; the multimeter's probes snap to its eight terminals.
 * Every reading comes from the simulated meter (`readMeter`, §9: 10 MΩ voltmeter, 0,5 Ω / 0,4 A-fused mA input,
 * 0,01 Ω 10 A input, ohmmeter only on a dead circuit). The board collects U₀, U and I and works out r.
 */
import { Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit } from '@/content';
import { createFlash } from '@/fx';
import { K } from '@/style';
import {
  BATTERIES,
  MULTIMETER,
  internalResistanceFromMeasurements,
  readMeter,
  type BatteryId,
  type MeterDisplay,
  type MeterMode,
  type MeterReading,
  type Terminal,
} from '@electricity/sim/current';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBattery } from '../parts/battery';
import { createBulb } from '../parts/bulb';
import { createJumper } from '../parts/jumper';
import { anchorIn, createLead, route } from '../parts/leads';
import { createMultimeter, type Probe } from '../parts/multimeter';
import { createSwitch } from '../parts/switch';
import { group } from '../world';

const ID = 'measure';
const MODES: readonly MeterMode[] = ['off', 'vdc', 'vac', 'ohm', 'ma', 'a10'];
const BATTERY_IDS: readonly BatteryId[] = ['new', 'half', 'flat'];
/** Probe placements offered in the dock: [red, black]. */
const PLACES: Record<string, readonly [Terminal, Terminal] | null> = {
  park: null,
  battery: ['B+', 'B-'],
  lamp: ['La', 'Lb'],
  switch: ['Sa', 'Sb'],
  link: ['Ja', 'Jb'],
};
const PLACE_IDS = ['park', 'battery', 'lamp', 'switch', 'link', 'custom'] as const;

function show(d: MeterDisplay, mode: MeterMode): string {
  if (d.kind === 'off') return '';
  if (d.kind === 'OL') return 'OL';
  if (d.kind === 'FUSE') return 'FUSE';
  if (d.kind === 'error') return '– – –';
  if (d.unit === 'A' && mode === 'ma') return fmtUnit(d.value * 1000, 'mA', { digits: 0 });
  return fmtUnit(d.value, d.unit, { digits: d.unit === 'Ω' ? 1 : 2 });
}

export const measureStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const battery = createBattery();
  battery.group.position.set(0, 0, 2.2);
  const sw = createSwitch();
  sw.group.position.set(2.3, 0, -2.2);
  const bulb = createBulb();
  bulb.group.position.set(-1.0, 0, -1.96);
  const link = createJumper();
  const meter = createMultimeter();
  meter.group.position.set(1.15, 0, 0.75);
  set.add(battery.group, sw.group, bulb.group, link.group, meter.group, meter.leads);

  // the eight terminals of §9 (ideal leads join B+≡Sa, Sb≡La, Lb≡Ja, Jb≡B−)
  const JA = new Vector3(-3.3, 0.16, -0.6);
  const JB = new Vector3(-3.3, 0.16, 0.56);
  const term: Record<Terminal, Vector3> = {
    'B+': anchorIn(set, battery.plus),
    'B-': anchorIn(set, battery.minus),
    Sa: anchorIn(set, sw.b),
    Sb: anchorIn(set, sw.a),
    La: anchorIn(set, bulb.b),
    Lb: anchorIn(set, bulb.a),
    Ja: JA,
    Jb: JB,
  };
  const leads = [
    createLead(
      route(term['B+'], term.Sa, [
        [3.5, 2.2],
        [3.5, -1.96],
      ]),
    ),
    createLead([term.Sb, term.La], { bend: 0 }),
    createLead(route(term.Lb, JA, [[-3.3, -1.96]])),
    createLead(route(JB, term['B-'], [[-3.3, 2.2]])),
  ];
  set.add(...leads.map((l) => l.mesh));
  const flash = createFlash({ size: 1.6, color: 'red' });
  meter.fuse.add(flash);
  const PARK = { red: new Vector3(2.75, 0.02, 0.9), black: new Vector3(-0.45, 0.02, 0.9) };

  /* ------------------------------------------------------------------------------------- state */
  const at: { red: Terminal | null; black: Terminal | null } = { red: null, black: null };
  let fuseBlown = false;
  let key = '';
  let reading: MeterReading = readMeter({
    battery: 'new',
    switchClosed: false,
    mode: 'vdc',
    red: null,
    black: null,
    milliFuseBlown: false,
  });
  const log: { u0?: number; u?: number; i?: number } = {};
  const mode = (): MeterMode => ui.value<MeterMode>('mode9');
  const cell = (): BatteryId => ui.value<BatteryId>('bat9');
  const closed = (): boolean => ui.value<boolean>('sw9');
  const across = (a: Terminal, b: Terminal): boolean =>
    (at.red === a && at.black === b) || (at.red === b && at.black === a);
  const inSeries = (): boolean => (mode() === 'ma' || mode() === 'a10') && across('Ja', 'Jb');
  const placeProbes = (id: string): void => {
    const p = PLACES[id];
    if (p === undefined) return;
    [at.red, at.black] = p ?? [null, null];
  };
  const nearest = (p: Vector3): Terminal | null => {
    let best: Terminal | null = null;
    let d = 0.75;
    for (const [name, q] of Object.entries(term) as [Terminal, Vector3][]) {
      const k = Math.hypot(q.x - p.x, q.z - p.z);
      if (k < d) [best, d] = [name, k];
    }
    return best;
  };
  const v = new Vector3();
  (['red', 'black'] as const).forEach((which) => {
    const probe: Probe = meter[which];
    ctx.input.register(probe.group, {
      tooltip: which === 'red' ? OWN.probeRed : OWN.probeBlack,
      cursor: 'grab',
      dragStart: () => {
        probe.held = true;
        at[which] = null;
      },
      drag: (e) => {
        const p = e.planePoint(v.set(0, 1, 0), bench.top.getWorldPosition(new Vector3()));
        if (p) probe.target.copy(set.worldToLocal(p.clone())).setY(0.02);
      },
      dragEnd: () => {
        probe.held = false;
        at[which] = nearest(probe.target);
        // reflect a hand-made placement in the dock
        const match = Object.entries(PLACES).find(([, p]) =>
          p ? p[0] === at.red && p[1] === at.black : !at.red && !at.black,
        );
        ui.set('place9', match ? match[0] : 'custom');
        audio.play('tick');
      },
      enabled: () => bench.isCurrent(ID),
    });
    ctx.qa.probe(`probe9:${which}`, () => probe.group.localToWorld(new Vector3(0, 0.6, 0))); // on the handle
  });
  for (const [name, q] of Object.entries(term))
    ctx.qa.probe(`term9:${name}`, () => set.localToWorld(q.clone()));
  // where a probe can touch: rings on the terminals — a slow pulse while nothing is connected (an invitation
  // to drag a probe), the snap targets while one is carried (the nearest one bright)
  const ringSet = new Group();
  set.add(ringSet);
  const ringGeo = new TorusGeometry(0.22, 0.035, 8, 28).rotateX(Math.PI / 2);
  const rings = (Object.entries(term) as [Terminal, Vector3][]).map(([name, q]) => {
    const mat = K.glow({ color: 'cyan', intensity: 0, falloff: 0, whiten: 0, keepHue: true });
    const ring = new Mesh(ringGeo, mat);
    ring.position.set(q.x, Math.max(q.y, 0.1) + 0.06, q.z);
    ringSet.add(ring);
    return { name, ring, mat };
  });
  ctx.input.register(sw.group, {
    tooltip: DOC.switch,
    cursor: 'pointer',
    click: () => ui.set('sw9', !closed(), { notify: true }),
    enabled: () => bench.isCurrent(ID),
  });
  ctx.qa.probe('switch9', sw.handle);
  ui.onChange('place9', (id) => placeProbes(String(id)));
  ui.onChange('bat9', () => (log.u0 = log.u = log.i = undefined));
  ui.onChange('sw9', () => audio.play('relay'));
  ctx.qa.expose('measure', () => ({
    display: reading.display,
    text: meter.text,
    red: at.red,
    black: at.black,
    fuseBlown,
    short: reading.shortCircuit,
    lampA: reading.lampCurrentA,
    log: { ...log },
    r:
      log.u0 !== undefined && log.u !== undefined && log.i
        ? internalResistanceFromMeasurements(log.u0, log.u, log.i)
        : null,
  }));
  const cellNote = (): string =>
    `${fmtUnit(BATTERIES[cell()].emfV, 'V', { digits: 2 })} · ${fmtUnit(BATTERIES[cell()].internalOhm, 'Ω', { digits: 1 })}`;
  const val = (x: number | undefined, unit: string, digits: number): string =>
    x === undefined ? '—' : fmtUnit(x, unit, { digits });
  const rText = (): string => {
    if (log.u0 === undefined || log.u === undefined || !log.i) return '—';
    return fmtUnit(internalResistanceFromMeasurements(log.u0, log.u, log.i), 'Ω', { digits: 2 });
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.5, 8.3, 9.2],
        target: [0, 0.6, 0.1],
        fov: 30,
        frameAspect: 1.15,
        orbit: { azimuth: 0.7, polar: 0.3 },
        fit: { center: [0, 0.8, 0], radius: 4.7 },
      },
    },
    stage: {
      show: [
        battery.group,
        sw.group,
        bulb.group,
        link.group,
        meter.group,
        meter.leads,
        ringSet,
        ...leads.map((l) => l.mesh),
      ],
      enter: () => {
        fuseBlown = false;
        log.u0 = log.u = log.i = undefined;
        at.red = at.black = null;
        key = '';
        sw.closed = false;
        sw.snap();
      },
    },
    ui: {
      reset: true,
      hint: OWN.hintMeasure,
      honesty: ['illustrative'],
      board: {
        title: DOC.rCalc,
        size: 'sm',
        children: [
          {
            type: 'table',
            id: 'calc9',
            rows: () => [
              [OWN.calcU0, val(log.u0, 'V', 2)],
              [OWN.calcU, val(log.u, 'V', 2)],
              [OWN.calcI, val(log.i, 'A', 3)],
              ['r = (U₀ − U)/I', rText()],
              [OWN.cellData, cellNote()],
            ],
            highlight: () => (rText() === '—' ? -1 : 3),
            align: ['left', 'right'],
          },
          {
            type: 'note',
            id: 'live9',
            text: DOC.ohmLive,
            icon: 'warning',
            color: 'amber',
            visible: () => reading.display.kind === 'error' && reading.display.reason !== 'noProbes',
          },
          {
            type: 'note',
            id: 'fuse9n',
            text: DOC.seriesOnly,
            icon: 'warning',
            color: 'red',
            visible: () => reading.display.kind === 'FUSE',
          },
          {
            type: 'note',
            id: 'short9',
            text: DOC.shortWarn,
            icon: 'warning',
            color: 'red',
            visible: () => reading.shortCircuit,
          },
          {
            type: 'note',
            id: 'jack9',
            text: OWN.jackNote,
            icon: 'info',
            visible: () => mode() === 'ma' || mode() === 'a10',
          },
        ],
      },
      controls: [
        {
          type: 'segmented',
          id: 'mode9',
          label: OWN.dial,
          items: MODES.map((id, k) => ({ id, label: DOC.modes[k]!.replace(/ \(.*\)/, '') })),
          value: 'vdc',
        },
        {
          type: 'segmented',
          id: 'place9',
          label: OWN.probes,
          items: PLACE_IDS.map((id, k) => ({ id, label: OWN.places[k]! })),
          value: 'park',
        },
        {
          type: 'segmented',
          id: 'bat9',
          label: OWN.cell,
          items: BATTERY_IDS.map((id, k) => ({ id, label: OWN.cells[k]! })),
          value: 'new',
        },
        { type: 'toggle', id: 'sw9', label: DOC.switch, value: false },
        {
          type: 'button',
          id: 'fuse9',
          label: DOC.replaceFuse,
          icon: 'plus',
          onClick: () => ((fuseBlown = false), (key = ''), audio.play('click')),
          visible: () => fuseBlown,
        },
      ],
      callouts: [
        {
          anchor: () => link.group.getWorldPosition(v).setY(v.y + 0.35),
          text: DOC.jumper,
          color: 'orange',
          side: 'left',
        },
        { anchor: bulb.glass, text: OWN.lamp5, side: 'up' },
      ],
      hotspots: [
        { anchor: meter.com, content: 'com-jack' },
        { anchor: () => meter.fuse.getWorldPosition(v).setX(v.x + 0.35), content: 'meter-fuse' },
      ],
    },
    update(dt, t) {
      const on = bench.isCurrent(ID);
      const setup = {
        battery: cell(),
        switchClosed: closed(),
        mode: mode(),
        red: meter.red.held ? null : at.red,
        black: meter.black.held ? null : at.black,
        milliFuseBlown: fuseBlown,
      };
      const next = JSON.stringify(setup);
      if (on && next !== key) {
        key = next;
        reading = readMeter(setup);
        if (reading.blowsFuse) {
          fuseBlown = true;
          flash.fire();
          audio.play('spark');
          ui.toast(DOC.seriesOnly, { tone: 'alarm' });
        }
        // the calculator fills itself from proper measurements on the battery / in the break
        const d = reading.display;
        if (d.kind === 'value' && d.unit === 'V' && setup.mode === 'vdc' && across('B+', 'B-')) {
          if (setup.switchClosed) log.u = Math.abs(d.value);
          else log.u0 = Math.abs(d.value);
        }
        if (d.kind === 'value' && d.unit === 'A' && inSeries() && setup.switchClosed)
          log.i = Math.abs(d.value);
      }
      meter.mode = mode();
      meter.fuseBlown = fuseBlown;
      meter.text = show(reading.display, mode());
      const carried = meter.red.held ? meter.red : meter.black.held ? meter.black : null;
      const idle = !carried && !at.red && !at.black;
      const snap = carried ? nearest(carried.target) : null;
      for (const r of rings) {
        r.ring.visible = idle || carried !== null;
        r.mat.intensity = carried ? (r.name === snap ? 1.8 : 0.55) : 0.35 + 0.25 * Math.sin(t * 3);
      }
      for (const which of ['red', 'black'] as const) {
        const probe = meter[which];
        if (probe.held) continue;
        const where = at[which];
        probe.target.copy(where ? term[where] : PARK[which]).setY(where ? 0.3 : 0.02);
        // the parked red probe hops now and then: "pick me up"
        if (idle && which === 'red' && !ctx.reducedMotion)
          probe.target.y += 0.3 * Math.max(Math.sin(t * 2.1), 0) ** 12;
      }
      meter.update(dt, t);
      // the link steps aside when the meter takes its place in the loop
      link.target.set(inSeries() ? -4.0 : -3.3, 0, inSeries() ? 0.6 : -0.02);
      link.group.rotation.y = -Math.PI / 2;
      link.heat = 0;
      link.update(dt, t);
      sw.closed = on && closed();
      sw.update(dt);
      const iNom = BATTERIES.new.emfV / (BATTERIES.new.internalOhm + MULTIMETER.lampOhm);
      const i = on ? reading.lampCurrentA : 0;
      bulb.brightness = Math.min(Math.abs(i) / iNom, 1); // ∝ √P for a fixed 5 Ω
      bulb.update(t);
      for (const lead of leads)
        lead.drive(i > 1e-3 ? 0.4 + 1.6 * (i / iNom) : 0, i > 1e-3 ? 0.35 + 0.7 * (i / iNom) : 0);
      battery.heat = reading.shortCircuit ? 0.55 + 0.1 * Math.sin(t * 9) : 0;
      bench.live.buzz = reading.shortCircuit ? 0.9 : i > 1e-3 ? 0.2 : 0;
    },
  };
};
