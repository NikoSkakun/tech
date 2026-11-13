/**
 * Step 3 `h-bridge` — the teaching H-bridge. The learner flips S1…S4 by hand (on the board or in the dock):
 * electrons run through the keys that are on, the lamp lights, the arrow and the voltmeter show +U / 0 / −U,
 * the scope writes the load voltage. Both keys of one leg = shoot-through (blocked by the protection, or a
 * red flash and burnt keys without it). «Автомат 50 Hz» alternates the pairs; with the RL load the current
 * keeps flowing through the freewheeling diodes during the dead time. Model: `createHBridge` (§M1).
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { createFlow, createHalo, createScope, createShortCircuit, createVectorArrow } from '@/fx';
import { lamp, motor } from '@/kit';
import { SEMANTIC } from '@/style';
import { STATUS } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { doc, pairTitle, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { KEYS, RIG, createHBridgeRig, devicePoint, loopPath, type KeyName } from '../parts/hbridge-rig';
import { BRIDGE_UDC_V, createBridgeSession } from '../sim-bindings/bridge-session';
import { group, tag } from '../world';

const ID = 'h-bridge';
/** Load current at full voltage: U / R = 325 / 26,45 ≈ 12,3 A (scale of the stream, the arrow and the lamp). */
const I_FULL = BRIDGE_UDC_V / 26.45;
const KEY_IDS = ['s1', 's2', 's3', 's4'] as const;

