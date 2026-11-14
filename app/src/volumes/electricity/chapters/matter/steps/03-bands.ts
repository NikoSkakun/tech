/**
 * Step 3 `bands` — why some conduct and others do not. Left: the crystal (substance switch); right: the band
 * tower (§3). Entering plays the birth of the bands (N = 1 → 2 → 4 → 16 → 10²³); the substance switch moves the
 * conduction band (E_g of the substance), the temperature sets the rate of hops across the gap (∝ log n_i);
 * every hop also tears an electron out of a bond in the crystal.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtUnit } from '@/content';
import { SEMANTIC } from '@/style';
import {
  ATOM_COUNTS,
  BAND_MATERIALS,
  bandTower,
  conductivityRelativeToSi300,
  hopRatePerS,
  intrinsicCarrierDensity,
  type BandMaterialId,
} from '@electricity/sim/matter';
import { sci } from '../fmt';
import type { StepFactory } from '../chapter';
import { group } from '../chapter';
import { cap, docLabel, splitItems } from '../content';
import { DOC, L } from '../labels';
import { createBandTower, towerY } from '../parts/band-tower';
import { createMaterialCrystal } from '../parts/material-crystal';
import { HERO_Y, narrow } from '../world';

const ID = 'bands';
const IDS: BandMaterialId[] = ['Cu', 'Ge', 'Si', 'GaAs', 'diamond', 'SiO2'];
const COUNT_LABELS = ['1', '2', '4', '16', '10²³'];

/**
 * The shot follows the height of the tower: copper is one low band, the semiconductors add a conduction band
 * just above it, diamond and glass push it high — each framed so the tower stays the largest thing on screen.
 */
const SHOT = { semi: `${ID}-semi`, wide: `${ID}-wide` } as const;
const regime = (m: BandMaterialId): string =>
  BAND_MATERIALS[m].metal ? ID : BAND_MATERIALS[m].bandGapEv < 3 ? SHOT.semi : SHOT.wide;
function shot(y: number, radius: number) {
  const k = radius / 3.6;
  return {
    position: [0.15 + 0.65 * k, y + 1.0 * k, 13.4 * k] as [number, number, number],
    target: [-0.5, y, 0] as [number, number, number],
    fov: 32,
    orbit: { azimuth: 0.7, polar: 0.3 },
    fit: { center: [-0.5, y, 0] as [number, number, number], radius },
  };
}

/** Plain notation for 0,01…1000, scientific outside. */
function fmtRel(x: number): string {
  if (x === 0) return '≈ 0';
  if (x >= 0.01 && x < 1000) return fmtNumber(x, { maxDigits: x < 1 ? 2 : 1 });
  return sci(x, 1);
}

