/**
 * Step 3 `dams` — «Греблі: як утримати річку». On the stand: the cross-section of a dam with the pressure
 * diagram (arrows longer with depth), the four types morphing into each other in 0,8 s (`dam-section.ts`), a
 * person and a 10-storey house for scale. «Рівень води» 0…105 % of the dam height (demo height 100 m, the
 * run-of-river weir 15 m) drives the arrows and the readouts p = ρ·g·h and F = ½·ρ·g·h² per metre of dam; above
 * 100 % the water spills over the crest and the red warning of the document appears.
 */
import { Vector3 } from 'three';
import { damForcePerMetreN, G as g, RHO } from '@electricity/sim/plant-hydro';
import { HOTSPOTS } from '../hotspots';
import { buildDamSection } from '../parts/dam-section';
import { DAM_HEIGHT, type DamType } from '../parts/dam-profiles';
import { hot } from './hot';
import type { StepFactory } from './types';

const MORPH_S = 0.8;

export const dams: StepFactory = ({ ctx, ui, L, stand }) => {
  const rig = buildDamSection();
  rig.group.position.set(4, 12, 0); // the rock block stands on the stand
  stand.top.add(rig.group);
  const aRig = ctx.stage.actor(rig.group, { appear: 'grow' });
  const type = (): DamType => ui.value<DamType>('dm.type');
  const levelFrac = (): number => ui.value<number>('dm.level') / 100;
  const depth = (): number => levelFrac() * DAM_HEIGHT[type()];
  // morph state: from → to over MORPH_S seconds (re-derived on entry, so a deep link shows the type at once)
  let from: DamType = 'gravity';
  let to: DamType = 'gravity';
  let t0 = -1e9;
  const morphTo = (next: DamType, instant = false): void => {
    from = instant ? next : to;
    to = next;
    t0 = instant ? -1e9 : ctx.clock.time;
  };
  const v = new Vector3();
  ctx.qa.expose('dams', () => ({ to, depth: depth() }));
  const pt = (name: Parameters<typeof rig.at>[0]) => (): Vector3 => rig.at(name, v.clone());
  return {
    id: 'dams',
    stage: { camera: 'dams', show: [stand.group, aRig], enter: () => morphTo(type(), true) },
    ui: {
      honesty: ['notToScale', 'simplified'],
      controls: [
        {
          type: 'segmented',
          id: 'dm.type',
          label: L.damType,
          value: 'gravity',
          items: [
            { id: 'gravity', label: L.gravity },
            { id: 'arch', label: L.arch },
            { id: 'embankment', label: L.embankment },
            { id: 'runOfRiver', label: L.runOfRiver },
          ],
          onChange: (id) => morphTo(id as DamType),
        },
        {
          type: 'slider',
          id: 'dm.level',
          label: L.waterLevel,
          min: 0,
          max: 105,
          step: 1,
          unit: '%',
          value: 90,
        },
        {
          type: 'note',
          id: 'dm.over',
          text: L.overflowWarn,
          icon: 'warning',
          color: 'red',
          visible: () => levelFrac() > 1,
        },
      ],
      board: {
        title: 'p = ρ·g·h · F = ½·ρ·g·h²',
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'dm.stats',
            columns: 2,
            items: [
              { label: L.pBottom, unit: 'MPa', digits: 2, get: () => (RHO * g * depth()) / 1e6 },
              { label: L.force, unit: 'MN', digits: 1, get: () => damForcePerMetreN(depth()) / 1e6 },
            ],
          },
          { type: 'readout', id: 'dm.h', label: 'h', unit: 'm', digits: 0, get: () => depth() },
        ],
      },
      callouts: [
        { anchor: pt('house'), text: L.house10, side: 'right', priority: 2 },
        { anchor: pt('person'), text: L.person, side: 'down', priority: 3 },
        {
          anchor: pt('core'),
          text: L.clayCore,
          side: 'up',
          priority: 1,
          visible: () => type() === 'embankment',
        },
        { anchor: pt('plan'), text: L.arch, side: 'up', priority: 1, visible: () => type() === 'arch' },
        { anchor: pt('bottom'), text: L.rock, side: 'left', priority: 4 },
      ],
      hotspots: [
        hot(pt('grout'), HOTSPOTS.dams.grout),
        hot(pt('gallery'), HOTSPOTS.dams.gallery, {
          visible: () => type() === 'gravity' || type() === 'arch',
        }),
      ],
    },
    update(_dt, t) {
      const k = Math.min(1, (ctx.clock.time - t0) / MORPH_S);
      const e = k * k * (3 - 2 * k);
      rig.set(from, to, e, levelFrac());
      rig.update(t);
    },
  };
};
