import { describe, expect, it } from 'vitest';
import { defineContent, type ContentSource } from '@/content/define';
import atom from '../generated/atom.json';
import chargeField from '../generated/charge-field.json';
import matter from '../generated/matter.json';
import current from '../generated/current.json';
import magnetism from '../generated/magnetism.json';
import generatorAc from '../generated/generator-ac.json';
import transformer from '../generated/transformer.json';
import plants from '../generated/plants.json';
import plantCoal from '../generated/plant-coal.json';
import plantGas from '../generated/plant-gas.json';
import plantNuclear from '../generated/plant-nuclear.json';
import plantHydro from '../generated/plant-hydro.json';
import plantWind from '../generated/plant-wind.json';
import plantSolar from '../generated/plant-solar.json';
import plantGeoBio from '../generated/plant-geo-bio.json';
import plantOcean from '../generated/plant-ocean.json';
import plantFuture from '../generated/plant-future.json';
import transmission from '../generated/transmission.json';
import grid from '../generated/grid.json';
import distribution from '../generated/distribution.json';
import home from '../generated/home.json';
import labPv from '../generated/lab-pv.json';
import labInverter from '../generated/lab-inverter.json';
import labBattery from '../generated/lab-battery.json';
import labHybridHome from '../generated/lab-hybrid-home.json';

/**
 * Every generated runtime file (tools/content/export_runtime.py) is a typed `ContentSource`: the static imports
 * make `pnpm typecheck` fail if the export ever changes shape, the test runs `defineContent` on each one.
 */
const GENERATED: Record<string, ContentSource> = {
  atom: atom,
  'charge-field': chargeField,
  matter: matter,
  current: current,
  magnetism: magnetism,
  'generator-ac': generatorAc,
  transformer: transformer,
  plants: plants,
  'plant-coal': plantCoal,
  'plant-gas': plantGas,
  'plant-nuclear': plantNuclear,
  'plant-hydro': plantHydro,
  'plant-wind': plantWind,
  'plant-solar': plantSolar,
  'plant-geo-bio': plantGeoBio,
  'plant-ocean': plantOcean,
  'plant-future': plantFuture,
  transmission: transmission,
  grid: grid,
  distribution: distribution,
  home: home,
  'lab-pv': labPv,
  'lab-inverter': labInverter,
  'lab-battery': labBattery,
  'lab-hybrid-home': labHybridHome,
};

const exportsOnDisk = import.meta.glob<{ steps: { id: string; panel: string[] }[] }>(
  '../../../../../../docs/volumes/electricity/chapters/_export/*.json',
  { eager: true, import: 'default' },
);

describe('generated runtime content', () => {
  it('covers all 25 chapters and loads through defineContent', () => {
    expect(Object.keys(GENERATED)).toHaveLength(25);
    for (const [id, raw] of Object.entries(GENERATED)) {
      const content = defineContent(raw, { labels: { drag: 'Перетягни' } });
      expect(content.id).toBe(id);
      expect(content.labels?.drag).toBe('Перетягни');
      expect(content.steps.length).toBeGreaterThan(0);
      for (const step of content.steps) expect(step.panel.length).toBeGreaterThan(0);
    }
  });

  it('keeps every step and panel page of the export, and no builder guidance', () => {
    for (const [id, raw] of Object.entries(GENERATED)) {
      const doc = exportsOnDisk[`../../../../../../docs/volumes/electricity/chapters/_export/${id}.json`]!;
      expect(raw.steps.map((s) => s.id)).toEqual(doc.steps.map((s) => s.id));
      expect(raw.steps.map((s) => s.panel)).toEqual(doc.steps.map((s) => s.panel));
      const json = JSON.stringify(raw);
      for (const key of ['"see"', '"interaction"', '"transition"', '"visualIdea"', '"notes"', '"tail"'])
        expect(json).not.toContain(key);
    }
  });
});
