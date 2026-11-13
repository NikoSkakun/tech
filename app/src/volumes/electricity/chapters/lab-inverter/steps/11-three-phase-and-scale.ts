/**
 * Step 11 `three-phase-and-scale` — the same bridge, bigger. Left: a three-phase bridge (three legs, six
 * switches) with its three sines 120° apart. Middle: a variable-frequency drive turning a pump motor — the
 * frequency slider sets the speed, the power falls with its cube. Right, in miniature: an HVDC converter's
 * valve hall and the voltage its stacked sub-modules build — a staircase of 2…101 levels with its THD.
 * Model: `vfdPump`, `analyseWave({ kind: 'ladder' })` (§M2), `MMC_LEVELS`.
 */
import { Vector3 } from 'three';
import { fmtPercent, fmtSI, fmtUnit } from '@/content';
import { createScope, createWire, threePhase } from '@/fx';
import { hvdcValveHall, motor } from '@/kit';
import { STATUS } from '@/ui3d';
import { GRID_F_HZ, MMC_LEVELS, analyseWave, vfdPump, waveSample } from '@electricity/sim/lab-inverter';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createDriveCabinet, createThreePhaseBridge, createVolute } from '../parts/three-phase';
import { createSubModuleInset } from '../parts/submodule';
import { group } from '../world';

const ID = 'three-phase-and-scale';
/** Metres → bench units for the valve hall (a 46 m hall becomes a 3,4-unit model). */
const HALL_SCALE = 0.074;
/** Pulse speed of the water column at 50 Hz in the energy material's units (1,5 units/s × 2,2 pulses per unit). */
const WATER_SPEED = 1.5 * 2.2;

