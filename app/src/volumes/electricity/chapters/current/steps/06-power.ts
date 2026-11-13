/**
 * Step 6 `power` — power, energy and Joule heat. Seven household appliances hang on a 230 V busbar behind an
 * electricity meter: switch them on (pulses ∝ power run to each), scrub time and watch the kWh register,
 * boil 1 L in the kettle. The lens over the kettle's lead shows electrons shaking the lattice.
 * Model: `appliancePower`, `kettleBoil`, `kettleTemperatureC` (§6; resistive loads, cos φ = 1).
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtUnit } from '@/content';
import { createSteam } from '@/fx';
import { UI_STATUS } from '@/style';
import {
  APPLIANCES_W,
  KETTLE,
  appliancePower,
  kettleBoil,
  kettleTemperatureC,
  type ApplianceId,
} from '@electricity/sim/current';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createAppliance } from '../parts/appliances';
import { createBusbar, createEnergyMeter } from '../parts/energy-meter';
import { createLead } from '../parts/leads';
import { createLens } from '../parts/lens';
import { group, tag } from '../world';

const ID = 'power';
const IDS = Object.keys(APPLIANCES_W) as ApplianceId[];
const BUS = { y: 0.3, z: -1.0 } as const;
/** Two rows in front of the busbar: four small appliances behind, the three big ones in front, between their leads. */
const SEATS: Record<ApplianceId, readonly [number, number]> = {
  led: [-1.8, -0.05],
  charger: [-0.6, -0.05],
  laptop: [0.6, -0.05],
  tv: [1.8, -0.15],
  heater: [-1.2, 1.45],
  kettle: [0, 1.55],
  microwave: [1.2, 1.55],
};
const FULL_SCALE_W = 6000;
const fmtHours = (h: number): string => {
  const min = Math.round(h * 60);
  return min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`;
};

export const powerStep: StepFactory = (bench) => {
  const { ctx, ui, mats } = bench;
  const set = group(`set:${ID}`, 0, 0, 0.55);
  bench.top.add(set);
  const meter = createEnergyMeter();
  meter.group.position.set(0, 0, -2.7);
  const bus = createBusbar(4.9, BUS.y);
  bus.position.set(0, 0, BUS.z);
  const busTag = tag('230 V', 20, 'amber', 'mono');
  busTag.position.set(-2.6, BUS.y + 0.45, BUS.z);
  set.add(meter.group, bus, busTag);
  const items = IDS.map((id, k) => {
    const a = createAppliance(id);
    const [x, z] = SEATS[id];
    a.group.position.set(x, 0, z);
    const lead = createLead(
      [new Vector3(x, BUS.y, BUS.z), new Vector3(x, 0.075, BUS.z + 0.45), new Vector3(x, 0.075, z - 0.5)],
      { bend: 0.2, radius: 0.045 },
    );
    set.add(a.group, lead.mesh);
    ctx.input.register(a.group, {
      tooltip: OWN.appliances[k],
      cursor: 'pointer',
      click: () => ui.set(`on6:${id}`, !ui.value<boolean>(`on6:${id}`), { notify: true }),
      enabled: () => bench.isCurrent(ID),
    });
    ctx.qa.probe(`appliance6:${id}`, () => a.group.localToWorld(new Vector3(0, 0.12, 0.05)));
    return { id, a, lead, watts: APPLIANCES_W[id] };
  });
  const feeder = createLead(
    [new Vector3(0, 0.42, -2.25), new Vector3(0, 0.2, -1.7), new Vector3(0, BUS.y, BUS.z)],
    { bend: 0.15, radius: 0.07 },
  );
  set.add(feeder.mesh);
  const kettle = items.find((i) => i.id === 'kettle')!;
  const steam = createSteam(ctx, { radius: 0.05, height: 1.1, count: 16 });
  steam.position.set(0.5, 0.88, 0);
  steam.setEmitting(false, true);
  kettle.a.group.add(steam);
  const lens = createLens(ctx, mats, [-2.55, 1.9, -2.7]); // up and back, beside the meter: nothing behind it to hide
  lens.group.scale.setScalar(0.78);
  lens.group.position.set(kettle.a.group.position.x, 0.075, -0.3);
  lens.dir.set(0, 0, 1);
  set.add(lens.group);

  /* ------------------------------------------------------------------------------------- state */
  let boilT = -1; // model seconds into the boil; −1 = idle
  let boiledKWh = 0; // energy of finished boils (the register adds 0,116 kWh for each)
  let tempC: number = KETTLE.startC;
  const isOn = (id: ApplianceId): boolean => ui.value<boolean>(`on6:${id}`);
  const onList = (): ApplianceId[] => IDS.filter(isOn);
  const model = (): ReturnType<typeof appliancePower> => appliancePower(onList(), ui.value<number>('time6'));
  const energy = (): number => model().energyKWh + boiledKWh;
  const boiling = (): boolean => boilT >= 0;
  ui.onChange('on6:kettle', (v) => {
    if (!v) boilT = -1; // switching the kettle off interrupts the boil
  });
  IDS.forEach((id) => ui.onChange(`on6:${id}`, () => audio.play('toggle')));
  ctx.qa.expose('power', () => ({
    ...model(),
    energyKWh: energy(),
    on: onList(),
    tempC,
    boiling: boiling(),
    boiledKWh,
  }));
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.5, 8.2, 9.6],
        target: [0, 0.5, 0.2],
        fov: 30,
        frameAspect: 1.05,
        orbit: { azimuth: 0.7, polar: 0.3 },
        fit: { center: [0, 0.7, -0.4], radius: 4.7 },
      },
    },
    stage: {
      show: [
        meter.group,
        bus,
        busTag,
        feeder.mesh,
        lens.group,
        ...items.flatMap((i) => [i.a.group, i.lead.mesh]),
      ],
      enter: () => {
        boilT = -1;
        boiledKWh = 0;
        tempC = KETTLE.startC;
        steam.setEmitting(false, true);
      },
    },
    ui: {
      reset: true,
      hint: OWN.hintPower,
      honesty: ['simplified', { sped: KETTLE.sceneSpeedup, visible: boiling }],
      board: {
        title: OWN.meterTitle,
        size: 'md',
        children: [
          {
            type: 'gauge',
            id: 'p6',
            kind: 'radial',
            label: 'P',
            min: 0,
            max: FULL_SCALE_W,
            unit: 'W',
            digits: 0,
            zones: [
              { from: 0, to: 3680, color: UI_STATUS.ok },
              { from: 3680, to: FULL_SCALE_W, color: UI_STATUS.alarm },
            ],
            get: () => model().totalW,
          },
          {
            type: 'stats',
            id: 'out6',
            columns: 2,
            items: [
              {
                label: OWN.totalCurrent,
                get: () => fmtUnit(model().currentA, 'A', { maxDigits: 2 }),
                color: () => (model().breakerWouldTrip ? UI_STATUS.alarm : 'white'),
              },
              {
                label: OWN.energyKWh,
                get: () => fmtUnit(energy(), 'kWh', { maxDigits: 3 }),
                color: () => 'yellow',
              },
              { label: OWN.energyMJ, get: () => fmtUnit(energy() * 3.6, 'MJ', { maxDigits: 2 }) },
              { label: `У ${DOC.carLifts}`, get: () => fmtNumber(energy(), { maxDigits: 2 }) },
            ],
          },
          {
            type: 'note',
            id: 'trip6',
            text: OWN.breakerNote,
            icon: 'warning',
            color: 'amber',
            visible: () => model().breakerWouldTrip,
          },
        ],
      },
      controls: [
        ...items.map((i, k) => ({
          type: 'toggle' as const,
          id: `on6:${i.id}`,
          label: OWN.appliances[k]!,
          value: i.id === 'led',
        })),
        {
          type: 'slider',
          id: 'time6',
          label: DOC.scrubTime,
          min: 0,
          max: 10,
          step: 1 / 12,
          value: 0,
          format: fmtHours,
        },
        {
          type: 'button',
          id: 'boil6',
          label: DOC.boil,
          icon: 'play',
          primary: true,
          disabled: () => !isOn('kettle') || boiling(),
          onClick: () => (boilT = 0),
        },
      ],
      callouts: [
        { anchor: meter.top, text: OWN.meter, side: 'up' },
        {
          anchor: kettle.a.top,
          text: () => fmtUnit(tempC, '°C', { digits: 0 }),
          color: 'orange',
          side: 'up',
          visible: () => boiling() || tempC > KETTLE.startC + 1,
        },
      ],
      hotspots: [
        {
          anchor: () => meter.top.getWorldPosition(v).set(v.x + 0.95, v.y - 0.7, v.z + 0.3),
          content: 'energy-meter',
        },
        { anchor: items[1]!.a.top, content: 'charger-label' },
        {
          anchor: () => kettle.a.group.getWorldPosition(v).set(v.x, v.y + 0.15, v.z + 0.45),
          content: 'kettle-element',
        },
      ],
    },
    update(dt, t) {
      const on = bench.isCurrent(ID);
      const m = model();
      // the boil runs in model time (×20): 20 → 100 °C in ≈ 10 s on stage, then the register gets its 0,116 kWh
      if (boiling() && on) {
        boilT += dt * KETTLE.sceneSpeedup;
        tempC = kettleTemperatureC(boilT);
        if (boilT >= kettleBoil().timeS) {
          boilT = -1;
          boiledKWh += kettleBoil().electricKWh;
          audio.play('success');
          ui.toast(OWN.boiled, { tone: 'ok' });
        }
      }
      steam.setEmitting(on && isOn('kettle') && tempC > 70);
      steam.rate = Math.min(Math.max((tempC - 70) / 30, 0.15), 1);
      for (const it of items) {
        it.a.on = on && isOn(it.id);
        it.a.update(dt, t);
        // pulses to each appliance: speed ∝ its current, brightness ∝ its power (visible floor for the 10 W lamp)
        const k = it.a.on ? it.watts / 2000 : 0;
        it.lead.drive(it.a.on ? 0.5 + 2.2 * k : 0, it.a.on ? 0.3 + 1.9 * k : 0);
      }
      const share = on ? m.totalW / FULL_SCALE_W : 0;
      feeder.drive(share > 0 ? 0.5 + 4 * share : 0, share > 0 ? 0.4 + 2.2 * share : 0);
      meter.power = share;
      meter.energyKWh = energy();
      meter.update(dt);
      const hot = kettle.a.level;
      lens.drift = -0.8 * hot;
      lens.agitation = hot;
      lens.heat = 0.85 * hot;
      lens.update(dt, t, ctx.camera.camera);
      bench.live.hum = Math.min(share * 1.5, 1);
      bench.live.steam = isOn('kettle') && tempC > 70 ? 0.6 : 0;
    },
  };
};
