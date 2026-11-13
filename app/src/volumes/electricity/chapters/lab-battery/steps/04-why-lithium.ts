/**
 * Step 4 `why-lithium` — three scales weigh the cells for the same energy (lead-acid, LFP, NMC), columns show
 * Wh/kg; beside them the lithium atom with its loose valence electron and lithium metal floating on oil.
 * Model: `cellMassKg` (§M8: m = W/w, «корисні» m = W/(w·DoD)).
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { damp } from '@/engine/api';
import { SPECIFIC_ENERGY, cellMassKg, type MassChemistry } from '@electricity/sim/lab-battery';
import type { ColorLike } from '@/style';
import { note } from '../notes';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { createLithiumAtom, createLithiumJar } from '../parts/lithium';
import { createPlatformScale } from '../parts/scales';
import { frame } from '../shots';
import { group, tag } from '../world';

const ID = 'why-lithium';
const KINDS: readonly { chem: MassChemistry; color: ColorLike; x: number; name: string }[] = [
  { chem: 'leadAcid', color: 'slate', x: -2.55, name: L.leadAcid },
  { chem: 'lfp', color: 'teal', x: -0.55, name: 'LFP' },
  { chem: 'nmc', color: 'violet', x: 1.45, name: 'NMC' },
];

export const whyLithium: StepFactory = (lab) => {
  const { ui, mats } = lab;
  const scales = KINDS.map((k) => {
    const scale = createPlatformScale(mats, k.chem, k.color, SPECIFIC_ENERGY[k.chem].whPerKg);
    scale.group.position.set(k.x, 0, 0.75);
    const density = tag(fmtUnit(SPECIFIC_ENERGY[k.chem].whPerKg, 'Wh/kg'), 18, 'white', 'mono');
    density.position.set(0, 0.28, 0);
    scale.columnTop.add(density);
    return { ...k, scale, shown: 0, text: '' };
  });
  const atom = createLithiumAtom();
  atom.group.position.set(3.25, 3.05, -0.6);
  const jar = createLithiumJar(mats);
  jar.group.position.set(3.2, 0, 0.9);
  const set = group(`set:${ID}`, 0, 0, 0, [...scales.map((s) => s.scale.group), atom.group, jar.group]);
  lab.stageRoot.add(set);

  const target = (chem: MassChemistry): number => {
    const m = cellMassKg(ui.value<number>('energy4'), chem);
    return ui.value<boolean>('usable4') ? m.usable : m.raw;
  };
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: frame([0.2, 2.4, 0.3], 7.9, 5.2, {
        azimuth: 0.17,
        elevation: 0.19,
        orbit: { azimuth: 0.9, polar: 0.3 },
      }),
    },
    stage: {
      show: [...scales.map((s) => s.scale.group), jar.group, atom.group],
      enter: (info) => {
        if (info.instant) for (const s of scales) s.shown = target(s.chem);
      },
    },
    ui: {
      hint: L.hint4,
      honesty: ['simplified', 'notToScale'],
      controls: [
        {
          type: 'slider',
          id: 'energy4',
          label: L.energyNeeded,
          min: 0.1,
          max: 20,
          scale: 'log',
          step: 2,
          unit: 'kWh',
          value: 5,
          snaps: [5],
        },
        { type: 'toggle', id: 'usable4', label: L.usable, value: false },
        ...KINDS.map((k) => ({
          type: 'readout' as const,
          id: `mass4-${k.chem}`,
          label: k.name,
          unit: 'kg',
          digits: 1,
          get: () => target(k.chem),
        })),
        note('cells4', L.cellsOnly, 'honesty'),
      ],
      callouts: [
        { anchor: () => atom.valence.getWorldPosition(v), text: L.valence, color: 'cyan', side: 'up' },
        {
          anchor: () => atom.group.getWorldPosition(v).setY(v.y - 0.25),
          text: L.liAtom,
          color: 'coral',
          side: 'down',
        },
        ...scales.map((s) => ({
          // above the block (it grows with the mass), clear of the dial
          anchor: () => s.scale.block.getWorldPosition(v).setY(v.y + 0.9 * s.scale.block.scale.y + 0.12),
          text: s.name,
          color: s.color,
          side: 'up' as const,
        })),
      ],
      hotspots: [{ anchor: jar.chunk, content: 'lithium-metal' }],
    },
    probe: () => ({ lead: scales[0]!.shown, lfp: scales[1]!.shown, nmc: scales[2]!.shown }),
    update(dt, t) {
      for (const s of scales) {
        s.shown = damp(s.shown, target(s.chem), 5, dt);
        s.scale.setMass(s.shown);
        // the digital window of the scale shows the exact mass
        const text = fmtUnit(s.shown, 'kg', { digits: s.shown < 10 ? 1 : 0 });
        if (text !== s.text) s.scale.display.text = s.text = text;
      }
      atom.update(t);
      jar.update(t);
    },
  };
};
