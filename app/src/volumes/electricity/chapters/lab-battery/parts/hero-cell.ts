/**
 * The hero of the chapter: a giant cylindrical cell (21700 proportions 21 × 70 mm, ×34) with a window cut
 * into the can and a header that comes apart: gasket → CID disc → PTC ring → vent disc → positive cap.
 * Poles follow the DC code: positive cap `coral`, can bottom (negative) `blue`.
 *
 * Parts: `gasket`, `cid`, `ptc`, `vent`, `cap` (explode them along +Y). Anchors: `top`, `window`, `bottom`.
 */
import { Builder, G, type KitModel } from '@/kit';
import { SEMANTIC, col, type ColorLike } from '@/style';

export const HERO = { radius: 0.36, height: 2.4, headerY: 2.18 } as const;

/** Real sizes of the cylindrical formats, mm → scale factors relative to the 21700 hero (radial, axial). */
export const CYLINDER_FORMATS = {
  '18650': [18 / 21, 65 / 70],
  '21700': [1, 1],
  '4680': [46 / 21, 80 / 70],
} as const;

export function createHeroCell(wrap: ColorLike = 'teal'): KitModel {
  const { radius: R, height: H, headerY: Y } = HERO;
  const b = new Builder('hero-cell');
  const label = col(wrap);
  // the can: steel tube under a shrink-wrap label, with a 100° window facing +Z
  const windowAngle = 1.75;
  const phiStart = Math.PI / 2 + windowAngle / 2; // lathe φ = 0 is +X; the window is centred on +Z (φ = π/2)
  const span = Math.PI * 2 - windowAngle;
  const wall = G.revolve(
    [
      [R - 0.035, 0.03],
      [R, 0.03],
      [R, Y],
      [R - 0.035, Y],
    ],
    { seg: 64, phiStart, phiLength: span },
  );
  b.add(wall.shell, { slot: 'gloss', c: [label.clone().multiplyScalar(0.72), label] });
  if (wall.caps) b.add(wall.caps, { slot: 'metal', c: 'mist' });
  b.cyl(R, 0.05, { seg: 64, slot: 'metal', c: SEMANTIC.dcMinus, bevel: 0.012 });
  b.ring(R + 0.004, 0.022, { at: [0, Y - 0.02, 0], seg: 64, slot: 'metal', c: 'steel.light' }); // crimp bead
  b.ring(R + 0.002, 0.012, { at: [0, 0.34, 0], seg: 64, slot: 'glow', c: 'lime' }); // accent stripe
  b.box(0.012, H * 0.7, 0.03, { at: [-R * 0.94, 0.3, R * 0.33], r: 0, slot: 'metal', c: 'mist' });
  b.anchor('window', 0, H * 0.5, R);
  b.anchor('bottom', 0, 0.03, R * 0.8);
  b.anchor('top', 0, H, 0);

  const washer = (
    p: Builder,
    ri: number,
    ro: number,
    h: number,
    c: ColorLike,
    slot: 'metal' | 'gloss' | 'toon',
  ): void => {
    p.add(
      G.revolve(
        [
          [ri, 0],
          [ro, 0],
          [ro, h],
          [ri, h],
        ],
        { seg: 48 },
      ).shell,
      { slot, c },
    );
  };
  // header stack, bottom → top (each part has its pivot at its own base so it can slide up on its own)
  const gasket = b.part('gasket', { at: [0, Y - 0.02, 0] });
  washer(gasket, R * 0.55, R - 0.045, 0.06, 'ink', 'toon');
  b.anchor('gasket', R * 0.75, Y, 0);
  const cid = b.part('cid', { at: [0, Y + 0.035, 0] });
  cid.cyl(R * 0.8, 0.022, { seg: 48, slot: 'metal', c: 'mist', bevel: 0.006 });
  cid.dome(R * 0.26, 0.05, { at: [0, 0.018, 0], seg: 24, slot: 'metal', c: 'steel.light' }); // the weld dimple that tears
  const ptc = b.part('ptc', { at: [0, Y + 0.06, 0] });
  washer(ptc, R * 0.36, R * 0.8, 0.035, 'amber', 'gloss');
  const vent = b.part('vent', { at: [0, Y + 0.1, 0] });
  vent.cyl(R * 0.8, 0.02, { seg: 48, slot: 'metal', c: 'steel', bevel: 0.006 });
  for (const a of [0, Math.PI / 2])
    // scored cross: the membrane bursts along it
    vent.box(R * 1.2, 0.012, 0.018, { at: [0, 0.016, 0], rot: [0, a, 0], r: 0, slot: 'metal', c: 'slate' });
  const cap = b.part('cap', { at: [0, Y + 0.125, 0] });
  cap.cyl(R * 0.82, 0.05, { seg: 48, slot: 'metal', c: 'mist', bevel: 0.012 });
  cap.cyl(R * 0.5, 0.11, { at: [0, 0.04, 0], seg: 40, slot: 'gloss', c: SEMANTIC.dcPlus, bevel: 0.03 });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    cap.cyl(0.035, 0.012, {
      at: [Math.cos(a) * R * 0.66, 0.05, Math.sin(a) * R * 0.66],
      seg: 12,
      c: 'ink',
      bevel: 0,
    });
  }
  return b.build();
}
