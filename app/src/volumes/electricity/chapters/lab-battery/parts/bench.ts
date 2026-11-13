/**
 * The test bench of steps 6–7: a 21700 NMC cell and a 100 Ah LFP brick in holders, each with a level tube
 * (state of charge) and a small coil that glows with the heat of its internal resistance; an instrument
 * (electronic load / charger) with two dials, a fan and CC / CV lamps; leads carrying energy pulses whose
 * speed and brightness follow the current; a chamber thermometer with frost below 0 °C.
 */
import { type Group, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { damp, type ChapterContext } from '@/engine/api';
import { applyHeat, createHalo, createParticles, boxEmitter, createWire, type Wire } from '@/fx';
import { Builder, levelTube, type LevelTube } from '@/kit';
import { K, temperatureRamp } from '@/style';
import type { BenchCell } from '../sim-bindings/runs';
import type { Mats } from '../world';
import { group, mesh } from '../world';
import { heroCell, lfpBrick } from './cells';

export interface BenchCellState {
  active: boolean;
  /** 0…1. */
  soc: number;
  /** Signed current in C units: + charges the cell, − discharges it. */
  cRate: number;
  /** Heat power relative to the "hot" reference, 0…1+. */
  heat: number;
}

export interface Bench {
  group: Group;
  device: Group;
  station: Record<BenchCell, Group>;
  thermometer: Group;
  state: Record<BenchCell, BenchCellState>;
  /** Needles 0…1 of the current and voltage dials; CC / CV lamps. */
  meters: { current: number; voltage: number; cc: boolean; cv: boolean };
  /** Chamber temperature, °C. */
  temperature: number;
  update(dt: number, t: number): void;
}

export function createBench(ctx: ChapterContext, mats: Mats): Bench {
  const g = group('bench');
  // table
  const tb = new Builder('table');
  tb.box(6.6, 0.16, 2.3, { at: [0, 0.5, 0], r: 0.06, c: ['slate', 'steel'] });
  for (const [x, z] of [
    [-3, -0.9],
    [3, -0.9],
    [-3, 0.9],
    [3, 0.9],
  ] as const)
    tb.cyl(0.09, 0.5, { at: [x, 0, z], seg: 12, slot: 'metal', c: 'slate' });
  tb.box(6.3, 0.06, 0.1, { at: [0, 0.22, -0.9], r: 0.02, slot: 'metal', c: 'slate' });
  g.add(tb.build().group);
  const TOP = 0.66;

  /* ------------------------------------------------------------------------------------ stations */
  const nmc = heroCell('violet', '21700', 0.6).group;
  nmc.rotation.y = 0.35;
  const bodies: Record<BenchCell, { body: Group; x: number; h: number }> = {
    '21700-NMC': { body: nmc, x: -2.35, h: 1.5 },
    'LFP-100': { body: lfpBrick().group, x: -0.75, h: 1.3 },
  };
  const coilGeometry = new TorusGeometry(0.11, 0.028, 10, 28);
  const station = {} as Bench['station'];
  const parts = {} as Record<
    BenchCell,
    {
      level: LevelTube;
      coil: ReturnType<typeof K.toon>;
      holder: Group;
      halo: ReturnType<typeof createHalo>;
      shown: BenchCellState;
    }
  >;
  for (const id of Object.keys(bodies) as BenchCell[]) {
    const { body, x } = bodies[id];
    const st = group(`station:${id}`, x, TOP, 0.1);
    st.add(mesh(new RoundedBoxGeometry(1.25, 0.12, 0.9, 3, 0.04), mats.dark, 0, 0.06, 0));
    body.position.y = 0.12;
    st.add(body);
    // level tube (kit): lime column = state of charge
    const level = levelTube({ height: 1.2, radius: 0.11, color: 'lime', level: 1 });
    level.group.position.set(0.52, 0.12, 0.3);
    st.add(level.group);
    // internal resistance: a little heater coil on the front that glows with I·(U_OCV − U)
    const coil = K.toon({ color: 'slate', gloss: 0.3 });
    const heater = group('heater', -0.05, 0.5, id === 'LFP-100' ? 0.24 : 0.26);
    for (let k = 0; k < 4; k++) heater.add(mesh(coilGeometry, coil, -0.12 + k * 0.08, 0, 0, false));
    heater.children.forEach((c) => (c.rotation.y = Math.PI / 2));
    const halo = createHalo({ color: 'orange', size: 0.9, intensity: 0 });
    heater.add(halo);
    st.add(heater);
    g.add(st);
    station[id] = st;
    parts[id] = { level, coil, holder: st, halo, shown: { active: true, soc: 1, cRate: 0, heat: 0 } };
  }

  /* ---------------------------------------------------------------------------------- instrument */
  const device = group('device', 1.85, TOP, 0);
  const db = new Builder('device');
  db.box(2.0, 1.25, 1.0, { r: 0.08, c: ['bg.indigo', 'slate'] });
  db.box(1.84, 1.05, 0.04, { at: [0, 0.1, 0.5], r: 0.03, c: 'ink' });
  for (let k = 0; k < 7; k++)
    db.box(0.05, 0.9, 0.16, { at: [-0.75 + k * 0.25, 0.18, -0.56], r: 0.015, slot: 'metal', c: 'steel' }); // heat sink
  for (const x of [-0.48, 0.3])
    db.cyl(0.33, 0.05, { at: [x, 0.72, 0.5], axis: 'z', seg: 40, c: 'white', bevel: 0.01 });
  db.cyl(0.16, 0.12, { at: [0.78, 0.36, 0.5], axis: 'z', seg: 28, slot: 'metal', c: 'steel.light' }); // the big knob
  db.cyl(0.3, 0.06, { at: [0, 1.25, 0], seg: 32, slot: 'metal', c: 'slate' }); // fan ring
  device.add(db.build().group);
  const needles = [-0.48, 0.3].map((x, i) => {
    const n = group('needle', x, 0.62, 0.565);
    n.add(
      mesh(new RoundedBoxGeometry(0.025, 0.27, 0.015, 1, 0.006), i ? mats.plus : mats.ink, 0, 0.12, 0, false),
    );
    device.add(n);
    return n;
  });
  const lampGeometry = new SphereGeometry(0.06, 16, 12);
  const lamps = (['green', 'amber'] as const).map((c, i) => {
    const m = K.glow({ color: c, intensity: 0.25, keepHue: true, whiten: 0 });
    device.add(mesh(lampGeometry, m, -0.72 + i * 0.22, 0.26, 0.53, false));
    return m;
  });
  const fan = group('fan', 0, 1.33, 0);
  for (const a of [0, Math.PI / 2]) {
    const blade = mesh(new RoundedBoxGeometry(0.5, 0.02, 0.1, 1, 0.01), mats.light, 0, 0, 0, false);
    blade.rotation.y = a;
    fan.add(blade);
  }
  device.add(fan);
  g.add(device);

  /* --------------------------------------------------------------------------------------- leads */
  const wires = {} as Record<BenchCell, Wire>;
  (Object.keys(bodies) as BenchCell[]).forEach((id, i) => {
    const { x, h } = bodies[id];
    const w = createWire(
      [
        new Vector3(x, TOP + h + 0.22, 0.1),
        new Vector3(x + 0.3, TOP + h + 0.75, -0.1 - i * 0.12),
        new Vector3(0.55, TOP + 1.75 - i * 0.3, -0.25),
        new Vector3(1.0, TOP + 1.05 - i * 0.3, -0.3 + i * 0.6),
        new Vector3(0.86, TOP + 0.75 - i * 0.3, -0.3 + i * 0.6),
      ],
      { radius: 0.045, color: 'ink', repeat: 1.4, speed: 0, power: 0 },
    );
    wires[id] = w;
    g.add(w);
  });

  /* --------------------------------------------------------------------------------- thermometer */
  const thermometer = group('thermometer', 3.05, TOP, 0.75);
  // a kit level tube as the mercury column: its level and colour follow the chamber temperature
  const mercury = levelTube({ height: 1.0, radius: 0.07, color: 'coral', caps: false, ticks: 6 });
  mercury.group.position.y = 0.2;
  thermometer.add(
    mesh(new RoundedBoxGeometry(0.3, 0.1, 0.3, 2, 0.03), mats.dark, 0, 0.05, 0),
    mesh(new SphereGeometry(0.1, 16, 12), mercury.fill, 0, 0.18, 0, false),
    mercury.group,
  );
  const frost = createHalo({ color: 'sky', size: 7.5, intensity: 0 });
  frost.position.set(0, TOP + 0.9, 0);
  const snow = createParticles(ctx, {
    count: ctx.quality.count(70, 20),
    emitter: boxEmitter([6.4, 0.2, 2.4]),
    sprite: 'soft',
    color: ['white', 'sky'],
    life: [2.5, 4],
    speed: [0.05, 0.15],
    gravity: [0, -0.35, 0],
    size: [0.03, 0.05, 0.02],
    intensity: 1.2,
  });
  snow.position.set(0, TOP + 2.6, 0);
  snow.rate = 0;
  g.add(thermometer, frost, snow);

  const bench: Bench = {
    group: g,
    device,
    station,
    thermometer,
    state: {
      '21700-NMC': { active: true, soc: 1, cRate: 0, heat: 0 },
      'LFP-100': { active: true, soc: 1, cRate: 0, heat: 0 },
    },
    meters: { current: 0, voltage: 0, cc: false, cv: false },
    temperature: 25,
    update(dt, t) {
      let load = 0;
      for (const id of Object.keys(parts) as BenchCell[]) {
        const want = bench.state[id];
        const p = parts[id];
        const s = p.shown;
        s.soc = damp(s.soc, want.soc, 10, dt);
        s.cRate = damp(s.cRate, want.active ? want.cRate : 0, 6, dt);
        s.heat = damp(s.heat, want.active ? want.heat : 0, 4, dt);
        const on = damp(p.holder.scale.x, want.active ? 1 : 0.001, 9, dt);
        p.holder.scale.setScalar(on);
        p.level.level = s.soc;
        applyHeat(p.coil, Math.min(s.heat, 1.2));
        p.halo.intensity = 0.8 * Math.min(s.heat, 1.3);
        // pulses run from the cell to the instrument on discharge and back on charge; brightness ∝ current
        wires[id].material.speed = -1.6 * s.cRate;
        wires[id].material.power = Math.min(Math.abs(s.cRate) * 0.8, 1.6) * on;
        wires[id].visible = on > 0.05;
        load += Math.abs(s.cRate);
      }
      fan.rotation.y += dt * (1.5 + 14 * Math.min(load, 3));
      needles[0]!.rotation.z = damp(needles[0]!.rotation.z, 1.15 - 2.3 * bench.meters.current, 8, dt);
      needles[1]!.rotation.z = damp(needles[1]!.rotation.z, 1.15 - 2.3 * bench.meters.voltage, 8, dt);
      lamps[0]!.intensity = bench.meters.cc ? 1.7 : 0.2;
      lamps[1]!.intensity = bench.meters.cv ? 1.7 : 0.2;
      // thermometer: −20…+45 °C over the tube; frost and snow below zero
      const k = Math.min(Math.max((bench.temperature + 20) / 65, 0), 1);
      mercury.level = 0.12 + 0.88 * k;
      temperatureRamp(k, mercury.fill.color);
      mercury.fill.emissive.copy(mercury.fill.color);
      const cold = Math.min(Math.max(-bench.temperature / 20, 0), 1);
      frost.intensity = damp(frost.intensity, 0.5 * cold, 3, dt);
      snow.rate = cold;
      thermometer.rotation.y = Math.sin(t * 0.6) * 0.05;
    },
  };
  return bench;
}
