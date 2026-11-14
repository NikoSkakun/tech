/**
 * Step 3 `energy-chains` — «Ланцюги перетворення енергії». Above the machine hall floats the Sankey river of the
 * chosen plant type (plants sim M4): 100 units of primary energy enter on the left, bands pass the gates of the
 * conversions, losses peel off downward in pale red, and the electric band on the right climbs into the world
 * ring. The tabs swap the river (bands grow in, numbers on the gates count up); «Показати втрати» lights all loss
 * branches and shows their sum.
 */
import { Vector3 } from 'three';
import { createWire, curveThrough } from '@/fx';
import { sankeySummary, type SankeyType } from '@electricity/sim/plants';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { FORM_NAMES, LISTS, OWN } from '../labels-own';
import { RING } from '../layout';
import { buildSankey, type SankeyModel } from '../parts/sankey';
import { group, tag } from '../world';

const ID = 'energy-chains';
const TYPES: readonly SankeyType[] = ['coal', 'gasCcgt', 'nuclear', 'hydro', 'wind', 'solarPv', 'geothermal', 'biomass', 'fuelCell'];
const RIGHT = 30;
const Y = 26;

export const energyChains: StepFactory = (hub) => {
  const { ctx, ui, arch } = hub;
  const set = group(ID, 0, Y, 8);
  hub.stageRoot.add(set);
  const rivers = TYPES.map((type) => {
    const m: SankeyModel = buildSankey(type);
    m.group.position.x = RIGHT - m.width / 2;
    set.add(m.group);
    set.updateMatrixWorld(true);
    // the electric output climbs from the last gate to the ring
    const last = m.nodes.reduce((a, b) => (b.x > a.x ? b : a));
    const from = new Vector3(last.x + 1, last.y, 0);
    const world = m.group.localToWorld(from.clone());
    const ringAt = new Vector3(world.x, 0, world.z).normalize().multiplyScalar(RING.radius).setY(RING.y);
    const toLocal = m.group.worldToLocal(ringAt.clone());
    const out = createWire(curveThrough([from, from.clone().add(new Vector3(8, 2, 0)), toLocal]), { radius: 0.5, color: 'amber', repeat: 0.2, speed: 6, detail: 0.6, castShadow: false });
    m.group.add(out);
    const tags = m.nodes.map((n) => {
      const t = tag('', 20, 'white', 'display');
      t.position.set(n.x, n.y + n.h / 2 + 2.6, 1);
      m.group.add(t);
      return { n, t };
    });
    for (const b of m.bands) {
      const form = FORM_NAMES[b.flow.loss ? 'loss' : (m.nodes.find((x) => x.id === b.flow.to)?.form ?? 'thermal')];
      ctx.input.register(b.mesh, { tooltip: `${form}, ${String(b.flow.value).replace('.', ',')} %`, enabled: () => hub.isCurrent(ID) });
    }
    const actor = ctx.stage.actor(m.group, {
      appear: (o, v) => {
        o.scale.set(1, Math.max(0.001, v), 1);
        o.visible = v > 0.002;
      },
      inDuration: 0.8,
      outDuration: 0.3,
    });
    return { type, m, actor, tags };
  });
  const type = (): SankeyType => ui.value<SankeyType>('type3');
  const river = (): (typeof rivers)[number] => rivers[TYPES.indexOf(type())]!;
  const st = { since: 0 };
  const sync = (instant: boolean): void => {
    for (const r of rivers) if (ctx.stage.shown(r.actor) !== (r.type === type())) ctx.stage.toggle(r.actor, r.type === type(), { instant });
  };
  const biggestLoss = (): Vector3 => {
    const r = river();
    const b = r.m.bands.filter((x) => x.flow.loss).reduce((a, x) => (x.flow.value > a.flow.value ? x : a));
    return r.m.group.localToWorld(b.mid.clone());
  };
  const gridBand = (): Vector3 => {
    const r = rivers[TYPES.indexOf('hydro')]!;
    const b = r.m.bands.find((x) => x.flow.to === 'grid')!;
    return r.m.group.localToWorld(b.mid.clone());
  };
  ctx.qa.probe('loss', biggestLoss);
  const loss = (): boolean => ui.value<boolean>('loss3');
  const summary = () => sankeySummary(type());

  return {
    id: ID,
    turboSet: true,
    hall: true,
    shots: {
      [ID]: { position: [-2, Y + 6, 100], target: [-2, Y - 3, 8], fov: 40, drift: 0.5, fit: { center: [-2, Y - 3, 8], radius: 46 } },
    },
    stage: {
      show: [set],
      enter: (info) => {
        sync(info.instant);
        st.since = info.instant ? 10 : 0;
      },
    },
    ui: {
      honesty: ['illustrative'],
      controls: [
        {
          type: 'segmented',
          id: 'type3',
          items: TYPES.map((t, i) => ({ id: t, label: LISTS.sankeyTabs[i] ?? t })),
          value: 'coal',
          onChange: () => {
            st.since = 0;
            hub.sound.click(1.2);
          },
        },
        { type: 'toggle', id: 'loss3', label: doc(ID, 2), value: false, onChange: () => hub.sound.click(0.8) },
        {
          type: 'stats',
          id: 'read3',
          columns: 2,
          items: [
            { label: OWN.toGrid, get: () => summary().gridShare, unit: '%', digits: 1, color: () => 'yellow' },
            { label: OWN.lossSum, get: () => summary().lossShare, unit: '%', digits: 1, color: () => (loss() ? 'red' : 'mist') },
          ],
        },
      ],
      hotspots: [
        { anchor: biggestLoss, content: 'waste-heat-branch', visible: () => type() !== 'hydro' },
        { anchor: gridBand, content: 'hydro-chain', visible: () => type() === 'hydro' },
      ],
    },
    probe: () => ({ type: type(), grid: summary().gridShare, loss: loss(), lossGlow: river().m.bands.find((b) => b.flow.loss)!.mat.emissiveIntensity }),
    update(dt, t) {
      if (!hub.isCurrent(ID)) return;
      sync(false);
      st.since += dt;
      const k = Math.min(1, st.since / 0.9);
      const r = river();
      for (const { n, t: tg } of r.tags) tg.text = `${FORM_NAMES[n.form]}\n${String(Math.round(n.value * k * 10) / 10).replace('.', ',')}`;
      const pulse = loss() ? 0.6 + 0.4 * Math.sin(t * 5) : 0;
      for (const b of r.m.bands) if (b.flow.loss) b.mat.emissiveIntensity = pulse;
      arch.want.ring = 0.9;
      hub.sound.hum = 0.07;
    },
  };
};
