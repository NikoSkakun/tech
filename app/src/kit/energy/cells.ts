/**
 * Battery cells at real size (metres): cylindrical (21700), prismatic LFP (the 100 Ah cell of the shared
 * battery) and pouch. Terminals follow the DC pole code: + coral, − blue. `cut` opens a window onto the
 * wound / stacked electrodes: cathode sheets `sky`, anode `slate`, separator `white` — and Li⁺ is `lime`
 * wherever a chapter draws ions. Origin: centre of the base, standing upright.
 */
import { col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';

export type CellKind = 'cylindrical' | 'prismatic' | 'pouch';

/** Anchors: `plus`, `minus`, `inside` (centre of the electrode stack). */
export function addCell(b: Builder, kind: CellKind = 'cylindrical', o: { cut?: boolean } = {}): void {
  const layers = ['sky', 'white', 'slate', 'white'] as const;
  if (kind === 'cylindrical') {
    const r = 0.0105;
    const h = 0.07;
    const wrap = col('teal');
    const span = o.cut ? Math.PI * 1.45 : Math.PI * 2;
    const can = G.revolve([[r * 0.93, 0.001], [r, 0.001], [r, h - 0.004], [r * 0.93, h - 0.004]], { seg: 28, phiStart: Math.PI * 0.6, phiLength: span });
    b.add(can.shell, { slot: 'gloss', c: [wrap.clone().multiplyScalar(0.85), wrap] });
    if (can.caps) b.add(can.caps, { slot: 'metal', c: 'mist' });
    // jelly roll: concentric layers (a spiral reads the same at this size), visible through the cut
    for (let i = 0; i < 8; i++) {
      const rr = r * (0.2 + i * 0.09);
      b.add(G.lathe([[rr, 0.004], [rr, h - 0.008]], { seg: 20, phiStart: Math.PI * 0.6, phiLength: span }), { slot: 'double', c: layers[i % 4]! });
    }
    b.cyl(r, 0.002, { seg: 24, slot: 'metal', c: 'blue', at: [0, 0, 0], bevel: 0 });
    b.cyl(r * 0.98, 0.003, { seg: 24, slot: 'metal', c: 'mist', at: [0, h - 0.005, 0], bevel: 0 });
    b.cyl(r * 0.5, 0.003, { seg: 16, slot: 'metal', c: 'coral', at: [0, h - 0.002, 0], bevel: 0.0005 });
    b.anchor('plus', 0, h + 0.001, 0);
    b.anchor('minus', 0, 0, 0);
    b.anchor('inside', 0, h / 2, 0);
    return;
  }
  if (kind === 'prismatic') {
    const [w, h, d] = [0.16, 0.2, 0.05];
    const c = col('blue').lerp(col('sky'), 0.25);
    if (!o.cut) b.box(w, h, d, { r: 0.006, seg: 2, slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c] });
    else {
      b.box(w, h, d * 0.3, { r: 0.004, slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c], at: [0, 0, -d * 0.35] });
      for (let i = 0; i < 10; i++) b.box(w * 0.92, h * 0.86, d * 0.05, { r: 0, slot: 'gloss', c: layers[i % 4]!, at: [0, h * 0.04, -d * 0.17 + i * d * 0.062] });
    }
    b.box(w * 1.01, 0.008, d * 1.02, { r: 0.002, slot: 'gloss', c: 'ink', at: [0, h - 0.004, 0] });
    for (const [name, x, tc] of [['plus', -w * 0.3, 'coral'], ['minus', w * 0.3, 'blue']] as const) {
      b.cyl(0.011, 0.012, { seg: 12, slot: 'metal', c: tc, at: [x, h + 0.003, 0] });
      b.anchor(name, x, h + 0.016, 0);
    }
    b.cyl(0.008, 0.002, { seg: 10, slot: 'metal', c: 'mist', at: [0, h + 0.004, 0] });
    b.anchor('inside', 0, h / 2, 0);
    return;
  }
  const [w, h, d] = [0.1, 0.14, 0.009];
  b.box(w, h, d, { r: 0.004, seg: 2, slot: 'metal', c: ['steel.light', 'mist'] });
  b.box(w * 1.06, h * 1.02, 0.001, { r: 0, slot: 'metal', c: 'mist', at: [0, -0.001, 0] });
  if (o.cut) for (let i = 0; i < 6; i++) b.box(w * 0.86, h * 0.84, 0.0012, { r: 0, slot: 'gloss', c: layers[i % 4]!, at: [0, h * 0.06, d * 0.5 + 0.001 + i * 0.0013] });
  for (const [name, x, tc] of [['plus', -w * 0.24, 'coral'], ['minus', w * 0.24, 'blue']] as const) {
    b.box(0.02, 0.022, 0.0012, { r: 0, slot: 'metal', c: tc, at: [x, h, 0] });
    b.anchor(name, x, h + 0.022, 0);
  }
  b.anchor('inside', 0, h / 2, d);
}

export function cell(kind: CellKind = 'cylindrical', o: { cut?: boolean } = {}): KitModel {
  const b = new Builder(`cell-${kind}`);
  addCell(b, kind, o);
  return b.build();
}
