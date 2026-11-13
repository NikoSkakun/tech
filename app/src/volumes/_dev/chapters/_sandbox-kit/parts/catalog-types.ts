/** Catalogue entry type for the studio turntable and QA thumbnail sheets. */
import type { ChapterContext } from '@/engine/api';
import type { KitModel } from '@/kit';

export interface CatalogEntry {
  id: string;
  set: 'env' | 'life' | 'buildings' | 'industrial' | 'machines' | 'grid' | 'energy';
  make: (ctx: ChapterContext) => KitModel;
  /** Camera direction: azimuth / elevation in degrees, zoom factor (> 1 = closer); `focus` frames a sphere around an anchor (close-ups). */
  view?: { az?: number; el?: number; zoom?: number; focus?: { anchor: string; radius: number } };
  /** Hide the turntable plinth (islands bring their own ground). */
  bare?: boolean;
}
