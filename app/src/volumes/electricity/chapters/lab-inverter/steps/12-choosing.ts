/**
 * Step 12 `choosing` — the fitting room. Appliances of the shared house wait on the tray; a tap (or a drag)
 * puts one on the load platform of the closed «ЛІ-6», another tap takes it back. Motors start with a surge:
 * the needle of the big dial jumps into the amber zone for a moment; too much for too long and the inverter
 * trips. «Чистий синус / модифікований» shows who suffers on a cheap inverter. Model: `createLoadTester`,
 * `TESTER_APPLIANCES`, `LI6_OUTPUT`, `IDLE_KWH_PER_DAY` (§M7).
 */
import { CircleGeometry, Mesh, Shape, ShapeGeometry, Vector3 } from 'three';
import { fmtSI, fmtUnit } from '@/content';
import { damp } from '@/engine/api';
import { createWire } from '@/fx';
import { Builder, hybridInverter } from '@/kit';
import { K } from '@/style';
import { STATUS } from '@/ui3d';
import {
  IDLE_KWH_PER_DAY,
  LI6_OUTPUT,
  TESTER_APPLIANCES,
  createLoadTester,
} from '@electricity/sim/lab-inverter';
import type { StepFactory } from '../chapter';
import { doc, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { createToy, type Toy, type ToyStatus } from '../parts/appliances';
import { DIAL_MAX_KW, createLoadDial } from '../parts/load-dial';
import { group, pickBox, tag } from '../world';

const ID = 'choosing';
/** Toys on the tray: every appliance of the model once, the kettle three times (the «3 чайники» control case). */
const TOY_IDS = [...TESTER_APPLIANCES.map((a) => a.id), 'kettle', 'kettle'];
/** Centre line of the platform, the wall and the inverter (set space): close to the tray, so the task reads as one row. */
const PX = 2.6;
const traySlot = (i: number): Vector3 =>
  new Vector3(-4.3 + (i % 5) * 0.98, 0.07, 0.15 + Math.floor(i / 5) * 1.15);
const platformSlot = (j: number): Vector3 =>
  new Vector3(PX - 1.5 + (j % 4) * 1.0, 0.1, 2.45 - Math.floor(j / 4) * 1.05); // front row first
const ON_PLATFORM_X = PX - 2.15; // a toy dropped to the right of this line lands on the platform

export const choosing: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const tester = createLoadTester();
  const st = tester.state;

  // set dressing: tray, platform, the wall with the closed inverter and its dial
  const b = new Builder('fitting-room');
  b.box(5.3, 0.07, 3.45, { r: 0.06, c: ['bg.indigo', 'slate'], at: [-2.34, 0, 1.3] });
  b.box(4.3, 0.1, 3.4, { r: 0.08, c: ['slate', 'steel'], at: [PX, 0, 1.4] });
  b.box(4.1, 0.02, 3.2, { r: 0.04, slot: 'matte', c: 'ink', at: [PX, 0.1, 1.4] });
  for (const z of [-0.2, 3.0]) b.box(4.1, 0.03, 0.05, { r: 0, slot: 'glow', c: 'cyan', at: [PX, 0.1, z] });
  b.box(3.0, 4.3, 0.2, { r: 0.06, slot: 'matte', c: ['slate', 'mist'], at: [PX, 0, -1.6] });
  const dressing = b.build();
  const inverter = hybridInverter();
  inverter.group.scale.setScalar(2.5);
  inverter.group.position.set(PX, 1.45, -1.5);
  const dial = createLoadDial(LI6_OUTPUT.ratedW / 1000, LI6_OUTPUT.peakW / 1000);
  dial.group.scale.setScalar(0.82);
  dial.group.position.set(PX, 3.3, -1.45);
  const cable = createWire(
    [
      new Vector3(PX + 0.15, 0.2, -0.1),
      new Vector3(PX + 0.25, 0.25, -0.9),
      new Vector3(PX + 0.3, 0.6, -1.35),
    ],
    { radius: 0.06, color: 'ink', repeat: 1.6, speed: 1.4, power: 0, detail: 10 },
  );
  const set = group(`set:${ID}`, 0, 0, 0, [dressing.group, inverter.group, dial.group, cable]);
  lab.stageRoot.add(set);

  // a «Пуск» key for every motor on the platform: a round glowing key floating over the toy, clear of the
  // toys' own pick boxes (the toy itself answers a tap by stepping back to the tray)
  const play = new Shape();
  play.moveTo(-0.07, -0.09);
  play.lineTo(0.11, 0);
  play.lineTo(-0.07, 0.09);
  play.closePath();
  const keyGeo = new CircleGeometry(0.2, 28);
  const playGeo = new ShapeGeometry(play);
  const keyMat = K.glow({ color: 'green', intensity: 1.3, whiten: 0.1, keepHue: true, falloff: 0 });
  const playMat = K.flat('white');

  interface Item {
    toy: Toy;
    id: string;
    key: number | null;
    slot: number;
    home: Vector3;
    drag: boolean;
    /** The motor's own «Пуск» key (shown while it stands on the platform). */
    start: Mesh | null;
  }
  const items: Item[] = TOY_IDS.map((id, i) => {
    const toy = createToy(id);
    toy.group.position.copy(traySlot(i));
    set.add(toy.group);
    // the power chip of the toy: its running power, like a price tag at the front of its base
    const spec = TESTER_APPLIANCES.find((a) => a.id === id)!;
    const chip = tag(fmtSI(spec.pRunW, 'W'), 18, 'white', 'mono');
    chip.position.set(0, 0.14, 0.5);
    toy.group.add(chip);
    let start: Mesh | null = null;
    if (spec.motor) {
      start = new Mesh(keyGeo, keyMat);
      start.add(new Mesh(playGeo, playMat).translateZ(0.01));
      start.add(pickBox(0.6, 0.6, 0.3));
      start.position.set(0, 1.62, 0.1);
      start.rotation.x = -0.35;
      start.visible = false;
      toy.group.add(start);
    }
    return { toy, id, key: null, slot: -1, home: traySlot(i), drag: false, start };
  });
  const freeSlot = (): number => {
    for (let j = 0; j < 12; j++) if (!items.some((it) => it.key !== null && it.slot === j)) return j;
    return 11;
  };
  function place(it: Item, on: boolean): void {
    if (on === (it.key !== null)) return;
    if (on) {
      it.slot = freeSlot();
      it.key = tester.add(it.id);
      lab.sound.click(1.2);
    } else {
      tester.remove(it.key!);
      it.key = null;
      lab.sound.click(0.8);
    }
  }
  const floor = new Vector3(0, 1, 0);
  items.forEach((it, i) => {
    ctx.input.register(it.toy.hit, {
      tooltip: TESTER_APPLIANCES.find((a) => a.id === it.id)?.name ?? it.id,
      cursor: 'pointer',
      click: () => place(it, it.key === null),
      dragStart: () => {
        it.drag = true;
        if (it.start) it.start.visible = false;
      },
      drag: (e) => {
        const p = e.planePoint(floor, set.localToWorld(new Vector3(0, 0.1, 0)));
        if (p) it.toy.group.position.copy(set.worldToLocal(p)).setY(0.5);
      },
      dragEnd: () => {
        it.drag = false;
        place(it, it.toy.group.position.x > ON_PLATFORM_X);
      },
      enabled: () => lab.isCurrent(ID),
    });
    // the top of the toy: the part that stays visible behind the front row of the tray
    ctx.qa.probe(`toy-${i}`, () => it.toy.group.localToWorld(new Vector3(0, 0.95, 0)));
    const key = it.start;
    if (key) {
      ctx.input.register(key.children[1]!, {
        tooltip: doc(ID, 0),
        cursor: 'pointer',
        click: () => {
          if (it.key === null) return;
          tester.start(it.key);
          lab.sound.click(1.4);
        },
        enabled: () => lab.isCurrent(ID) && it.key !== null && key.visible,
      });
      ctx.qa.probe(`start-${i}`, () => key.getWorldPosition(new Vector3()));
    }
  });
  ctx.qa.probe('platform', () => set.localToWorld(new Vector3(PX, 0.2, 1.4)));

  const [sineName, modName] = splitPair(doc(ID, 1));
  const modified = (): boolean => ui.value<string>('sine12') === 'mod';
  const statusOf = (it: Item): ToyStatus => {
    if (it.key === null) return 'idle';
    if (st.status === 'tripped') return 'dead';
    if ((st.starting[it.key] ?? 0) > 0) return 'starting';
    if (modified()) {
      const v = TESTER_APPLIANCES.find((a) => a.id === it.id)?.modifiedSine;
      if (v === 'warn' || v === 'fault') return v;
    }
    return 'on';
  };
  let needle = 0;
  let wasTripped = false;
  const toyAt = (id: string, dy: number, dx = 0): (() => Vector3) => {
    const it = items.find((x) => x.id === id)!;
    const out = new Vector3();
    return () => it.toy.group.localToWorld(out.set(dx, dy, 0));
  };
  const point = (x: number, y: number, z: number): (() => Vector3) => {
    const out = new Vector3();
    return () => set.localToWorld(out.set(x, y, z));
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        // tray → platform → dial read left to right as one task; the frame is as wide as that row and no wider
        position: [0.0, 6.4, 12.3],
        target: [-0.1, 1.6, 0.7],
        fov: 30,
        frameAspect: 1.6,
        orbit: { azimuth: 0.45, polar: 0.25 },
        fit: { center: [0, 1.6, 0.5], radius: 6.2 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        tester.reset();
        items.forEach((it) => {
          it.key = null;
          it.toy.group.position.copy(it.home);
        });
        wasTripped = false;
      },
      post: { bloomIntensity: 1.1 },
    },
    ui: {
      hint: OWN.hint12,
      honesty: ['notToScale', 'simplified'],
      controls: [
        {
          type: 'gauge',
          id: 'dial12',
          kind: 'radial',
          label: OWN.loadNow,
          min: 0,
          max: DIAL_MAX_KW,
          unit: 'kW',
          digits: 1,
          zones: [
            { from: 0, to: LI6_OUTPUT.ratedW / 1000, color: STATUS.ok },
            { from: LI6_OUTPUT.ratedW / 1000, to: LI6_OUTPUT.peakW / 1000, color: STATUS.warning },
            { from: LI6_OUTPUT.peakW / 1000, to: DIAL_MAX_KW, color: STATUS.alarm },
          ],
          get: () => st.pW / 1000,
        },
        {
          type: 'stats',
          id: 'stats12',
          columns: 2,
          items: [
            { label: OWN.runLoad, get: () => fmtSI(st.pRunW, 'W') },
            {
              label: OWN.status12,
              get: () =>
                st.status === 'tripped'
                  ? OWN.statusTrip
                  : st.status === 'overload-timer'
                    ? `${OWN.statusTimer} ${fmtUnit(st.overloadS, 's', { digits: 0 })}`
                    : OWN.statusOk,
              color: () =>
                st.status === 'ok' ? STATUS.ok : st.status === 'tripped' ? STATUS.alarm : STATUS.warning,
            },
          ],
        },
        {
          type: 'segmented',
          id: 'sine12',
          items: [
            { id: 'sine', label: sineName },
            { id: 'mod', label: modName },
          ],
          value: 'sine',
        },
        {
          type: 'readout',
          id: 'idle12',
          label: doc(ID, 5),
          text: () => fmtUnit(IDLE_KWH_PER_DAY, 'kWh', { digits: 1 }),
        },
        { type: 'note', id: 'idle12note', text: doc(ID, 6), icon: 'info' },
        {
          type: 'button',
          id: 'start12',
          label: doc(ID, 0),
          icon: 'play',
          primary: true,
          onClick: () => {
            for (const it of items) if (it.key !== null) tester.start(it.key);
            lab.sound.click(1.4);
          },
        },
        {
          type: 'button',
          id: 'clear12',
          label: OWN.clearAll,
          icon: 'resetView',
          onClick: () => items.forEach((it) => place(it, false)),
        },
      ],
      callouts: [
        { anchor: point(-2.34, 0.2, 3.0), text: OWN.tray, side: 'down' },
        { anchor: point(PX, 0.25, 3.05), text: OWN.platform, color: 'cyan', side: 'down' },
        { anchor: point(PX - 0.8, 3.55, -1.4), text: OWN.rated, color: 'green', side: 'left' },
        { anchor: point(PX + 0.8, 3.55, -1.4), text: OWN.peak, color: 'amber', side: 'right' },
        {
          anchor: toyAt('boiler', 1.1),
          text: doc(ID, 4),
          color: 'red',
          side: 'up',
          visible: () => modified() && items.some((it) => it.id === 'boiler' && it.key !== null),
        },
        {
          anchor: toyAt('well_pump', 1.1),
          text: doc(ID, 3),
          color: 'orange',
          side: 'up',
          visible: () => modified() && items.some((it) => it.id === 'well_pump' && it.key !== null),
        },
      ],
      hotspots: [
        // beside the fridge, not on it: the marker must not take the taps meant for the toy
        { anchor: toyAt('fridge', 0.75, -0.62), content: 'fridge' },
        { anchor: () => inverter.anchorWorld('nameplate'), content: 'nameplate' },
      ],
    },
    probe: () => ({
      onPlatform: items
        .filter((it) => it.key !== null)
        .map((it) => it.id)
        .sort()
        .join(','),
      count: items.filter((it) => it.key !== null).length,
      pW: st.pW,
      pRunW: st.pRunW,
      status: st.status,
      trip: st.tripReason,
      overloadS: st.overloadS,
      modified: modified(),
      verdicts: items
        .filter((it) => it.key !== null)
        .map((it) => statusOf(it))
        .join(','),
      needle,
    }),
    update(dt, t) {
      if (lab.isCurrent(ID)) tester.step(dt);
      if (st.status === 'tripped' && !wasTripped) {
        lab.sound.error();
        ui.toast(st.tripReason === 'peak' ? OWN.tripPeak : OWN.tripOverload, {
          tone: 'alarm',
          icon: 'warning',
          duration: 4,
        });
      } else if (st.status !== 'tripped' && wasTripped)
        ui.toast(OWN.restarted, { tone: 'ok', icon: 'check' });
      wasTripped = st.status === 'tripped';
      for (const it of items) {
        it.toy.setStatus(statusOf(it), t);
        if (it.drag) continue;
        // hop between tray and platform: ease to the target, lifted in proportion to the distance left
        const target = it.key !== null ? platformSlot(it.slot) : it.home;
        const p = it.toy.group.position;
        p.x = damp(p.x, target.x, 9, dt);
        p.z = damp(p.z, target.z, 9, dt);
        const far = Math.hypot(p.x - target.x, p.z - target.z);
        p.y = damp(p.y, target.y + Math.min(0.9, far * 0.35), 12, dt);
        if (it.start) it.start.visible = it.key !== null && far < 0.15;
      }
      needle = damp(needle, st.pW / 1000, 16, dt);
      dial.set(needle);
      const k = Math.min(1, st.pW / LI6_OUTPUT.ratedW);
      cable.material.power = st.status === 'tripped' ? 0 : k;
      inverter.setLeds({ grid: false, pv: false, bat: st.status !== 'tripped', alarm: st.status !== 'ok' });
      inverter.display.intensity = st.status === 'tripped' ? 0.2 : 0.8 + 1.2 * k;
      lab.sound.hum = 0.1 + 0.3 * k;
      const noisy = modified() && items.some((it) => it.key !== null && statusOf(it) === 'warn');
      lab.sound.buzz = noisy ? 0.25 : st.status === 'overload-timer' ? 0.15 : 0;
    },
  };
};
