/**
 * Step 10 `ups` — three ways not to let a computer go dark. Three stations side by side: an offline, a
 * line-interactive and a double-conversion UPS, each feeding a PC; the scope over each desk writes the UPS
 * output, the glass tube beside each monitor shows the charge left in the PC supply's hold-up capacitor.
 * «Мережа» cuts the mains: the gap of each UPS races the hold-up time. Model: `UPS_TRANSFER_S`,
 * `holdUpTimeS`, `pcSurvives`, `upsSagResponse` through `sim-bindings/ups-session`.
 */
import { Mesh, SphereGeometry, Vector3 } from 'three';
import { fmtUnit } from '@/content';
import type { UpsKind } from '@electricity/sim/lab-inverter';
import { K, type ColorToken } from '@/style';
import { STATUS } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createUpsStation } from '../parts/ups-station';
import { UPS_KINDS, UPS_SLOW, createUpsSession } from '../sim-bindings/ups-session';
import { group } from '../world';

const ID = 'ups';
const NAME: Record<UpsKind, string> = {
  offline: OWN.upsOffline,
  lineInteractive: OWN.upsLine,
  online: OWN.upsOnline,
};
const ACCENT: Record<UpsKind, ColorToken> = { offline: 'coral', lineInteractive: 'amber', online: 'green' };
/** Scope time base: 260 samples show 80 ms of signal (four periods), i.e. 8 s on screen. */
const PUSH_DT = (0.08 * UPS_SLOW) / 260;

export const ups: StepFactory = (lab) => {
  const { ui } = lab;
  const session = createUpsSession();
  const stations = UPS_KINDS.map((kind, i) => {
    const s = createUpsStation(ACCENT[kind]);
    s.group.position.set(-3.25 + i * 3.55, 0, 0.2);
    return s;
  });
  // the mains: a lamp over the back rail (green = mains present, amber = sag, dark red = off)
  const lampMat = K.glow({ color: 'green', intensity: 1.7, whiten: 0, keepHue: true, falloff: 0.3 });
  const lamp = new Mesh(new SphereGeometry(0.16, 20, 14), lampMat);
  lamp.position.set(-5.35, 1.3, -1.1);
  const set = group(`set:${ID}`, 0, 0, 0, [...stations.map((s) => s.group), lamp]);
  lab.stageRoot.add(set);

  const apply = (): void =>
    session.set({ offlineTransferS: ui.value<number>('tr10') / 1000, loadW: ui.value<number>('load10') });
  ui.onChange('tr10', apply);
  ui.onChange('load10', apply);
  const alive = UPS_KINDS.map(() => true);
  let clock = 0;
  const ms = (s: number): string => fmtUnit(s * 1000, 'ms', { maxDigits: 1 });
  const at = (i: number, key: 'ups' | 'pc' | 'scope' | 'reserve'): (() => Vector3) => {
    const out = new Vector3();
    return () => stations[i]!.group.localToWorld(out.copy(stations[i]!.points[key]));
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.2, 5.6, 11.6],
        target: [0.1, 1.85, 0],
        fov: 30,
        frameAspect: 2.0,
        orbit: { azimuth: 0.45, polar: 0.25 },
        fit: { center: [0, 1.9, 0], radius: 6 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        session.reset();
        apply();
        alive.fill(true);
      },
      post: { bloomIntensity: 1.1 },
    },
    ui: {
      hint: OWN.hint10,
      honesty: ['simplified', { text: OWN.slow10 }],
      controls: [
        {
          type: 'slider',
          id: 'tr10',
          label: `${doc(ID, 2)} (${OWN.upsOffline.toLowerCase()})`,
          min: 0,
          max: 40,
          step: 1,
          value: 8,
          unit: 'ms',
          digits: 0,
        },
        {
          type: 'slider',
          id: 'load10',
          label: doc(ID, 3),
          min: 100,
          max: 400,
          step: 10,
          value: 300,
          unit: 'W',
          digits: 0,
        },
        { type: 'readout', id: 'hold10', label: OWN.holdUp, text: () => ms(session.holdUpS) },
        {
          type: 'table',
          id: 'table10',
          head: [OWN.colUps, OWN.colTransfer, OWN.colPc],
          rows: () =>
            UPS_KINDS.map((k, i) => [
              NAME[k],
              ms(session.units[i]!.transferS),
              session.units[i]!.pcAlive ? OWN.pcOk : OWN.pcDown,
            ]),
          highlight: () => session.units.findIndex((u) => !u.pcAlive),
        },
        {
          type: 'button',
          id: 'mains10',
          label: doc(ID, 0),
          icon: 'lightning',
          primary: true,
          onClick: () => {
            session.setMains(!session.mains);
            lab.sound.relay();
            if (session.mains) ui.toast(OWN.mainsBack, { icon: 'check' });
          },
        },
        {
          type: 'button',
          id: 'sag10',
          label: doc(ID, 6),
          icon: 'chevronDown',
          onClick: () => {
            session.setSag(!session.sag);
            lab.sound.click(0.8);
            if (!session.sag) ui.toast(OWN.sagOff, { icon: 'check' });
          },
        },
      ],
      callouts: [
        ...UPS_KINDS.map((k, i) => ({
          anchor: at(i, 'scope'),
          text: NAME[k],
          color: ACCENT[k],
          side: 'up' as const,
        })),
        { anchor: at(0, 'reserve'), text: OWN.holdUp, color: 'sky', side: 'down' },
        {
          anchor: at(0, 'ups'),
          text: () =>
            session.units[0]!.source === 'battery'
              ? OWN.onBattery
              : session.units[0]!.source === 'avr'
                ? OWN.sagAvr
                : OWN.onMains,
          side: 'left',
        },
        {
          anchor: () => set.localToWorld(new Vector3(-5.35, 1.6, -1.1)),
          text: () => (session.mains ? doc(ID, 0) : `${doc(ID, 0)}: ${OWN.no}`),
          side: 'up',
        },
      ],
      hotspots: [
        { anchor: at(2, 'ups'), content: 'double-conversion' },
        { anchor: at(1, 'pc'), content: 'gas-boiler' },
      ],
    },
    probe: () => ({
      mains: session.mains,
      sag: session.sag,
      holdMs: session.holdUpS * 1000,
      alive: session.units.map((u) => (u.pcAlive ? 1 : 0)).join(''),
      sources: session.units.map((u) => u.source).join(','),
      transferMs: session.units.map((u) => u.transferS * 1000).join(','),
      survives: UPS_KINDS.map((k) => (session.survives(k) ? 1 : 0)).join(''),
      u: session.units.map((u) => Math.round(u.u * 100) / 100),
    }),
    update(dt, t) {
      if (lab.isCurrent(ID)) session.tick(dt);
      clock += dt;
      const push = clock >= PUSH_DT;
      if (push) clock %= PUSH_DT;
      session.units.forEach((u, i) => {
        stations[i]!.apply(u, t);
        if (push) stations[i]!.scope.push(0, u.u * 0.85);
        if (alive[i] && !u.pcAlive)
          ui.toast(`${NAME[u.kind]}: ${doc(ID, 5)}`, { tone: 'alarm', icon: 'warning' });
        alive[i] = u.pcAlive;
      });
      lampMat.setColor(session.mains ? (session.sag ? STATUS.warning : STATUS.ok) : STATUS.alarm);
      lampMat.intensity = session.mains ? 1.7 : 0.6;
      lab.sound.hum = session.mains ? 0.15 : 0.05;
      if (session.units.some((u) => u.source === 'battery')) lab.sound.buzz = 0.08;
    },
  };
};
