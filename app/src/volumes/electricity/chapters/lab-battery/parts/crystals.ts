/**
 * Step 5: the «вітрина хімій» — stylised cathode / anode crystals on pedestals. Shapes follow the real
 * structure families: layered oxides (LCO, NMC, NCA, Na-ion) are stacks of slabs with ions in the galleries,
 * olivine (LFP) is a block with one-dimensional tunnels, spinels (LMO, LTO) are octahedral crystals with a 3D
 * channel network; the solid-state exhibit is a slice Li metal | glass electrolyte | cathode.
 */
import { OctahedronGeometry, type Group } from 'three';
import { Builder } from '@/kit';
import type { ColorLike } from '@/style';

export type ChemId = 'LCO' | 'NMC' | 'NCA' | 'LFP' | 'LMO' | 'LTO' | 'Na-ion';
export type ExhibitId = ChemId | 'solid';

/** Colour that stands for the chemistry everywhere in the chapter (charts, sleeves, rings). */
export const CHEM_COLOR: Record<ChemId, ColorLike> = {
  LCO: 'blue',
  NMC: 'violet',
  NCA: 'sky',
  LFP: 'teal',
  LMO: 'pink',
  LTO: 'mist',
  'Na-ion': 'orange',
};

/** Stack of hexagonal slabs with a layer of guest ions in every gallery. */
function layered(b: Builder, slabs: readonly ColorLike[], ion: ColorLike, ionR: number): void {
  slabs.forEach((c, i) => {
    const y = i * 0.3;
    b.cyl(0.46, 0.15, { at: [0, y, 0], seg: 6, slot: 'gloss', c, bevel: 0.03 });
    if (i === slabs.length - 1) return;
    for (let k = 0; k < 7; k++) {
      const a = (k / 6) * Math.PI * 2;
      const r = k === 6 ? 0 : 0.27;
      b.sphere(ionR, { at: [Math.cos(a) * r, y + 0.225, Math.sin(a) * r], seg: 10, slot: 'glow', c: ion });
    }
  });
}

function olivine(b: Builder): void {
  // a bundle of columns leaves straight tunnels along Y — lithium moves in single file
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      if ((i + j) % 2 === 0)
        b.box(0.26, 1.0, 0.26, {
          at: [i * 0.27, 0, j * 0.27],
          r: 0.04,
          slot: 'gloss',
          c: (i + j) % 4 === 0 ? 'teal' : 'teal.light',
        });
      else
        for (let k = 0; k < 4; k++)
          b.sphere(0.06, { at: [i * 0.27, 0.14 + k * 0.25, j * 0.27], seg: 10, slot: 'glow', c: 'lime' });
    }
}

function spinel(b: Builder, c: ColorLike, light: ColorLike): void {
  const octa = new OctahedronGeometry(0.42, 0);
  b.add(octa, { at: [0, 0.52, 0], slot: 'facet', c });
  b.add(octa, { at: [0.26, 0.3, 0.2], s: 0.55, slot: 'facet', c: light });
  b.add(octa, { at: [-0.24, 0.26, -0.18], s: 0.5, slot: 'facet', c: light });
  for (const [x, y, z] of [
    [0.3, 0.75, -0.1],
    [-0.3, 0.7, 0.14],
    [0, 0.98, 0.2],
  ] as const)
    b.sphere(0.055, { at: [x, y, z], seg: 10, slot: 'glow', c: 'lime' });
}

function solidState(b: Builder): void {
  b.box(0.9, 0.16, 0.7, { r: 0.03, slot: 'metal', c: 'mist' }); // lithium-metal anode
  b.box(0.9, 0.2, 0.7, { at: [0, 0.18, 0], r: 0.03, slot: 'glass', c: 'sky' }); // solid (glass / ceramic) electrolyte
  b.box(0.9, 0.3, 0.7, { at: [0, 0.4, 0], r: 0.03, slot: 'gloss', c: ['violet.dark', 'violet'] });
  b.box(0.9, 0.05, 0.7, { at: [0, 0.71, 0], r: 0.01, slot: 'metal', c: 'steel.light' });
  for (let k = 0; k < 5; k++)
    b.sphere(0.05, { at: [-0.3 + k * 0.15, 0.28, 0.36], seg: 10, slot: 'glow', c: 'lime' });
}

/** The crystal of one exhibit, standing on y = 0, ≈ 1 unit tall. */
export function createCrystal(id: ExhibitId): Group {
  const b = new Builder(`crystal-${id}`);
  switch (id) {
    case 'LCO':
      layered(b, ['blue', 'blue.light', 'blue', 'blue.light'], 'lime', 0.055);
      break;
    case 'NMC':
      layered(b, ['blue', 'violet', 'teal', 'violet'], 'lime', 0.055);
      break;
    case 'NCA':
      layered(b, ['blue', 'sky', 'blue', 'sky'], 'lime', 0.055);
      break;
    case 'Na-ion':
      layered(b, ['orange', 'orange.light', 'orange', 'orange.light'], 'amber', 0.085); // Na⁺ is the bigger ion
      break;
    case 'LFP':
      olivine(b);
      break;
    case 'LMO':
      spinel(b, 'pink', 'pink.light');
      break;
    case 'LTO':
      spinel(b, 'mist', 'white');
      break;
    case 'solid':
      solidState(b);
      break;
  }
  return b.build().group;
}
