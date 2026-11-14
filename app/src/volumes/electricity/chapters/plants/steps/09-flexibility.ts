/**
 * Step 9 `flexibility` — «Маневреність: хто встигне за попитом». Ten lanes float above the hub; each column is a
 * plant type's power in % of its rating. «Стрибок попиту +20 %» runs the race of plants sim M6
 * (`createPowerRace`, clock 1 s = 1 min): every dispatchable lane chases the red demand bar at its own ramp rate;
 * flags mark the finish. Wind and sun follow the weather, not the demand. «Ніч → ранок» plays 03:00 → 09:00
 * (1 s = 30 min, illustrative weather); «Блекаут» drops everything and only black-start lanes (green rings) restart.
 */
import { Vector3 } from 'three';
import { LANES, createPowerRace, type LaneId } from '@electricity/sim/plants';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { LISTS, OWN } from '../labels-own';
import { COL_H, createRaceLanes, LANE_IDS } from '../parts/race-lanes';
import { morningDemandPct, solarPct, windPct } from '../sim-bindings/weather';
import { group, tag } from '../world';

const ID = 'flexibility';
type Mode = 'jump' | 'night' | 'blackout';
const RUN_MIN = 12;
const NIGHT_S = 12;
const isLane = (id: string): id is LaneId => id in LANES;

export const flexibility: StepFactory = (hub) => {
  const { ctx, arch } = hub;
  const set = group(ID, 0, 22, 18);
  hub.stageRoot.add(set);
  const lanes = createRaceLanes();
  set.add(lanes.group);
  const names = LANE_IDS.map((id, i) => {
    const t = tag(LISTS.laneNames[i] ?? id, 16, 'white', 'display');
    t.position.set(lanes.x(i), i % 2 ? -2.6 : -6.2, 4.6);
    set.add(t);
    return t;
  });
  void names;
  const race = createPowerRace();
  const st = { mode: 'jump' as Mode, t: 0 };
  const start = (m: Mode): void => {
    st.mode = m;
    st.t = 0;
    if (m === 'jump') race.demandJump();
    if (m === 'blackout') race.blackout();
    if (m === 'night') race.reset();
  };
  const hour = (): number => 3 + Math.min(6, (st.t / NIGHT_S) * 6);
  const clockMin = (): number => (st.mode === 'night' ? (hour() - 3) * 60 : race.timeMin);
  const pct = (i: number): number => {
    const id = LANE_IDS[i]!;
    if (id === 'wind') return st.mode === 'blackout' ? 0 : windPct(clockMin());
    if (id === 'solar') return st.mode === 'blackout' ? 0 : st.mode === 'night' ? solarPct(hour()) : solarPct(12);
    if (st.mode === 'night') return id === 'nuclear' ? 90 : morningDemandPct(hour());
    return race.lane(id).pct;
  };
  const finish = (i: number): number | null => {
    const id = LANE_IDS[i]!;
    return st.mode !== 'night' && isLane(id) ? race.lane(id).finishedAtMin : null;
  };
  ctx.qa.probe('track', () => set.localToWorld(new Vector3(lanes.x(0) - 4, 2, 0)));
  const fmt = (v: number): string => v.toFixed(1).replace('.', ',');

  return {
    id: ID,
    hall: true,
    turboSet: true,
    shots: {
      [ID]: { position: [0, 40, 86], target: [0, 31, 18], fov: 40, drift: 0.4, fit: { center: [0, 33, 18], radius: 48 } },
    },
    stage: {
      show: [set],
      enter: (info) => {
        start('jump');
        if (info.instant) race.step(RUN_MIN);
      },
    },
    ui: {
      honesty: [{ sped: 60, visible: () => st.mode !== 'night' }, { sped: 1800, visible: () => st.mode === 'night' }, 'simplified'],
      controls: [
        { type: 'button', id: 'jump9', label: doc(ID, 0), icon: 'play', primary: true, onClick: () => (start('jump'), hub.sound.whoosh()) },
        { type: 'button', id: 'night9', label: doc(ID, 1), onClick: () => (start('night'), hub.sound.click()) },
        { type: 'button', id: 'black9', label: doc(ID, 3), onClick: () => (start('blackout'), hub.sound.alarm()) },
        {
          type: 'stats',
          id: 'clock9',
          columns: 2,
          items: [
            { label: OWN.clock, get: () => clockMin(), unit: 'min', digits: 1, color: () => 'white' },
            { label: OWN.demand, get: () => (st.mode === 'night' ? morningDemandPct(hour()) : st.mode === 'blackout' ? 0 : 80), unit: '%', digits: 0, color: () => 'red' },
          ],
        },
      ],
      board: {
        title: OWN.raceBoard,
        size: 'sm',
        children: [
          {
            type: 'table',
            id: 'tbl9',
            head: [OWN.lane, 'P, %', OWN.finishMin],
            rows: () => LANE_IDS.map((id, i) => [LISTS.laneNames[i] ?? id, `${Math.round(pct(i))}`, finish(i) === null ? (st.mode === 'blackout' && isLane(id) && LANES[id].blackStartDelayMin === null ? '✕' : '—') : fmt(finish(i)!)]),
          },
        ],
      },
      hotspots: [{ anchor: () => set.localToWorld(new Vector3(lanes.x(0) - 4, COL_H * 0.5, 0)), content: 'base-mid-peak' }],
    },
    probe: () => ({ mode: st.mode, t: clockMin(), pct: LANE_IDS.map((_, i) => Math.round(pct(i) * 10) / 10), finished: LANE_IDS.map((_, i) => finish(i)) }),
    update(dt, t) {
      if (!hub.isCurrent(ID)) return;
      st.t += dt;
      if (st.mode !== 'night' && race.timeMin < RUN_MIN) race.step(dt);
      for (let i = 0; i < LANE_IDS.length; i++) {
        lanes.set(i, pct(i));
        lanes.flags[i]!.visible = finish(i) !== null;
        const id = LANE_IDS[i]!;
        lanes.rings[i]!.visible = st.mode === 'blackout' && isLane(id) && LANES[id].blackStartDelayMin !== null;
      }
      const demand = st.mode === 'night' ? morningDemandPct(hour()) : 80;
      lanes.demand.visible = st.mode !== 'blackout';
      lanes.demand.position.y = (demand / 100) * COL_H;
      lanes.clouds.forEach((c, k) => (c.position.y = COL_H + 5 + 0.6 * Math.sin(t * 0.8 + k)));
      arch.want.ring = st.mode === 'blackout' ? 0.05 : 0.8;
      for (const id of Object.keys(arch.want.line) as (keyof typeof arch.want.line)[]) arch.want.line[id] = st.mode === 'blackout' ? 0.05 : 0.6;
      hub.sound.hum = st.mode === 'blackout' ? 0 : 0.06;
    },
  };
};