export const bandsStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const set = group(`set:${ID}`);
  lab.stand.add(set);
  const crystal = createMaterialCrystal(() => ctx.random.next());
  // the crystal is the companion: beside the valence band, close to the tower (the tower is the hero)
  crystal.group.position.set(-2.25, HERO_Y - 0.75, 0.4);
  crystal.group.scale.setScalar(0.85);
  const tower = createBandTower();
  tower.group.position.set(0.95, 0.1, 0);
  set.add(crystal.group, tower.group);

  const material = (): BandMaterialId => ui.value<string>('mat3') as BandMaterialId;
  const atoms = (): number => ATOM_COUNTS[Math.round(ui.value<number>('N3'))]!;
  const kelvin = (): number => ui.value<number>('T3');
  const ni = (): ReturnType<typeof intrinsicCarrierDensity> => intrinsicCarrierDensity(material(), kelvin());
  const rate = (): number => (BAND_MATERIALS[material()].metal ? 0 : hopRatePerS(ni().perCm3));
  let shown = '';
  let framed: string = ID; // shot in use
  let acc = 0.5;
  const sync = (): void => {
    const key = `${material()}:${atoms()}`;
    if (key === shown) return;
    shown = key;
    tower.setTarget(bandTower(material(), atoms()), BAND_MATERIALS[material()].metal);
    crystal.setMaterial(material());
    const r = regime(material());
    if (r !== framed && lab.isCurrent(ID)) ctx.camera.go(r, { duration: 1.4 });
    framed = r;
  };
  ui.onChange('mat3', () => audio.play('click'));
  let birth = false; // the entry animation is driving N (`set` without notify does not reach onChange)
  const own = (k: number): void => {
    ui.set('N3', k);
    if (k === ATOM_COUNTS.length - 1) birth = false;
  };
  ui.onChange('N3', () => {
    birth = false;
    audio.play('tick', { pitch: 0.8 + 0.1 * ui.value<number>('N3') });
  });

  const v = new Vector3();
  const at = (local: Vector3): Vector3 => tower.group.localToWorld(v.copy(local));
  ctx.qa.probe('tower3', tower.group);
  ctx.qa.probe('crystal3', crystal.group);
  ctx.qa.expose(ID, () => ({
    material: material(),
    atoms: atoms(),
    merged: tower.merged,
    holes: tower.holes,
    niPerCm3: ni().perCm3,
    hopRate: rate(),
    relative: conductivityRelativeToSi300(material(), kelvin()),
  }));

  return {
    id: ID,
    shots: { [ID]: shot(1.85, 2.45), [SHOT.semi]: shot(2.35, 3.1), [SHOT.wide]: shot(3.55, 3.95) },
    stage: {
      show: [crystal.group, tower.group],
      enter(info) {
        shown = '';
        framed = regime(material());
        if (framed !== ID) ctx.camera.go(framed, { duration: info.instant ? 0 : 1.6 });
        // the birth of the bands: 1 → 2 → 4 → 16 → 10²³ atoms — on every entry (next/back, map, deep link,
        // chapter entry); only reduced motion opens merged. Touching the slider hands control to the learner.
        if (ctx.reducedMotion) return;
        birth = true;
        own(0);
        for (let k = 1; k < ATOM_COUNTS.length; k++) info.scope.delay(0.4 + 0.55 * k, () => birth && own(k)); // merged at 2,6 s
      },
    },
    ui: {
      honesty: [{ kind: 'simplified', text: DOC.simplified }],
      controls: [
        {
          type: 'slider',
          id: 'N3',
          label: docLabel(ID, 0),
          min: 0,
          max: ATOM_COUNTS.length - 1,
          step: 1,
          value: ATOM_COUNTS.length - 1,
          format: (x: number) => COUNT_LABELS[Math.round(x)] ?? '',
        },
        {
          type: 'segmented',
          id: 'mat3',
          items: splitItems(DOC.bandMaterials).map((label, i) => ({ id: IDS[i]!, label })),
          value: 'Cu',
        },
        {
          type: 'slider',
          id: 'T3',
          label: docLabel(ID, 2),
          min: 0,
          max: 600,
          step: 10,
          value: 300,
          unit: 'K',
          digits: 0,
        },
        {
          type: 'stats',
          id: 'out3',
          items: [
            {
              label: L.bands.gap,
              get: () => fmtUnit(BAND_MATERIALS[material()].bandGapEv, 'eV', { maxDigits: 2 }),
            },
            {
              label: L.bands.ni,
              get: () =>
                BAND_MATERIALS[material()].metal
                  ? '—'
                  : ni().negligible
                    ? DOC.niZero
                    : `${sci(ni().perCm3, 1)} cm⁻³`,
            },
            {
              label: cap(docLabel(ID, 4)),
              get: () => fmtRel(conductivityRelativeToSi300(material(), kelvin())),
            },
            { label: `${cap(docLabel(ID, 3))}, 1/s`, get: () => fmtNumber(rate(), { digits: 1 }) },
          ],
        },
      ],
      callouts: [
        {
          anchor: () => at(new Vector3(0, towerY(-6), -0.7)),
          text: L.bands.valence,
          color: SEMANTIC.valenceBand,
          side: 'right',
        },
        {
          anchor: () => at(new Vector3(0, towerY(-2 + BAND_MATERIALS[material()].bandGapEv), -0.7)),
          text: L.bands.conduction,
          color: SEMANTIC.conductionBand,
          side: 'right',
          visible: () => !BAND_MATERIALS[material()].metal && tower.merged > 0.5,
        },
        {
          anchor: () => at(tower.gapMid),
          text: () => `E_g = ${fmtUnit(BAND_MATERIALS[material()].bandGapEv, 'eV', { maxDigits: 2 })}`,
          side: 'right',
          visible: () => !BAND_MATERIALS[material()].metal && tower.merged > 0.5,
        },
        { anchor: () => at(tower.axisTop), text: L.bands.axis, side: 'left' },
        {
          anchor: () => crystal.group.getWorldPosition(v).add(new Vector3(-0.85, 0.75, 0)),
          text: () => splitItems(DOC.bandMaterials)[IDS.indexOf(material())]!,
          side: 'left',
          visible: () => !narrow(lab), // on a phone the dock names the substance; the axis label keeps the corner
        },
      ],
      hotspots: [
        { anchor: () => at(tower.fermi), content: 'fermi-level', visible: () => tower.merged > 0.5 },
        {
          anchor: () => at(tower.gapMid).add(new Vector3(-1.2, 0, 0.6)),
          content: 'band-gap',
          visible: () => !BAND_MATERIALS[material()].metal && tower.merged > 0.5,
        },
        { anchor: () => at(tower.hole), content: 'hole-hint', visible: () => tower.holes > 0 },
      ],
    },
    update(dt, t) {
      sync();
      acc += rate() * dt;
      if (acc >= 1) {
        acc -= 1;
        if (tower.hop()) {
          crystal.release();
          audio.play('tick', { pitch: 1.6, gain: 0.4 });
        }
      }
      tower.update(dt, t);
      crystal.update(dt, t);
      crystal.group.rotation.y = 0.5 + 0.15 * Math.sin(t * 0.2);
      lab.live.crackle = BAND_MATERIALS[material()].metal ? 0.3 : 0;
      lab.live.crackleRate = 0.5;
    },
  };
};
