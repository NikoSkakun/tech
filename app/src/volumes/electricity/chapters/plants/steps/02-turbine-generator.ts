/**
 * Step 2 `turbine-generator` — «Майже всі крутять одне й те саме». The machine hall is gone; on its floor stands
 * one synchronous generator (cut open) with an empty drive socket on its left. «Привід» slides a steam turbine, a
 * gas turbine, a water wheel or a wind rotor into the socket; the shaft speed follows `n = 60·f/p`
 * (`generatorSpeedRpm`, generator-ac sim). «Без обертання» stops the shaft and lights the shelf of exceptions:
 * panel, fuel cell and battery push electrons (DC) into an inverter. Wind and the shelf get power electronics.
 */
import { Vector3 } from 'three';
import { createBundle, createFlame, createFlow, createHotSteam } from '@/fx';
import { Builder } from '@/kit';
import { generatorSpeedRpm } from '@electricity/sim/generator-ac';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { LISTS, OWN } from '../labels-own';
import { HALL } from '../layout';
import { AXIS, createDriveRig, type DriveId } from '../parts/drives';
import { createShelf } from '../parts/exceptions-shelf';
import { group, roomy } from '../world';

const ID = 'turbine-generator';
type Mode = DriveId | 'none';
const MODES: readonly Mode[] = ['steam', 'gas', 'water', 'wind', 'none'];
/** Pole pairs per drive (generator-ac: 2-pole turbogenerator, 40-pair hydrogenerator). */
const POLE_PAIRS: Record<'steam' | 'gas' | 'water', number> = { steam: 1, gas: 1, water: 40 };
/** Display slow-down of the shaft per drive (STYLE §5 honesty chips); the wind rotor turns in real time. */
const SLOW: Record<Mode, number> = { steam: 50, gas: 50, water: 5, wind: 1, none: 1 };
const WIND_RPM = 12;
const COUPLING_X = -2;