export const threePhaseStep: StepFactory = (lab) => {
  const { ui } = lab;
  // three-phase bridge and its scope
  const bridge = createThreePhaseBridge();
  bridge.group.position.set(-3.7, 0, 0.4);
  const scope3 = createScope({ width: 2.9, height: 1.55, cycles: 2, frequency: 0.4, lineWidth: 0.035 });
  ([0, 1, 2] as const).forEach((k) => scope3.setWave(k, threePhase(k), 0.85));
  scope3.position.set(-3.7, 3.35, -0.2);

  // drive → motor → pump
  const cabinet = createDriveCabinet();
  cabinet.group.position.set(-1.05, 0, -0.3);
  const drive = motor({ scale: 1.5, cut: 1.9 });
  drive.group.position.set(0.35, 0, 0.75);
  const volute = createVolute();
  volute.group.position.set(1.55, 0.72, 0.75);
  const feed = createWire(
    [new Vector3(-0.75, 0.5, -0.1), new Vector3(-0.5, 0.15, 0.5), new Vector3(0.1, 0.5, 0.75)],
    { radius: 0.05, color: 'ink', repeat: 1.6, speed: 1.4, power: 0.9, detail: 10 },
  );
  const water = createWire(
    [new Vector3(1.7, 1.75, 0.37), new Vector3(1.7, 2.5, 0.37), new Vector3(1.95, 2.9, 0.37)],
    { radius: 0.11, color: 'blue', pulseColor: 'sky', repeat: 2.2, speed: 1.5, power: 0.9, detail: 10 },
  );

  // HVDC valve hall in miniature with the staircase scope over it
  const hall = hvdcValveHall();
  hall.setOpen(true, true);
  hall.group.scale.setScalar(HALL_SCALE);
  hall.group.position.set(3.55, 0, -0.5);
  hall.group.rotation.y = -0.3;
  // the kit's hall is a thyristor hall; the text speaks of IGBT sub-modules: a lens shows one block of a tower
  const valve = new Vector3(-11.5, 10.2, 2)
    .multiplyScalar(HALL_SCALE)
    .applyAxisAngle(new Vector3(0, 1, 0), hall.group.rotation.y)
    .add(hall.group.position);
  const lens = createSubModuleInset(new Vector3(2.75, 2.05, 1.35), valve);
  lens.group.scale.setScalar(1.2);
  const scopeL = createScope({
    width: 2.9,
    height: 1.55,
    channels: ['steel', 'violet'],
    samples: 520,
    cycles: 2,
    frequency: 0.25,
    lineWidth: 0.035,
  });
  scopeL.position.set(3.5, 3.35, -0.2);
  scopeL.setWave(0, Math.sin, 0.8);
  scopeL.setChannelIntensity(0, 0.45);
  const set = group(`set:${ID}`, 0, 0, 0, [
    bridge.group,
    scope3,
    cabinet.group,
    drive.group,
    volute.group,
    feed,
    water,
    hall.group,
    scopeL,
    lens.group,
  ]);
  lab.stageRoot.add(set);

  const f = (): number => ui.value<number>('f11');
  const levels = (): number => Number(ui.value<string>('levels11'));
  let thd = 0;
  function setLevels(): void {
    const p = { kind: 'ladder' as const, levels: levels(), ma: 1, udcV: 1 };
    thd = analyseWave(p).thd;
    scopeL.setWave(
      1,
      (th) =>
        waveSample(p, (((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (2 * Math.PI * GRID_F_HZ)),
      0.8,
    );
  }
  ui.onChange('levels11', setLevels);
  const pump = (): ReturnType<typeof vfdPump> => vfdPump(f());
  const at = (x: number, y: number, z: number): (() => Vector3) => {
    const out = new Vector3();
    return () => lab.stageRoot.localToWorld(out.set(x, y, z));
  };
  let spin = 0;

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.3, 5.6, 12.2],
        target: [-0.25, 2.0, 0],
        fov: 30,
        frameAspect: 2.0,
        orbit: { azimuth: 0.45, polar: 0.25 },
        fit: { center: [0.2, 2, 0], radius: 6 },
      },
    },
    stage: { show: [set], enter: setLevels, post: { bloomIntensity: 1.1 } },
    ui: {
      hint: OWN.hint11,
      honesty: ['notToScale', 'simplified', { text: OWN.slow11 }],
      controls: [
        {
          type: 'slider',
          id: 'f11',
          label: doc(ID, 0),
          min: 10,
          max: 50,
          step: 1,
          value: 50,
          unit: 'Hz',
          digits: 0,
        },
        {
          type: 'segmented',
          id: 'levels11',
          label: doc(ID, 1),
          items: MMC_LEVELS.map((n) => ({ id: String(n), label: String(n) })),
          value: '3',
        },
        {
          type: 'stats',
          id: 'stats11',
          columns: 3,
          items: [
            { label: OWN.rpm, get: () => fmtUnit(pump().rpm, 'rpm', { digits: 0 }) },
            { label: OWN.pumpPower, get: () => fmtSI(pump().powerW, 'W') },
            {
              label: OWN.thdLadder,
              get: () => fmtPercent(thd, 1),
              color: () => (thd < 0.05 ? STATUS.ok : thd < 0.2 ? STATUS.warning : STATUS.alarm),
            },
          ],
        },
      ],
      callouts: [
        { anchor: at(-3.7, 2.15, 0), text: OWN.bridge3, color: 'cyan', side: 'up' },
        { anchor: at(-3.7, 4.3, -0.2), text: OWN.phases, side: 'up' },
        { anchor: at(-1.05, 1.65, -0.3), text: OWN.drive, side: 'up' },
        {
          anchor: at(0.35, 1.25, 0.75),
          text: () => `${OWN.pumpMotor} · ${fmtUnit(pump().rpm, 'rpm', { digits: 0 })}`,
          side: 'up',
        },
        {
          anchor: at(3.5, 4.3, -0.2),
          text: () => `${OWN.ladderScope}: ${levels()}`,
          color: 'violet',
          side: 'up',
        },
        { anchor: at(2.75, 1.25, 1.35), text: OWN.subModule, color: 'cyan', side: 'down' },
      ],
      hotspots: [{ anchor: at(4.3, 1.3, 0.0), content: 'valve-hall' }],
    },
    probe: () => ({ f: f(), rpm: pump().rpm, powerW: pump().powerW, levels: levels(), thd, spin }),
    update(dt, t) {
      lens.setGlow(0.5 + 0.5 * Math.sin(t * 2));
      // six-step view of the bridge in slow motion: the upper switch of a leg conducts while its sine is positive
      bridge.switches.forEach((m, i) => {
        const k = Math.floor(i / 2);
        const positive = Math.sin(scope3.phase - (k * 2 * Math.PI) / 3) >= 0;
        const on = i % 2 === 0 ? positive : !positive;
        m.intensity = on ? (Math.sin(t * 40 + k) > -0.4 ? 1.7 : 0.4) : 0.05;
      });
      // motor and impeller turn with the drive frequency (1500 rpm at 50 Hz would be a blur: slowed)
      const w = (f() / 50) * 9;
      spin += w * dt;
      drive.speed = w;
      drive.update(dt, t);
      volute.impeller.rotation.x = spin;
      const share = pump().powerW / 11000;
      feed.material.power = 0.15 + 0.85 * share;
      // flow ∝ speed
      water.material.power = 0.2 + 0.8 * (f() / 50);
      water.material.speed = (f() / 50) * WATER_SPEED;
      cabinet.display.intensity = 1.0 + 0.6 * (f() / 50);
      lab.sound.hum = 0.15 + 0.2 * (f() / 50);
      lab.sound.humPitch = f() / 50;
    },
  };
};
