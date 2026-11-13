/**
 * Catalogue of kit models for the studio turntable and the QA thumbnail sheets (`docs/KIT_API.md`).
 */
import { BUILDINGS } from './catalog-buildings';
import { ENERGY } from './catalog-energy';
import { ENERGY2 } from './catalog-energy2';
import { ENV } from './catalog-env';
import { ENV2 } from './catalog-env2';
import { GRID } from './catalog-grid';
import { HOME } from './catalog-home';
import { INDUSTRIAL } from './catalog-industrial';
import { INDUSTRIAL2 } from './catalog-industrial2';
import { LIFE } from './catalog-life';
import { MACHINES } from './catalog-machines';
import { GRID2 } from './catalog-grid2';
import { GRID3 } from './catalog-grid3';
import { M3 } from './catalog-m3';
import type { CatalogEntry } from './catalog-types';

export type { CatalogEntry } from './catalog-types';

export const CATALOG: CatalogEntry[] = [...ENV, ...ENV2, ...GRID, ...GRID2, ...GRID3, ...BUILDINGS, ...ENERGY, ...HOME, ...INDUSTRIAL, ...INDUSTRIAL2, ...MACHINES, ...LIFE, ...ENERGY2, ...M3];
