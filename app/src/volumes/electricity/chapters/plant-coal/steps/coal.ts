/**
 * Step 2 `coal` — «Вугілля: сонячне світло, законсервоване 300 мільйонів років». Over a loaded gondola floats the
 * glass time capsule: the Carboniferous swamp grows, falls, is buried and pressed into a glossy seam (loops).
 * Beside it the rank ladder (lignite → bituminous → anthracite) with energy columns, and in front, on a tray off the
 * island, one little gondola for every wagon a 1000 MW unit at 40 % burns per day.
 * Interaction: «Тип вугілля» (also a tap on a lump) → board numbers (lower heating value, CO₂ per MWh of heat,
 * wagons per day — model M1) and the wagon field rolls to the new count.
 */
import { Vector3 } from 'three';
import { COALS, co2PerMWhHeatKg, fuelUse, type CoalType } from '@electricity/sim/plant-coal';
import { fmtNumber, fmtUnit } from '@/content';
import { createPulseRings } from '@/fx';
import { HOTSPOTS } from '../hotspots';
import { ISLAND, RIGS } from '../layout';
import { buildCapsule } from '../parts/capsule';
import { RANKS, buildHeroWagon, buildLadder, buildWagonField } from '../parts/coal-props';
import { SIDING_Z } from '../parts/yard';
import type { StepFactory } from './types';

export const coal: StepFactory = ({ ctx, ui, L, hot }) => {
  const g = ISLAND.ground;
  const c = RIGS.capsule;
  const wagon = buildHeroWagon();
  wagon.group.position.set(c.x, g + 0.3, SIDING_Z);
  const capsule = buildCapsule();
  capsule.group.position.set(c.x, g + c.y, SIDING_Z);
  const ladder = buildLadder(new Vector3(RIGS.ladder.x, g + RIGS.ladder.y, RIGS.ladder.z));
  const field = buildWagonField(new Vector3(RIGS.wagonField.x, g + RIGS.wagonField.y, RIGS.wagonField.z));
  const ring = createPulseRings({ color: 'yellow', size: 12, billboard: false, intensity: 1.5 });
  ring.rotation.x = -Math.PI / 2;
  ctx.root.add(wagon.group, capsule.group, ladder.group, field.group, ring);
  const type = (): CoalType => ui.value<CoalType>('c.type');
  const name: Record<CoalType, string> = { lignite: L.lignite, bituminous: L.bituminous, anthracite: L.anthracite };
  const active = (): boolean => ctx.stage.current === 'coal';
  for (const t of RANKS) {
    const lump = ladder.group.children[1 + RANKS.indexOf(t) * 2]!;
    ctx.input.register(lump, { tooltip: name[t], enabled: active, click: () => ui.set('c.type', t, { notify: true }) });
  }
  const unit = (t: CoalType) => fuelUse(t, 1000, 0.4);
  ctx.qa.expose('coal', () => ({ type: type(), wagons: Math.round(field.shown), target: field.target }));
  ctx.qa.probe('coal.anthracite', () => ladder.lumps.anthracite);
  const seam = capsule.group.position.clone().add(capsule.seam);
  return {
    id: 'coal',
    stage: {
      camera: 'coal',
      show: [wagon.group, capsule.group, ladder.group, field.group, ring],
      enter: (info) => {
        field.target = Math.round(unit(type()).wagonsPerDay);
        if (info.instant) field.shown = field.target;
      },
    },
    ui: {
      honesty: ['notToScale', 'illustrative', { sped: 1e14 }],
      controls: [
        {
          type: 'segmented',
          id: 'c.type',
          label: L.coalType,
          value: 'bituminous',
          items: RANKS.map((t) => ({ id: t, label: name[t] })),
          onChange: (v) => (field.target = Math.round(unit(v as CoalType).wagonsPerDay)),
        },
      ],
      board: {
        title: L.wagonsQuestion,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'c.stats',
            items: [
              { label: L.wagonsDay, get: () => Math.round(unit(type()).wagonsPerDay), digits: 0 },
              { label: L.lhv, get: () => COALS[type()].lhvMJkg, unit: 'MJ/kg', digits: 0 },
              { label: L.co2Heat, get: () => co2PerMWhHeatKg(type()), unit: 'kg', digits: 0 },
            ],
          },
        ],
      },
      callouts: [
        ...RANKS.map((t, i) => ({
          anchor: () => ladder.lumps[t],
          text: () => `${name[t]} · ${fmtUnit(COALS[t].lhvMJkg, 'MJ/kg')}`,
          side: (['left', 'up', 'right'] as const)[i]!,
          priority: i + 1,
        })),
        { anchor: () => field.group.position.clone().add(new Vector3(44, 2, 0)), text: () => `${fmtNumber(Math.round(field.shown))} × 70 t`, side: 'up', priority: 0 },
      ],
      hotspots: [hot(() => seam, HOTSPOTS.coal.seam)],
    },
    update(dt, t) {
      capsule.phase((t % capsule.period) / capsule.period);
      capsule.group.rotation.y = t * 0.12;
      field.update(dt);
      ring.position.copy(ladder.lumps[type()]).add(new Vector3(0, -2.8, 0));
    },
  };
};
