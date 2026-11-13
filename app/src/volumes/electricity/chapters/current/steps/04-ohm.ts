/**
 * Step 4 `ohm` — resistance and Ohm's law. A laboratory supply (0…12 V, current limit 3 A) feeds a wire sample
 * on a test rig; a voltmeter sits across it, an ammeter in series (it can be moved to the other side of the
 * sample: same reading). Recorded (U, I) points line up on the board's chart. Model: `ohmBench` (§4).
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit } from '@/content';
import { damp } from '@/engine/api';
import { Builder } from '@/kit';
import {
  BENCH_MATERIALS,
  OHM_BENCH,
  ohmBench,
  type BenchMaterial,
  type BenchReading,
  type BenchSample,
} from '@electricity/sim/current';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBulb } from '../parts/bulb';
import { anchorIn, createLead, route } from '../parts/leads';
import { createLens } from '../parts/lens';
import { createMeter } from '../parts/meter';
import { createOhmBench, OHM_RIG } from '../parts/ohm-bench';
import { createSupply } from '../parts/supply';
import { group } from '../world';
import { ohmBoard, type OhmPoint } from './04-ohm-board';

const ID = 'ohm';
const MATERIALS = Object.keys(BENCH_MATERIALS) as BenchMaterial[];

export const ohmStep: StepFactory = (bench) => {
  const { ctx, ui, mats } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const supply = createSupply();
  supply.group.position.set(-0.9, 0, -2.3);
  const rig = createOhmBench();
  rig.group.position.set(0, 0, 0.6);
  const lamp = createBulb(0.72);
  lamp.group.position.set(0, 0.1, 0);
  // the lamp sample with its two straps to the clamp jaws
  const straps = new Builder('lamp-straps');
  for (const s of [-1, 1] as const)
    straps.rod([s * OHM_RIG.x1, OHM_RIG.y, 0], [s * 0.42, 0.24, 0], 0.03, { slot: 'metal', c: 'orange' });
  const lampSet = group('lamp-sample', 0, 0, 0, [lamp.group, straps.build().group]);
  rig.group.add(lampSet);
  const amm = createMeter('A');
  const POS = [new Vector3(2.2, 0, -0.9), new Vector3(-2.2, 0, -0.9)] as const;
  amm.group.position.copy(POS[0]);
  const volt = createMeter('V');
  volt.group.position.set(0, 0, 2.5);
  set.add(supply.group, rig.group, amm.group, volt.group);

  // two wirings: ammeter before the sample (0) or after it (1)
  const at = (p: Vector3, dx: number): Vector3 => new Vector3(p.x + dx, 0.16, p.z + 0.24);
  const plus = anchorIn(set, supply.plus);
  const minus = anchorIn(set, supply.minus);
  const ra = anchorIn(set, rig.a);
  const rb = anchorIn(set, rig.b);
  const east: [number, number][] = [
    [2.95, -0.66],
    [2.95, 0.2],
  ];
  const west: [number, number][] = [
    [-2.95, -0.66],
    [-2.95, -2.3],
  ];
  const wirings = [
    [
      createLead(route(plus, at(POS[0], -0.58), [[1.62, -2.3]])),
      createLead(route(at(POS[0], 0.58), rb, east)),
      createLead(
        route(ra, minus, [
          [-2.95, 0.2],
          [-2.95, -2.3],
        ]),
      ),
    ],
    [
      createLead(
        route(plus, rb, [
          [2.95, -2.3],
          [2.95, 0.2],
        ]),
      ),
      createLead([ra, at(POS[1], 0.58)], { bend: 0 }),
      createLead(route(at(POS[1], -0.58), minus, west)),
    ],
  ].map((leads, k) => {
    const g = new Group();
    g.name = `wiring${k}`;
    g.add(...leads.map((l) => l.mesh));
    set.add(g);
    return { g, leads };
  });
  const sense = [
    createLead(route(anchorIn(set, rig.va), anchorIn(set, volt.a), [[-1.5, 2.74]]), {
      radius: 0.032,
      color: 'teal',
    }),
    createLead(route(anchorIn(set, volt.b), anchorIn(set, rig.vb), [[1.5, 2.74]]), {
      radius: 0.032,
      color: 'teal',
    }),
  ];
  set.add(...sense.map((l) => l.mesh));
  const lens = createLens(ctx, mats, [-1.55, 0.45, 1.9]);
  lens.group.position.set(-0.95, OHM_RIG.y, 0.6);
  set.add(lens.group);
  ctx.stage.actor(lampSet);
  ctx.stage.actor(wirings[1]!.g);

  /* ------------------------------------------------------------------------------------- state */
  let side = 0; // 0: ammeter before the sample, 1: after
  let lampMode = false;
  let slide = 0;
  const points: OhmPoint[] = [];
  let lastAuto = Number.NaN;
  const sample = (): BenchSample =>
    ui.value<string>('kind4') === 'lamp'
      ? { kind: 'lamp' }
      : {
          kind: 'wire',
          material: ui.value<BenchMaterial>('mat4'),
          lengthM: ui.value<number>('len4'),
          areaMm2: ui.value<number>('area4'),
        };
  const reading = (): BenchReading => ohmBench(ui.value<number>('u4'), sample());
  const record = (): void => {
    const r = reading();
    points.push({ u: r.voltageV, i: r.currentA, cc: r.constantCurrent });
    if (points.length > 40) points.shift();
    board.dirty();
  };
  const board = ohmBoard({ points, reading, sample, record, clear: () => (points.length = 0) });
  // auto-record every 0,5 V while the U slider moves
  ui.onChange('u4', (u) => {
    const step = Math.round(Number(u) / OHM_BENCH.autoRecordStepV);
    if (step !== lastAuto && bench.isCurrent(ID)) {
      lastAuto = step;
      record();
    }
  });
  const swap = (): void => {
    side = 1 - side;
    audio.play('click');
    ctx.stage.toggle(wirings[0]!.g, side === 0);
    ctx.stage.toggle(wirings[1]!.g, side === 1);
  };
  ctx.qa.probe('sample4', rig.sample);
  ctx.qa.expose('ohm', () => ({
    ...reading(),
    points: points.length,
    side,
    lampMode,
    ammeter: amm.text,
    voltmeter: volt.text,
  }));
  const v = new Vector3();
  const lampOnly = (): boolean => lampMode;

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.7, 8.4, 9.0],
        target: [0, 0.55, 0],
        fov: 30,
        frameAspect: 1.05, // the board takes the left of the screen: compose for a squarer free area
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [0, 0.9, 0], radius: 4.7 },
      },
    },
    stage: {
      show: [
        supply.group,
        rig.group,
        rig.wire,
        amm.group,
        volt.group,
        wirings[0]!.g,
        lens.group,
        ...sense.map((l) => l.mesh),
      ],
      enter: () => {
        side = 0;
        slide = 0;
        lampMode = false;
        ui.set('kind4', 'wire');
        points.length = 0;
        lastAuto = Number.NaN;
        board.dirty();
      },
    },
    ui: {
      hint: OWN.hintOhm,
      honesty: ['notToScale', { kind: 'simplified', visible: lampOnly }],
      board: board.spec,
      controls: [
        {
          type: 'slider',
          id: 'u4',
          label: OWN.supplyU,
          ...OHM_BENCH.supplyRangeV,
          value: OHM_BENCH.supplyRangeV.default,
          unit: 'V',
          digits: 1,
        },
        {
          type: 'segmented',
          id: 'kind4',
          items: [
            { id: 'wire', label: DOC.samples[0]! },
            { id: 'lamp', label: DOC.samples[1]! },
          ],
          value: 'wire',
        },
        {
          type: 'segmented',
          id: 'mat4',
          items: MATERIALS.map((m, k) => ({ id: m, label: DOC.materials[k]! })),
          value: 'NiCr',
          disabled: lampOnly,
        },
        {
          type: 'slider',
          id: 'len4',
          label: OWN.length,
          min: OHM_BENCH.lengthRangeM.min,
          max: OHM_BENCH.lengthRangeM.max,
          value: OHM_BENCH.lengthRangeM.default,
          scale: 'log',
          step: 2,
          unit: 'm',
          disabled: lampOnly,
        },
        {
          type: 'slider',
          id: 'area4',
          label: OWN.areaA,
          min: OHM_BENCH.areaRangeMm2.min,
          max: OHM_BENCH.areaRangeMm2.max,
          value: OHM_BENCH.areaRangeMm2.default,
          scale: 'log',
          step: 2,
          unit: 'mm²',
          disabled: lampOnly,
        },
        {
          type: 'note',
          id: 'cc4',
          text: OWN.ccNote,
          icon: 'warning',
          color: 'amber',
          visible: () => reading().constantCurrent,
        },
        { type: 'button', id: 'swap4', label: OWN.moveAmmeter, icon: 'resetView', onClick: swap },
      ],
      callouts: [
        { anchor: amm.dial, text: OWN.ammeter, side: 'up' },
        { anchor: volt.dial, text: OWN.voltmeter, side: 'right' },
        {
          anchor: supply.ccLamp,
          text: DOC.cc,
          color: 'amber',
          side: 'down',
          visible: () => reading().constantCurrent,
        },
      ],
      hotspots: [
        { anchor: rig.spool, content: 'wire-spool', visible: () => !lampMode },
        { anchor: () => supply.ccLamp.getWorldPosition(v).setX(v.x + 0.6), content: 'cc-indicator' },
        {
          anchor: () => rig.sample.getWorldPosition(v).setX(v.x + 0.35),
          content: 'thick-vs-thin',
          visible: () => !lampMode,
        },
        { anchor: () => amm.dial.getWorldPosition(v).setX(v.x + 0.75), content: 'ammeter' },
      ],
    },
    update(dt, t) {
      const on = bench.isCurrent(ID);
      const s = sample();
      const r = reading();
      if (on && (s.kind === 'lamp') !== lampMode) {
        lampMode = s.kind === 'lamp';
        ctx.stage.toggle(rig.wire, !lampMode);
        ctx.stage.toggle(lampSet, lampMode);
        ctx.stage.toggle(lens.group, !lampMode);
      }
      const i = on ? r.currentA : 0;
      if (s.kind === 'wire') rig.set(s.material, s.lengthM, s.areaMm2, on ? r.glow : 0);
      lamp.brightness = lampMode && on ? Math.sqrt(Math.min(r.powerW / OHM_BENCH.lamp.ratedW, 1)) : 0;
      lamp.update(t);
      supply.set(r.voltageV, i, r.constantCurrent);
      supply.update(t);
      slide = damp(slide, side, 8, dt);
      amm.group.position.lerpVectors(POS[0], POS[1], slide);
      amm.value = i / OHM_BENCH.currentLimitA;
      amm.text = fmtUnit(i, 'A', { digits: 2 });
      amm.update(dt);
      volt.value = r.voltageV / OHM_BENCH.supplyRangeV.max;
      volt.text = fmtUnit(r.voltageV, 'V', { digits: 2 });
      volt.update(dt);
      for (const w of wirings)
        for (const lead of w.leads) lead.drive(1.2 * i, i > 0 ? 0.3 + Math.min(r.powerW / 20, 1.1) : 0);
      // lens: drift ∝ I; scattering grows with the sample's resistance (decades above 0,1 Ω), heat = Joule glow
      lens.drift = 0.3 * i;
      lens.agitation = Math.min(Math.max((Math.log10(r.resistanceOhm) + 1) / 3, 0), 1);
      lens.heat = r.glow;
      lens.update(dt, t, ctx.camera.camera);
      bench.live.buzz = Math.min(r.powerW / 36, 1) * 0.7;
    },
  };
};
