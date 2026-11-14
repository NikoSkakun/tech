/**
 * Step 10 `mix` — «Структура генерації: світ і Україна». Two 3D rings hang over the archipelago: the world (big)
 * and Ukraine (small), sectors in the plant-type colours. Rays run from each world sector to its island, and every
 * island's line to the ring glows in proportion to its world share. The year switches rebuild the rings smoothly;
 * the board lists shares and TWh (estimates carry «≈»; Ukraine 2025 is an estimate without an official total).
 */
import { Vector3 } from 'three';
import { RibbonLines } from '@/fx';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { LISTS, OWN } from '../labels-own';
import { MIX, SECTOR_ISLAND, SECTORS, type MixId, type Sector } from '../mix-data';
import { createDonut } from '../parts/donut';
import { PLANT_IDS } from '../plants-data';
import { group, tag } from '../world';

const ID = 'mix';
const BLEND_S = 1;

/** «Світ: 2015 · 2025» → { title: 'Світ', items: ['2015', '2025'] }. */
function parseSwitch(label: string): { title: string; items: string[] } {
  const [title = '', rest = ''] = label.split(':');
  return { title: title.trim(), items: rest.split('·').map((s) => s.trim()) };
}

export const mix: StepFactory = (hub) => {
  const { ctx, ui, arch } = hub;
  const set = group(ID, 0, 46, 30);
  hub.stageRoot.add(set);
  const world = createDonut(20, 7, 4);
  world.group.position.set(-22, 0, 0);
  const ua = createDonut(12, 4.6, 3);
  ua.group.position.set(24, -4, 0);
  set.add(world.group, ua.group);
  const rays = new RibbonLines({ capacity: 2048, color: 'yellow', width: 0.35, blend: 'normal' });
  set.add(rays);
  const wSwitch = parseSwitch(doc(ID, 0));
  const uSwitch = parseSwitch(doc(ID, 2));
  const wId = (): MixId => (ui.value<string>('w10') === '2015' ? 'world2015' : 'world2025');
  const uId = (): MixId => (ui.value<string>('u10') === '2021' ? 'ua2021' : 'ua2025');
  const st = { w: { from: 'world2025' as MixId, to: 'world2025' as MixId, t: 1 }, u: { from: 'ua2025' as MixId, to: 'ua2025' as MixId, t: 1 }, hover: null as Sector | null };
  const tags = (size: number) =>
    SECTORS.map((s) => {
      const t = tag('', size, 'white', 'display');
      set.add(t);
      return { s, t };
    });
  const tagsW = tags(18);
  const tagsU = tags(16);
  const name = (s: Sector): string => LISTS.sectorNames[SECTORS.indexOf(s)] ?? s;
  const pct = (m: MixId, s: Sector): number | undefined => (MIX[m].shares as Partial<Record<Sector, number>>)[s];
  const fmt = (v: number): string => (Math.round(v * 10) / 10).toString().replace('.', ',');
  for (const d of [world, ua]) {
    for (const s of SECTORS) {
      ctx.input.register(d.meshes[s], {
        tooltip: () => {
          const m = d === world ? wId() : uId();
          const v = pct(m, s) ?? 0;
          const twh = MIX[m].totalTWh ? ` · ${MIX[m].approx ? '≈ ' : ''}${Math.round((MIX[m].totalTWh * v) / 100).toLocaleString('uk-UA')} TWh` : '';
          return `${name(s)}: ${MIX[m].approx ? '≈ ' : ''}${fmt(v)} %${twh}`;
        },
        enabled: () => hub.isCurrent(ID),
        hover: (over) => (st.hover = over ? s : st.hover === s ? null : st.hover),
      });
    }
  }
  const tmp = new Vector3();
  ctx.qa.probe('world', () => world.group.getWorldPosition(new Vector3()));
  ctx.qa.probe('ua', () => ua.group.getWorldPosition(new Vector3()));

  return {
    id: ID,
    hall: true,
    turboSet: true,
    shots: {
      [ID]: { position: [0, 66, 150], target: [0, 36, 24], fov: 40, drift: 0.4, fit: { center: [0, 40, 28], radius: 52 } },
    },
    stage: {
      show: [set],
      enter: () => {
        st.w = { from: wId(), to: wId(), t: 1 };
        st.u = { from: uId(), to: uId(), t: 1 };
        world.set({}, MIX[wId()].shares, 1);
        ua.set({}, MIX[uId()].shares, 1);
      },
    },
    ui: {
      honesty: [{ text: OWN.estimate, visible: () => uId() === 'ua2025' || wId() === 'world2015' }, 'notToScale'],
      controls: [
        { type: 'segmented', id: 'w10', label: wSwitch.title, items: wSwitch.items.map((y) => ({ id: y, label: y })), value: '2025', onChange: () => hub.sound.click() },
        { type: 'segmented', id: 'u10', label: uSwitch.title, items: uSwitch.items.map((y) => ({ id: y.slice(0, 4), label: y })), value: '2025', onChange: () => hub.sound.click() },
      ],
      board: {
        title: OWN.mixBoard,
        size: 'sm',
        children: [
          {
            type: 'table',
            id: 'mix10',
            head: [OWN.source, wSwitch.title, uSwitch.title],
            rows: () => SECTORS.filter((s) => pct(wId(), s) !== undefined || pct(uId(), s) !== undefined).map((s) => [name(s), pct(wId(), s) === undefined ? '' : `${MIX[wId()].approx ? '≈ ' : ''}${fmt(pct(wId(), s)!)} %`, pct(uId(), s) === undefined ? '' : `≈ ${fmt(pct(uId(), s)!)} %`]),
            highlight: () => SECTORS.filter((s) => pct(wId(), s) !== undefined || pct(uId(), s) !== undefined).indexOf(st.hover ?? 'coal'),
          },
        ],
      },
      callouts: [
        { anchor: () => world.group.localToWorld(tmp.set(0, 23, 0)), text: () => `${wSwitch.title} ${wId().slice(-4)}`, side: 'left', priority: 1 },
        { anchor: () => ua.group.localToWorld(tmp.set(0, 14, 0)), text: () => `${uSwitch.title} ${uId().slice(-4)}${uId() === 'ua2025' ? ` (${doc(ID, 3)})` : ''}`, side: 'right', priority: 2 },
      ],
      hotspots: [{ anchor: () => ua.group.localToWorld(new Vector3(13, -10, 0)), content: 'data-note' }],
    },
    probe: () => ({ world: wId(), ua: uId(), blendW: st.w.t, blendU: st.u.t, coalAngle: world.angles.coal[1] - world.angles.coal[0] }),
    update(dt) {
      if (!hub.isCurrent(ID)) return;
      for (const [k, d, id] of [['w', world, wId()], ['u', ua, uId()]] as const) {
        const b = st[k];
        if (b.to !== id) Object.assign(b, { from: b.to, to: id, t: 0 });
        if (b.t < 1) {
          b.t = Math.min(1, b.t + dt / BLEND_S);
          d.set(MIX[b.from].shares, MIX[b.to].shares, b.t);
        }
      }
      for (const [tags, d, m] of [[tagsW, world, wId()], [tagsU, ua, uId()]] as const) {
        for (const { s, t } of tags) {
          const v = pct(m, s);
          t.visible = v !== undefined && v >= 3;
          if (!t.visible) continue;
          t.text = `${MIX[m].approx ? '≈' : ''}${fmt(v!)} %`;
          t.position.copy(set.worldToLocal(d.mid(s, tmp)));
        }
      }
      const lines: { points: Vector3[] }[] = [];
      for (const id of PLANT_IDS) arch.want.line[id] = 0.06;
      for (const s of SECTORS) {
        const isl = SECTOR_ISLAND[s];
        const v = pct(wId(), s);
        if (!isl || v === undefined) continue;
        lines.push({ points: [set.worldToLocal(world.mid(s, new Vector3())), set.worldToLocal(arch.satTop(isl, new Vector3()))] });
        arch.want.line[isl] = Math.max(arch.want.line[isl], 0.08 + v / 22);
      }
      rays.setLines(lines);
      arch.want.ring = 1;
    },
  };
};
