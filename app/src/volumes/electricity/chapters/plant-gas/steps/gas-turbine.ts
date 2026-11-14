/**
 * Step 3 `gas-turbine` — «Анатомія газової турбіни». The roof and the south wall of the hall are gone; the gas
 * turbine lies in longitudinal section (seen from the south, 30° above): `sky` air thickens and warms to
 * `amber` in the compressor, meets `violet` fuel and burns `orange`/near-`white` in the annular combustor, cools
 * to `orange` through four turbine stages into the diffuser. Over the shaft the `yellow` work arrow of the
 * turbine splits into «компресору» (≈ half) and «генератору». «Розрізати» opens the casing 0…100 %; a click on
 * a section (or the «Секція» switch) lights it, dims the others and highlights its row of pressures and
 * temperatures on the board (model M1 at the current r, TIT of step 4). «Порівняти з авіадвигуном» slides a
 * turbofan of the same scale in front of the machine.
 */
import { Vector3 } from 'three';
import { fmtNumber, fmtPercent } from '@/content';
import { HOTSPOTS } from '../hotspots';
import { fill } from '../labels';
import { GT_SECTIONS, GT_X, type GtSection } from '../parts/gt-model';
import { hot } from './hot';
import type { StepFactory } from './types';

/** Atmospheric pressure, MPa. */
const P1 = 0.101;

export const gasTurbine: StepFactory = ({ ctx, ui, L, live, isl, gt, shell }) => {
  const hero = isl.ccgt.gt;
  const { arrows, sim, fan } = gt;
  const names: Record<GtSection, string> = { compressor: L.compressor, combustor: L.combustor, turbine: L.turbine };
  const active = (): boolean => ctx.stage.current === 'gas-turbine';
  for (const s of GT_SECTIONS)
    ctx.input.register(hero.pick[s], { tooltip: names[s], cursor: 'pointer', enabled: active, click: () => ui.set('gt.sec', s, { notify: true }) });
  // the turbofan stands in front of the machine (toward the viewer), slid in from the side
  fan.group.position.copy(hero.axis(GT_X.comp0)).add(new Vector3(0, 0.4, 6.5));
  const aFan = ctx.stage.actor(fan.group, { appear: 'pop' });
  const showFan = (on: boolean): void => {
    ctx.stage.toggle(aFan, on);
    ctx.camera.go(on ? 'gas-turbine-jet' : 'gas-turbine', { duration: 1.6 });
  };
  const sec = (): string => ui.value<string>('gt.sec');
  const world = (p: Vector3): Vector3 => hero.group.localToWorld(p.clone());
  const rows = (): string[][] => {
    const { res, r, titC } = sim.state;
    const p2 = P1 * r;
    const mpa = (a: number, b: number): string => `${fmtNumber(a, { digits: 2 })} → ${fmtNumber(b, { digits: 2 })}`;
    const deg = (a: number, b: number): string => `${fmtNumber(a, { digits: 0 })} → ${fmtNumber(b, { digits: 0 })}`;
    return [
      [names.compressor, mpa(P1, p2), deg(15, res.t2C)],
      [names.combustor, mpa(p2, p2), deg(res.t2C, titC)],
      [names.turbine, mpa(p2, P1), deg(titC, res.t4C)],
    ];
  };
  ctx.qa.expose('gt', () => ({ cut: hero.cut, focus: hero.focus, fan: fan.group.visible && fan.group.scale.x > 0.5, r: sim.state.r, tit: sim.state.titC, eta: sim.state.res.eta }));
  let unprobe: (() => void) | null = null;
  return {
    id: 'gas-turbine',
    stage: {
      camera: 'gas-turbine',
      show: [shell.hrsgFront, shell.inside, ...gt.flows, gt.arrowActor],
      enter: () => {
        hero.cut = ui.value<number>('gt.cut') / 100;
        unprobe = ctx.qa.probe('gt.turbine', () => hero.at('blade1'));
      },
      leave: () => {
        unprobe?.();
        unprobe = null;
        hero.cut = 0;
        hero.focus = null;
      },
    },
    ui: {
      honesty: [{ slowed: 140, text: L.shaftSlowed }, 'simplified'],
      controls: [
        { type: 'slider', id: 'gt.cut', label: L.cut, min: 0, max: 100, value: 100, step: 1, unit: '%', digits: 0 },
        {
          type: 'segmented',
          id: 'gt.sec',
          label: L.section,
          items: [{ id: 'all', label: L.allSections }, ...GT_SECTIONS.map((s) => ({ id: s, label: names[s] }))],
          value: 'all',
        },
        { type: 'button', id: 'gt.jet', label: L.jetEngine, icon: 'play', onClick: () => showFan(!(fan.group.visible && fan.group.scale.x > 0.5)) },
      ],
      board: {
        title: L.gtTable,
        size: 'md',
        children: [
          {
            type: 'table',
            id: 'gt.table',
            head: [L.section, L.pressure, L.temperature],
            rows,
            highlight: () => GT_SECTIONS.indexOf(sec() as GtSection),
          },
        ],
      },
      callouts: [
        { anchor: () => world(arrows.at.turbine), text: L.workTurbine, color: 'yellow', side: 'up', priority: 0 },
        { anchor: () => world(arrows.at.compressor), text: () => fill(L.workCompressor, fmtPercent(sim.state.res.compressorShare, 0)), color: 'amber', side: 'up', priority: 3 },
        { anchor: () => world(arrows.at.generator), text: () => fill(L.workGenerator, fmtPercent(1 - sim.state.res.compressorShare, 0)), color: 'yellow', side: 'up', priority: 4 },
        { anchor: () => hero.at('igv'), text: L.airIn, side: 'left', priority: 1 },
        { anchor: () => hero.at('exhaust'), text: () => fill(L.exhaustOut, `${fmtNumber(sim.state.res.t4C, { digits: 0 })} °C`), side: 'right', priority: 2 },
        { anchor: () => fan.anchorWorld('jet'), text: L.jetCaption, side: 'down', visible: () => fan.group.visible && fan.group.scale.x > 0.6 },
      ],
      hotspots: [
        hot(() => hero.at('igv'), HOTSPOTS['gas-turbine'].igv),
        hot(() => hero.at('bleed'), HOTSPOTS['gas-turbine'].bleed),
        hot(() => hero.at('starter'), HOTSPOTS['gas-turbine'].starter),
      ],
    },
    update() {
      live.gtTarget = 1;
      hero.cut = ui.value<number>('gt.cut') / 100;
      const s = sec();
      hero.focus = s === 'all' ? null : (s as GtSection);
      sim.set(ui.value<number>('br.r'), ui.value<number>('br.tit'));
      sim.apply(gt.flow, arrows);
    },
  };
};