export const turbineGenerator: StepFactory = (hub) => {
  const { ctx, ui, arch } = hub;
  const set = group(ID, HALL.x, 1, HALL.z);
  hub.stageRoot.add(set);
  const rig = createDriveRig();
  const gen = rig.generator;
  gen.group.position.x = COUPLING_X;
  set.add(gen.group);
  const slots = MODES.filter((m): m is DriveId => m !== 'none').map((m) => {
    const d = rig.drives[m];
    d.group.position.x = COUPLING_X;
    set.add(d.group);
    // the drive slides in along −X with a little overshoot (actor value 0…1 → position)
    const actor = ctx.stage.actor(d.group, {
      appear: (o, v) => {
        o.position.x = COUPLING_X - 22 * (1 - v);
        o.visible = v > 0.002;
      },
      inDuration: 0.8,
      outDuration: 0.35,
    });
    return { id: m, actor, d };
  });
  // what flows into each drive
  const steamIn = createHotSteam(ctx, { radius: 0.5, height: 3, axis: [0, -1, 0], count: 26 });
  steamIn.position.copy(rig.steam.anchorLocal('steamIn')).add(new Vector3(-rig.steam.length, 1.6, 0));
  rig.drives.steam.group.add(steamIn);
  const flame = createFlame({ height: 1.4, width: 0.6, colors: ['violet', 'orange', 'yellow'] });
  flame.position.set(-6.2, AXIS + 2.6, 0);
  rig.drives.gas.group.add(flame);
  const water = createFlow(ctx, { kind: 'blob', color: 'blue', paths: [{ path: [new Vector3(-1.6, AXIS + 8, 3.5), new Vector3(-1.6, AXIS + 4.6, 2.2), new Vector3(-1.6, AXIS + 2.4, 0.6)] }], count: 60, radius: 0.24, speed: 4, spread: 0.6 });
  rig.drives.water.group.add(water);
  const air = createFlow(ctx, { kind: 'blob', color: 'sky', paths: [-3, 0, 3].map((y) => ({ path: [new Vector3(-16, AXIS + y, 0.5), new Vector3(-6, AXIS + y, 0.5)] })), count: 40, radius: 0.12, speed: 6, spread: 1.5 });
  rig.drives.wind.group.add(air);
  // three phases out of the terminals; power electronics box for wind / no-rotation
  set.updateMatrixWorld(true);
  const terms = ['u', 'v', 'w'].map((n) => set.worldToLocal(gen.anchorWorld(n)).setY(0.4));
  const phases = createBundle(terms, terms.map((p) => p.clone().add(new Vector3(8, 0, -9))), { sag: 0.2, radius: 0.12, repeat: 0.5, speed: 4 });
  set.add(phases);
  const cb = new Builder('converter');
  cb.box(2.2, 2.6, 1.4, { r: 0.2, c: ['ink', 'slate'], slot: 'gloss' });
  cb.tube(Array.from({ length: 21 }, (_, i) => new Vector3(-0.6 + (i / 20) * 1.2, 1.8 + Math.sin((i / 20) * Math.PI * 2) * 0.35, 0.72)), 0.05, { c: 'yellow', slot: 'glow' });
  const converter = cb.build();
  converter.group.position.set(terms[0]!.x + 9.5, 0, terms[0]!.z - 10);
  set.add(converter.group);
  const aConv = ctx.stage.actor(converter.group, { appear: 'pop' });
  const shelf = createShelf(ctx);
  shelf.group.position.set(15, 0, 9);
  shelf.group.rotation.y = -0.45;
  set.add(shelf.group);

  const mode = (): Mode => ui.value<Mode>('drive2');
  const st = { angle: 0 };
  const rpm = (): number => {
    const m = mode();
    return m === 'none' ? 0 : m === 'wind' ? WIND_RPM : generatorSpeedRpm(POLE_PAIRS[m]);
  };
  const sync = (instant: boolean): void => {
    for (const s of slots) if (ctx.stage.shown(s.actor) !== (mode() === s.id)) ctx.stage.toggle(s.actor, mode() === s.id, { instant });
    const conv = mode() === 'wind' || mode() === 'none';
    if (ctx.stage.shown(aConv) !== conv) ctx.stage.toggle(aConv, conv, { instant });
  };
  const v = new Vector3();
  const labels = [...LISTS.drives];
  ctx.qa.probe('gen', () => gen.anchorWorld('stator', v).clone());

  return {
    id: ID,
    shots: {
      [ID]: { position: [-3, 10, 31], target: [-2, 4, HALL.z + 2], fov: 38, drift: 0.6, fit: { center: [0, 3, HALL.z], radius: 20 } },
    },
    stage: {
      show: [set, gen.group, shelf.group, phases],
      enter: (info) => sync(info.instant),
    },
    ui: {
      honesty: [{ slowed: 50, visible: () => mode() === 'steam' || mode() === 'gas' }, { slowed: 5, visible: () => mode() === 'water' }, 'notToScale'],
      controls: [
        {
          type: 'segmented',
          id: 'drive2',
          label: doc(ID, 0),
          items: MODES.map((m, i) => ({ id: m, label: labels[i] ?? m })),
          value: 'steam',
          onChange: () => hub.sound.relay(),
        },
        {
          type: 'stats',
          id: 'read2',
          columns: 2,
          items: [
            { label: OWN.shaftRpm, get: () => rpm(), unit: 'rpm', digits: 0 },
            { label: 'f', get: () => 50, unit: 'Hz', digits: 0, color: () => (mode() === 'wind' || mode() === 'none' ? 'cyan' : 'yellow') },
          ],
        },
        { type: 'note', id: 'freq2', icon: 'info', text: () => (mode() === 'wind' || mode() === 'none' ? doc(ID, 3) : doc(ID, 1)) },
      ],
      callouts: [
        { anchor: () => gen.anchorWorld('stator', new Vector3()), text: OWN.generator, side: 'up' },
        { anchor: () => set.localToWorld(new Vector3(COUPLING_X - 6, AXIS + 4.5, 0)), text: () => LISTS.driveName[MODES.indexOf(mode())] ?? '', side: 'up', visible: () => mode() !== 'none' },
        { anchor: () => shelf.group.localToWorld(shelf.at.cell.clone().setY(5)), text: OWN.shelf, side: 'up', color: 'cyan' },
        { anchor: () => converter.group.localToWorld(new Vector3(0, 3.2, 0)), text: OWN.converter, side: 'right', visible: () => mode() === 'wind' && roomy(hub) },
      ],
      hotspots: [
        { anchor: () => gen.anchorWorld('exciter', new Vector3()), content: 'exciter' },
        { anchor: () => set.localToWorld(new Vector3(COUPLING_X - 0.5, AXIS + 1.2, 0)), content: 'shaft', visible: () => mode() !== 'none' },
      ],
    },
    probe: () => ({ mode: mode(), rpm: rpm(), angle: st.angle, electrons: shelf.electrons.density, phases: phases.wires[0]!.material.power }),
    update(dt) {
      if (!hub.isCurrent(ID)) return;
      sync(false);
      const m = mode();
      const w = (2 * Math.PI * (rpm() / 60)) / SLOW[m];
      st.angle += w * dt;
      gen.part('rotor').rotation.x = st.angle;
      for (const s of slots) s.d.rotor.rotation.x = st.angle;
      const on = m === 'none' ? 0 : 1;
      for (const wire of phases.wires) wire.material.power = on;
      shelf.electrons.density = m === 'none' ? 1 : 0.15;
      arch.want.ring = 0.6;
      hub.sound.hum = 0.12 * on;
      hub.sound.turbine = m === 'steam' || m === 'gas' ? 0.35 : m === 'water' ? 0.15 : 0;
      hub.sound.turbinePitch = m === 'water' ? 0.35 : 0.9;
      hub.sound.steam = m === 'steam' ? 0.25 : 0;
      hub.sound.fire = m === 'gas' ? 0.3 : 0;
      hub.sound.water = m === 'water' ? 0.35 : 0;
      hub.sound.wind = m === 'wind' ? 0.35 : 0;
    },
  };
};
