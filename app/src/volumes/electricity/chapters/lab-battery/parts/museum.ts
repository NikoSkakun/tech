/**
 * Step 1 backdrop: the «музей» of battery history — Volta's pile (1800), a lead-acid battery (1859), NiMH
 * cells and the first commercial Li-ion cell (1991). Built with the kit `Builder` (one merged model, ≈ 4 draw
 * calls). Anchors: `volta`, `lead`, `nimh`, `liion` (tops of the exhibits) for callouts and hotspots.
 */
import { Builder, type KitModel } from '@/kit';
import { SEMANTIC, col } from '@/style';

export function createMuseum(): KitModel {
  const b = new Builder('museum');
  const copper = col('orange').lerp(col('wireBrown'), 0.35);
  const plinth = (x: number, z: number, h: number): void => {
    b.cyl(0.42, h, { at: [x, 0, z], seg: 36, bevel: 0.03, c: ['bg.indigo', 'slate'] });
  };

  // Volta's pile: zinc and copper discs separated by brine-soaked cloth, held by three glass rods
  b.frame({ at: [-0.75, 0, -0.75] }, () => {
    plinth(0, 0, 0.3);
    b.cyl(0.3, 0.06, { at: [0, 0.3, 0], seg: 28, c: 'wireBrown', bevel: 0.015 });
    for (let i = 0; i < 9; i++) {
      const y = 0.36 + i * 0.09;
      b.cyl(0.2, 0.034, { at: [0, y, 0], seg: 28, slot: 'metal', c: 'steel', bevel: 0.008 });
      b.cyl(0.2, 0.03, { at: [0, y + 0.034, 0], seg: 28, slot: 'metal', c: copper, bevel: 0.008 });
      b.cyl(0.21, 0.022, { at: [0, y + 0.065, 0], seg: 28, slot: 'matte', c: 'mist', bevel: 0.006 });
    }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      b.cyl(0.018, 0.95, {
        at: [Math.cos(a) * 0.25, 0.34, Math.sin(a) * 0.25],
        seg: 8,
        slot: 'gloss',
        c: 'sky.light',
      });
    }
    b.cyl(0.3, 0.05, { at: [0, 1.27, 0], seg: 28, c: 'wireBrown', bevel: 0.015 });
    b.anchor('volta', 0, 1.36, 0);
  });

  // lead-acid battery: six cells in a dark case, filler caps, + coral / − blue posts
  b.frame({ at: [0.55, 0, -0.95] }, () => {
    plinth(0, 0, 0.22);
    b.box(0.66, 0.4, 0.36, { at: [0, 0.22, 0], r: 0.04, c: ['ink', 'slate'] });
    b.box(0.7, 0.07, 0.4, { at: [0, 0.6, 0], r: 0.025, c: 'slate' });
    for (let i = 0; i < 6; i++)
      b.cyl(0.035, 0.035, { at: [-0.25 + i * 0.1, 0.67, 0.08], seg: 12, slot: 'gloss', c: 'yellow' });
    b.cyl(0.045, 0.08, { at: [-0.26, 0.67, -0.1], seg: 14, slot: 'metal', c: SEMANTIC.dcPlus });
    b.cyl(0.045, 0.08, { at: [0.26, 0.67, -0.1], seg: 14, slot: 'metal', c: SEMANTIC.dcMinus });
    b.anchor('lead', 0, 0.78, 0);
  });

  // NiCd / NiMH: two AA cells
  b.frame({ at: [0.1, 0, 0.45] }, () => {
    plinth(0, 0, 0.22);
    for (const x of [-0.1, 0.1]) {
      b.cyl(0.075, 0.5, {
        at: [x, 0.22, 0],
        seg: 24,
        slot: 'gloss',
        c: ['green.dark', 'green'],
        bevel: 0.015,
      });
      b.cyl(0.076, 0.07, { at: [x, 0.62, 0], seg: 24, slot: 'metal', c: 'mist', bevel: 0.01 });
      b.cyl(0.03, 0.035, { at: [x, 0.72, 0], seg: 12, slot: 'metal', c: 'mist' });
    }
    b.anchor('nimh', 0, 0.8, 0);
  });

  // the first commercial Li-ion cell (cylindrical, 1991)
  b.frame({ at: [1.2, 0, 0.2] }, () => {
    plinth(0, 0, 0.3);
    b.cyl(0.14, 0.62, { at: [0, 0.3, 0], seg: 28, slot: 'gloss', c: ['teal.dark', 'teal'], bevel: 0.02 });
    b.cyl(0.141, 0.08, { at: [0, 0.82, 0], seg: 28, slot: 'metal', c: 'mist', bevel: 0.01 });
    b.cyl(0.07, 0.035, { at: [0, 0.92, 0], seg: 16, slot: 'metal', c: SEMANTIC.dcPlus });
    b.ring(0.142, 0.012, { at: [0, 0.5, 0], c: 'lime', slot: 'glow' });
    b.anchor('liion', 0, 1.0, 0);
  });
  return b.build();
}
