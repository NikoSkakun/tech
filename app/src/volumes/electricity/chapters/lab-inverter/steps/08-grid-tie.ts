/**
 * Step 8 `grid-tie` — the inverter meets the grid. On the wall: the closed «ЛІ-6», the big relay with its
 * synchronism lamp, the two-way meter; the service cable climbs to a 0,4 kV pole where a lineman works.
 * Above: the phasors of the grid voltage and of the bridge voltage, and the two sines they cast. The learner
 * synchronises by hand or with the PLL, closes the relay (softly — or with a current surge), dispatches P and
 * Q, then switches the grid off and watches the anti-islanding protection. Model: `createGridTie`,
 * `dispatchPQ` (§M6) through `sim-bindings/grid-session`.
 */
import { Vector3 } from 'three';
import { fmtSI, fmtUnit } from '@/content';
import { damp } from '@/engine/api';
import { createPhasors, createScope, createShortCircuit } from '@/fx';
import { STATUS, type Chart } from '@/ui3d';
import { ISLANDING } from '@electricity/sim/lab-inverter';
import type { StepFactory } from '../chapter';
import { doc, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { createGridWall } from '../parts/grid-wall';
import { createGridSession } from '../sim-bindings/grid-session';
import { group } from '../world';

const ID = 'grid-tie';
const RAD = Math.PI / 180;

export const gridTie: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const wall = createGridWall(ctx);
  const phasors = createPhasors({
    size: 2.7,
    frequency: 0,
    phasors: [{ color: 'steel' }, { color: 'yellow' }],
    accent: 'violet',
  });
  phasors.position.set(-1.2, 5.8, -0.5);
  const scope = createScope({
    width: 3.3,
    height: 1.9,
    channels: ['steel', 'yellow'],
    cycles: 2,
    frequency: 0,
    lineWidth: 0.035,
  });
  scope.position.set(2.3, 5.8, -0.5);
  const flash = createShortCircuit(ctx, { size: 2.6, color: 'red' });
  const set = group(`set:${ID}`, 0, 0, 0, [wall.group, phasors, scope, flash]);
  lab.stageRoot.add(set);

  let chart: Chart | null = null;
  let charted = -1;
  const session = createGridSession({
    tripped(tripS) {
      lab.sound.relay();
      ui.toast(`${OWN.tripped} ${fmtUnit(tripS, 's', { digits: 1 })} (≤ 2 s)`, {
        tone: 'ok',
        icon: 'check',
        duration: 4,
      });
      if (session.forming) ui.toast(OWN.formingIsland, { icon: 'home', duration: 4 });
    },
  });
  const s = session.state;
  const sendPQ = (): void => session.setPQ(ui.value<number>('p8') * 1000, ui.value<number>('q8') * 1000);
  const connected = (): boolean => s.relayClosed;
  const [followName, formName] = splitPair(doc(ID, 13));
  // phase of the inverter phasor relative to the grid's: −Δφ before the relay closes, the load angle δ after
  let lead = -Math.PI / 2;
  let amp = 1;
  let relay = 0;
  let safe = 0;
  const p = (name: keyof typeof wall.points, dy = 0): (() => Vector3) => {
    const out = new Vector3();
    return () => wall.group.localToWorld(out.copy(wall.points[name])).setY(out.y + dy);
  };
  const tmp = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.9, 5.5, 13.9],
        target: [0.35, 3.4, 0],
        fov: 30,
        frameAspect: 1.36,
        orbit: { azimuth: 0.45, polar: 0.25 },
        fit: { center: [0.6, 3.3, 0], radius: 6 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        session.restart();
        session.setManualFreq(ui.value<number>('f8'));
        session.setPhaseErrorDeg(ui.value<number>('phi8'));
        session.setForming(ui.value<string>('ctl8') === 'forming');
        sendPQ();
        charted = -1;
      },
      post: { bloomIntensity: 1.1 },
    },
    ui: {
      hint: OWN.hint8,
      honesty: ['simplified', { text: OWN.spin8 }, 'notToScale'],
      controls: [
        {
          type: 'slider',
          id: 'f8',
          label: doc(ID, 1),
          min: 49,
          max: 51,
          step: 0.01,
          value: 50.4,
          unit: 'Hz',
          digits: 2,
          visible: () => !connected(),
          disabled: () => s.pllOn,
          onChange: (v) => session.setManualFreq(v),
        },
        {
          type: 'slider',
          id: 'phi8',
          label: doc(ID, 2),
          min: -180,
          max: 180,
          step: 1,
          value: 90,
          unit: '°',
          digits: 0,
          visible: () => !connected(),
          disabled: () => s.pllOn,
          onChange: (v) => session.setPhaseErrorDeg(v),
        },
        {
          type: 'slider',
          id: 'p8',
          label: doc(ID, 7),
          min: 0,
          max: 6,
          step: 0.1,
          value: 3,
          unit: 'kW',
          digits: 1,
          visible: connected,
          onChange: sendPQ,
        },
        {
          type: 'slider',
          id: 'q8',
          label: doc(ID, 8),
          min: -3,
          max: 3,
          step: 0.1,
          value: 0,
          unit: 'kvar',
          digits: 1,
          visible: connected,
          onChange: sendPQ,
        },
        {
          type: 'segmented',
          id: 'ctl8',
          items: [
            { id: 'following', label: followName },
            { id: 'forming', label: formName },
          ],
          value: 'following',
          onChange: (v) => session.setForming(v === 'forming'),
        },
        {
          type: 'stats',
          id: 'sync8',
          columns: 3,
          visible: () => !connected(),
          items: [
            {
              label: OWN.sync,
              get: () => (s.sync.inSync ? OWN.syncYes : OWN.syncNo),
              color: () => (s.sync.inSync ? STATUS.ok : STATUS.alarm),
            },
            { label: OWN.df, get: () => (s.gridPresent ? fmtUnit(s.sync.dfHz, 'Hz', { digits: 2 }) : '—') },
            { label: OWN.dphi, get: () => (s.gridPresent ? fmtUnit(s.dphiDeg, '°', { digits: 0 }) : '—') },
          ],
        },
        {
          type: 'stats',
          id: 'pq8',
          columns: 2,
          visible: connected,
          items: [
            { label: OWN.delta, get: () => fmtUnit(session.pq.deltaDeg, '°', { digits: 1 }) },
            { label: OWN.uInv, get: () => fmtUnit(session.pq.uInvV, 'V', { digits: 1 }) },
            { label: OWN.qNow, get: () => fmtSI(session.pq.qVar, 'var') },
            { label: OWN.current, get: () => fmtUnit(session.pq.currentA, 'A', { digits: 1 }) },
          ],
        },
        {
          type: 'note',
          id: 'qlim8',
          text: doc(ID, 9),
          icon: 'warning',
          color: STATUS.warning,
          visible: () => connected() && session.pq.qLimited,
        },
        {
          type: 'note',
          id: 'dark8',
          text: OWN.houseDark,
          icon: 'warning',
          color: STATUS.alarm,
          visible: () => !session.housePowered,
        },
        {
          type: 'button',
          id: 'pll8',
          label: doc(ID, 5),
          icon: 'target',
          onClick: () => {
            session.pll(!s.pllOn);
            lab.sound.click(1.2);
          },
        },
        {
          type: 'button',
          id: 'relay8',
          label: doc(ID, 3),
          icon: 'link',
          primary: true,
          onClick: () => {
            if (s.relayClosed || !s.gridPresent) return;
            const r = session.close();
            sendPQ();
            lab.sound.relay();
            if (r.soft) ui.toast(OWN.softClose, { tone: 'ok', icon: 'check' });
            else {
              flash.fire(wall.points.relay.toArray());
              lab.sound.zap();
              ui.toast(`${doc(ID, 4)} (${OWN.inrush} ${fmtSI(r.inrushA, 'A')})`, {
                tone: 'alarm',
                icon: 'warning',
                duration: 4,
              });
            }
          },
        },
        {
          type: 'button',
          id: 'grid8',
          label: doc(ID, 10),
          icon: 'lightning',
          onClick: () => {
            const on = !s.gridPresent;
            session.grid(on);
            charted = -1;
            lab.sound.click(on ? 1.2 : 0.7);
            if (!on && s.relayClosed)
              ui.toast(OWN.islandNow, { tone: 'warning', icon: 'warning', duration: 3 });
            if (on) ui.toast(OWN.gridBack, { icon: 'info' });
          },
        },
        {
          type: 'button',
          id: 'again8',
          label: OWN.restart,
          icon: 'resetView',
          onClick: () => {
            session.restart();
            session.setManualFreq(ui.value<number>('f8'));
            session.setPhaseErrorDeg(ui.value<number>('phi8'));
            charted = -1;
          },
        },
      ],
      board: {
        title: OWN.board8,
        size: 'sm',
        // the board appears only for the loss-of-mains experiment (it would narrow the scene otherwise)
        visible: () => !s.gridPresent && session.drift.t.length > 1,
        children: [
          {
            type: 'chart',
            id: 'drift8',
            chart: {
              height: 150,
              x: { min: 0, max: 0.8, label: OWN.axisT },
              y: { min: 49.8, max: 51.4, label: OWN.axisFreq, ticks: [50, 50.5, 51] },
              series: [
                { id: 'f', color: 'yellow' },
                { id: 'lim', color: 'red', dash: true, label: OWN.tripLimit },
              ],
            },
            init: (c) => {
              chart = c;
              c.setData('lim', [0, 0.8], [ISLANDING.fMaxHz, ISLANDING.fMaxHz]);
            },
            update: (c) => {
              if (charted === session.drift.t.length) return;
              charted = session.drift.t.length;
              c.setData('f', session.drift.t, session.drift.f);
            },
          },
        ],
      },
      callouts: [
        {
          anchor: () => phasors.localToWorld(tmp.set(-1.2, 1.55, 0)),
          text: () => `${OWN.uGridPhasor} · ${OWN.uInvPhasor}`,
          side: 'up',
        },
        { anchor: p('relay'), text: OWN.relayBig, color: 'cyan', side: 'up' },
        { anchor: p('gridSwitch'), text: OWN.streetSwitch, side: 'right' },
        {
          anchor: p('lineman', 0.55),
          text: doc(ID, 12),
          color: 'green',
          side: 'up',
          visible: () => safe > 0.5,
        },
        { anchor: p('window'), text: doc(ID, 11), side: 'up', visible: () => session.islanding },
      ],
      hotspots: [
        { anchor: p('inverter'), content: 'grid-forming-inverter' },
        { anchor: p('lineman', -0.5), content: 'lineman' },
        { anchor: p('meter'), content: 'bidirectional-meter' },
        { anchor: p('service'), content: 'voltage-rise' },
      ],
    },
    probe: () => ({
      df: s.sync.dfHz,
      dphi: s.dphiDeg,
      inSync: s.sync.inSync,
      pll: s.pllOn,
      closed: s.relayClosed,
      soft: s.lastClose?.soft ?? null,
      inrush: s.lastClose?.inrushA ?? 0,
      grid: s.gridPresent,
      trip: s.tripTimeS,
      delta: session.pq.deltaDeg,
      uInv: session.pq.uInvV,
      q: session.pq.qVar,
      qLimited: session.pq.qLimited,
      forming: session.forming,
      powered: session.housePowered,
      safe: session.lineSafe,
      chart: chart !== null,
    }),
    update(dt, t) {
      if (lab.isCurrent(ID)) session.tick(dt);
      const pq = session.pq;
      // phasors: the grid's turns steadily; the inverter's trails by Δφ, or leads by δ once connected
      const wantLead = connected() ? pq.deltaDeg * RAD : -s.dphiDeg * RAD;
      lead = connected() ? damp(lead, wantLead, 8, dt) : wantLead;
      amp = damp(amp, connected() ? pq.uInvV / 230 : 1, 8, dt);
      const on = s.outputOn ? 1 : 0;
      phasors.angle = session.spin;
      phasors.set(0, s.gridPresent ? 0.86 : 0.02, 0);
      phasors.set(1, 0.86 * amp * on, lead);
      scope.phase = session.spin;
      scope.setWave(0, Math.sin, s.gridPresent ? 0.8 : 0);
      scope.setWave(1, (th) => Math.sin(th + lead), 0.8 * amp * on);
      // the wall: relay arm, lamps, LEDs, the lit window
      relay = damp(relay, s.relayClosed ? 1 : 0, 14, dt);
      wall.setRelay(relay);
      wall.setSync(s.relayClosed || s.sync.inSync);
      wall.setGrid(s.gridPresent);
      safe = damp(safe, session.lineSafe ? 1 : 0, 6, dt);
      wall.setSafe(safe);
      wall.setLit(session.housePowered ? 1 : 0);
      wall.inverter.setLeds({
        grid: s.gridPresent,
        pv: s.outputOn,
        bat: session.forming,
        alarm: session.islanding,
      });
      wall.update(dt, t);
      // flows: export through relay and meter while connected; a little import while the relay is open
      const k = connected() && s.outputOn ? Math.max(0.12, pq.pW / 6000) : 0;
      wall.wires.toRelay.material.power = s.outputOn ? Math.max(k, 0.15) : 0;
      wall.wires.toMeter.material.power = k;
      const svc = wall.wires.service.material;
      svc.power = k > 0 ? k : s.gridPresent ? 0.25 : 0;
      svc.speed = (k > 0 ? 1 : -1) * Math.abs(svc.speed);
      const rq = wall.wires.reactive.material;
      rq.power = connected() && s.gridPresent ? Math.min(1, Math.abs(pq.qVar) / 3000) : 0;
      rq.speed = (pq.qVar >= 0 ? 1 : -1) * Math.abs(rq.speed);
      lab.sound.hum = 0.1 + 0.3 * k;
      if (session.islanding) lab.sound.buzz = 0.2;
    },
  };
};