export const hBridge: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const rig = createHBridgeRig();
  const board = group('rig', 0.15, 0.55, -1.25, [rig.group]);
  board.rotation.x = -0.08;

  // loads on the bridge between the leg nodes: a lamp (R) or a motor (RL)
  const bulb = lamp('incandescent');
  bulb.group.scale.setScalar(9.5);
  bulb.group.position.set(RIG.xLoad, RIG.yNode + 0.02, RIG.z + 0.12);
  const drive = motor({ scale: 1.35, cut: 1.6 });
  drive.group.position.set(RIG.xLoad, RIG.yNode + 0.1, RIG.z + 0.75);
  drive.group.rotation.y = Math.PI / 2;
  drive.speed = 0;
  const shine = createHalo({ color: 'yellow', size: 2.4, intensity: 0 });
  shine.position.set(RIG.xLoad, RIG.yNode + 0.75, RIG.z + 0.3);
  rig.group.add(bulb.group, drive.group, shine);

  const flow = createFlow(ctx, {
    kind: 'electron',
    paths: loopPath(['S1', 'S4']),
    closed: true,
    count: 80,
    radius: 0.075,
    speed: 0,
    spread: 0.02,
  });
  flow.position.z = 0.1;
  flow.density = 0;
  const arrow = createVectorArrow({
    color: SEMANTIC.current,
    radius: 0.07,
    headLength: 0.42,
    headRadius: 0.2,
    intensity: 1.5,
  });
  const spark = createShortCircuit(ctx, { size: 3.2, color: 'red' });
  rig.group.add(flow, arrow, spark);

  // name tags of the keys and the live polarity over the load
  const p = new Vector3();
  for (const name of KEYS) {
    const t = tag(name, 22, 'white', 'mono');
    devicePoint(name, p);
    t.position.set(p.x + (p.x < 0 ? 0.62 : -0.62), p.y + 0.5, p.z + 0.3);
    rig.group.add(t);
  }
  const polarity = tag('0', 34, 'yellow', 'mono');
  polarity.position.set(RIG.xLoad, RIG.yNode + 1.95, RIG.z + 0.3);
  rig.group.add(polarity);

  // the scope lies in front of the board and writes u(t) (violet) and i(t) (cyan)
  const scope = createScope({
    width: 6.6,
    height: 1.9,
    channels: ['violet', SEMANTIC.electron],
    samples: 360,
    lineWidth: 0.04,
  });
  scope.position.set(0.15, 0.5, 2.05);
  scope.rotation.x = -1.18;
  const set = group(`set:${ID}`, 0, 0, 0, [board, scope]);
  lab.stageRoot.add(set);

  const session = createBridgeSession({
    fault(leg) {
      spark.fire([leg === 'A' ? RIG.xA : RIG.xB, RIG.yNode, RIG.z + 0.3]);
      lab.sound.zap();
      ui.toast(doc(ID, 2), { tone: 'alarm', icon: 'warning', duration: 3.5 });
    },
    blocked(index) {
      ui.set(KEY_IDS[index]!, false);
      lab.sound.error();
      ui.toast(OWN.blocked3, { tone: 'warning', icon: 'lock' });
    },
    repaired() {
      for (const id of KEY_IDS) ui.set(id, false);
      ui.toast(OWN.repaired3, { icon: 'check' });
    },
  });
  const setKey = (i: number, on: boolean): void => {
    const got = session.setKey(i, on);
    if (got !== on) ui.set(KEY_IDS[i]!, got);
    else lab.sound.click(on ? 1.25 : 0.85);
  };
  KEYS.forEach((name: KeyName, i) => {
    ctx.input.register(rig.keys[name].hit, {
      tooltip: name,
      cursor: 'pointer',
      click: () => ui.set(KEY_IDS[i]!, !ui.value<boolean>(KEY_IDS[i]!), { notify: true }),
      enabled: () => lab.isCurrent(ID) && !session.auto,
    });
    ctx.qa.probe(`key-${name}`, rig.keys[name].hit);
  });

  const [lampName, motorName] = splitPair(doc(ID, 8));
  let loop = '';
  let pushClock = 0;
  const s = session.state;
  const stateText = (): string =>
    s.fault
      ? '⚡'
      : s.polarity === '+U'
        ? '+U'
        : s.polarity === '-U'
          ? '−U'
          : s.polarity === '0'
            ? '0'
            : OWN.open3;
  const anchorOf = (name: string, dy = 0): (() => Vector3) => {
    const out = new Vector3();
    return () => rig.model.anchorWorld(name, out).setY(out.y + dy);
  };
  const boardPoint = (x: number, y: number): (() => Vector3) => {
    const out = new Vector3();
    return () => rig.group.localToWorld(out.set(x, y, RIG.z + 0.2));
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.6, 6.4, 14.2],
        target: [0.15, 2.35, 0],
        fov: 30,
        orbit: { azimuth: 0.55, polar: 0.3 },
        fit: { center: [0.15, 2, 0], radius: 5.4 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        session.reset();
        // the step opens on a working circuit: S1 and S4 on, the lamp lit (+U) — page 1 of the panel text
        KEY_IDS.forEach((id, i) => {
          const on = i === 0 || i === 3;
          ui.set(id, on);
          session.setKey(i, on);
        });
        loop = '';
        for (let k = 0; k < 360; k++) {
          scope.push(0, 0);
          scope.push(1, 0);
        }
      },
      post: { bloomIntensity: 1.15 },
    },
    ui: {
      hint: OWN.hint3,
      reset: true,
      honesty: [
        'simplified',
        { slowed: 200 },
        { text: OWN.deadStretch, visible: () => session.auto && ui.value<number>('dead3') > 0 },
      ],
      controls: [
        ...KEYS.map((name, i) => ({
          type: 'toggle' as const,
          id: KEY_IDS[i]!,
          label: name,
          value: i === 0 || i === 3,
          disabled: () => session.auto || s.burntRemainingS > 0,
          onChange: (on: boolean) => setKey(i, on),
        })),
        {
          type: 'segmented',
          id: 'prot3',
          items: [
            { id: 'on', label: doc(ID, 3) },
            { id: 'off', label: doc(ID, 4) },
          ],
          value: 'on',
          onChange: (v) => session.setProtection(v === 'on'),
        },
        {
          type: 'segmented',
          id: 'load3',
          label: pairTitle(doc(ID, 8)),
          items: [
            { id: 'lamp', label: lampName },
            { id: 'motor', label: motorName },
          ],
          value: 'lamp',
          onChange: (v) => session.setLoad(v === 'motor' ? 'motor' : 'lamp'),
        },
        {
          type: 'slider',
          id: 'dead3',
          label: doc(ID, 6),
          min: 0,
          max: 5,
          step: 0.5,
          value: 0,
          unit: 'μs',
          digits: 1,
          disabled: () => !session.auto,
          onChange: (v) => session.setDeadTimeUs(v),
        },
        {
          type: 'stats',
          id: 'stats3',
          columns: 3,
          items: [
            { label: OWN.state3, get: stateText, color: () => (s.fault ? STATUS.alarm : STATUS.info) },
            { label: OWN.uLoad, get: () => fmtUnit(s.uLoadV, 'V', { digits: 0 }) },
            { label: OWN.iLoad, get: () => fmtUnit(s.iLoadA, 'A', { digits: 1 }) },
          ],
        },
        {
          type: 'button',
          id: 'auto3',
          label: doc(ID, 5),
          icon: 'play',
          primary: true,
          onClick: () => {
            session.setAuto(!session.auto);
            session.setDeadTimeUs(ui.value<number>('dead3'));
            for (const id of KEY_IDS) ui.set(id, false);
            ui.toast(session.auto ? OWN.autoOn3 : OWN.autoOff3, { icon: session.auto ? 'play' : 'hand' });
          },
        },
      ],
      callouts: [
        { anchor: boardPoint(-2.6, RIG.yTop + 0.1), text: OWN.plusRail, color: 'coral', side: 'up' },
        { anchor: boardPoint(-2.6, RIG.yBottom - 0.1), text: OWN.minusRail, color: 'blue', side: 'down' },
        { anchor: anchorOf('meter'), text: OWN.voltmeter, side: 'down' },
        { anchor: () => scope.localToWorld(p.set(-2.9, -0.8, 0)), text: OWN.scope3, side: 'down' },
      ],
      hotspots: [
        { anchor: anchorOf('D1'), content: 'freewheeling-diodes' },
        { anchor: anchorOf('source'), content: 'dc-source' },
      ],
    },
    probe: () => ({
      gates: s.gates.map((x) => (x ? 1 : 0)).join(''),
      keys: session.keys.map((x) => (x ? 1 : 0)).join(''),
      polarity: s.polarity,
      u: s.uLoadV,
      i: s.iLoadA,
      loop: session.loop,
      fault: s.fault,
      blocked: s.blocked,
      auto: session.auto,
      dead: s.inDeadTime,
      diodes: s.conducting.filter((c) => c.startsWith('D')).length,
    }),
    update(dt, t) {
      if (lab.isCurrent(ID)) session.tick(dt);
      const burnt = s.burntRemainingS > 0;
      KEYS.forEach((name, i) => {
        rig.setKey(name, s.gates[i]!, burnt && session.keys[i]!);
        // in automatic mode the dock toggles follow the controller
        if (session.auto && ui.value<boolean>(KEY_IDS[i]!) !== s.gates[i]) ui.set(KEY_IDS[i]!, s.gates[i]!);
      });
      if (burnt) for (const k of KEYS) rig.keys[k].body.emissiveIntensity *= 0.5 + 0.5 * Math.sin(t * 18);
      rig.diodes.forEach((m, i) => (m.intensity = s.conducting.includes(`D${i + 1}` as 'D1') ? 1.9 : 0));
      const k = Math.max(-1.2, Math.min(1.2, s.iLoadA / I_FULL));
      if (session.loop !== loop && session.loop) flow.setPath(0, loopPath(session.conducting));
      loop = session.loop;
      // electrons run against the conventional current (which the yellow arrow shows)
      flow.density = Math.min(1, Math.abs(k) * 1.1);
      flow.speed = -Math.sign(k) * (0.9 + 1.6 * Math.abs(k));
      const len = 1.5 * k;
      arrow.visible = Math.abs(k) > 0.03;
      arrow.set(p.set(RIG.xLoad - len / 2, RIG.yNode + 1.35, RIG.z + 0.3), new Vector3(len, 0, 0));
      const motorOn = ui.value<string>('load3') === 'motor';
      bulb.group.visible = !motorOn;
      drive.group.visible = motorOn;
      bulb.setPower(Math.min(1, Math.abs(k)));
      shine.intensity = motorOn ? 0 : 1.1 * Math.min(1, k * k);
      drive.speed = k * 9; // the motor reverses with the polarity
      drive.update(dt, t);
      rig.setNeedle(s.uLoadV / BRIDGE_UDC_V);
      polarity.text = s.polarity === 'open' && !s.fault ? '—' : stateText();
      polarity.color = s.fault
        ? 'red'
        : s.polarity === '+U'
          ? 'coral'
          : s.polarity === '-U'
            ? 'blue'
            : 'mist';
      pushClock += dt;
      while (pushClock >= 1 / 60) {
        pushClock -= 1 / 60;
        scope.push(0, (s.uLoadV / BRIDGE_UDC_V) * 0.8);
        scope.push(1, k * 0.45);
      }
      lab.sound.hum = 0.08 + 0.35 * Math.abs(k);
      if (session.auto) lab.sound.buzz = 0.04;
    },
  };
};
