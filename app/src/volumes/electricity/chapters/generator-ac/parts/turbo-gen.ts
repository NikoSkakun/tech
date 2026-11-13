/**
 * The power-station turbogenerator in cutaway (steps 7, 8, 11), toy proportions but the right anatomy: shaft
 * along X (turbine coupling at −X, exciter at +X). Parts that the «шари» buttons take away: `housing`
 * (gas-tight casing with a cut quarter), `stator` (laminated core with phase-coloured bars and end windings),
 * `rotor` (2-pole forging: N `coral` / S `blue` pole faces, copper field winding in slots, retaining rings,
 * shaft fans), `cooling` (hydrogen coolers on top, `sky`). Fixed: foundation, exciter, AVR cabinet, terminals.
 * Origin = centre of the foundation on the floor; the shaft is at `AXIS_Y`.
 */
import { Vector3 } from 'three';
import { Builder, G, type KitModel } from '@/kit';
import { COPPER, PHASE } from '../world';

export const AXIS_Y = 1.75;
const L = 4.4; // core length
const R_OUT = 1.5;
const R_CORE = 1.3;
const R_BORE = 0.82;
const R_ROT = 0.7;

export function createTurboGen(): KitModel {
  const b = new Builder('turbogenerator');
  // foundation and feet
  b.box(7.6, 0.3, 2.6, { r: 0.08, c: ['ink', 'slate'] });
  for (const x of [-1.8, 1.8]) b.box(0.5, AXIS_Y - R_OUT + 0.15, 2.2, { r: 0.06, c: 'slate', at: [x, 0.3, 0] });
  // G.lathe angle φ maps to y = −r·cos φ, z = r·sin φ after the −90° turn about Z: the open quarter
  // φ ∈ [0,5π, π] faces up and toward the viewer (+Y, +Z)
  const cut = { phiStart: Math.PI, phiLength: Math.PI * 1.5 };

  // housing: thick shell with a cut quarter, domed end bells
  const housing = b.part('housing', { at: [0, AXIS_Y, 0] });
  const shell = G.revolve([[R_OUT - 0.08, -L / 2 - 0.3], [R_OUT, -L / 2 - 0.3], [R_OUT, L / 2 + 0.3], [R_OUT - 0.08, L / 2 + 0.3]], { seg: 64, ...cut });
  housing.add(shell.shell, { c: ['teal.dark', 'teal'], slot: 'gloss', rot: [0, 0, -Math.PI / 2] });
  if (shell.caps) housing.add(shell.caps, { c: 'slate', rot: [0, 0, -Math.PI / 2] });
  for (const s of [-1, 1]) {
    const bell = G.revolve([[0.3, 0], [R_OUT, 0], [R_OUT * 0.8, 0.35], [0.35, 0.5]], { seg: 48, ...cut });
    housing.add(bell.shell, { c: 'teal.dark', slot: 'gloss', rot: [0, 0, -Math.PI / 2], s: [1, s, 1], at: [s * (L / 2 + 0.3), 0, 0] });
    for (let i = 0; i < 3; i++) housing.add(G.lathe([[R_OUT, -0.05], [R_OUT + 0.04, 0], [R_OUT, 0.05]], { seg: 48, ...cut }), { c: 'steel', slot: 'metal', rot: [0, 0, -Math.PI / 2], at: [s * (L / 2 - 0.4 - i * 0.6), 0, 0] });
  }

  // stator: laminated core (cut like the housing), bars in the slots, end windings
  const stator = b.part('stator', { at: [0, AXIS_Y, 0] });
  const core = G.revolve([[R_BORE, -L / 2], [R_CORE, -L / 2], [R_CORE, L / 2], [R_BORE, L / 2]], { seg: 72, ...cut });
  stator.add(core.shell, { c: ['steel', 'mist'], slot: 'metal', rot: [0, 0, -Math.PI / 2] });
  if (core.caps) stator.add(core.caps, { c: 'slate', rot: [0, 0, -Math.PI / 2] });
  for (let i = -8; i <= 8; i++) stator.add(G.lathe([[R_CORE, -0.015], [R_CORE + 0.012, 0], [R_CORE, 0.015]], { seg: 48, ...cut }), { c: 'slate', rot: [0, 0, -Math.PI / 2], at: [(i * L) / 17, 0, 0] });
  const slots = 24;
  for (let k = 0; k < slots; k++) {
    const a = cut.phiStart + ((k + 0.5) / slots) * Math.PI * 2;
    if (a - cut.phiStart > cut.phiLength) continue; // no bars where the core is cut away
    const y = -Math.cos(a) * (R_BORE + 0.12);
    const z = Math.sin(a) * (R_BORE + 0.12);
    const c = PHASE[Math.floor(k / 2) % 3]!;
    stator.box(L + 0.5, 0.11, 0.11, { r: 0.03, mid: true, c, slot: 'gloss', at: [0, y, z] });
  }
  for (const s of [-1, 1]) for (let ph = 0; ph < 3; ph++) {
    const arc = G.lathe([[R_BORE + 0.15, 0], [R_CORE + 0.05, 0.12], [R_BORE + 0.2, 0.3]], { seg: 32, phiStart: cut.phiStart + (ph * cut.phiLength) / 3, phiLength: cut.phiLength / 3 - 0.05 });
    stator.add(arc, { c: PHASE[ph]!, slot: 'gloss', rot: [0, 0, -Math.PI / 2], s: [1, s, 1], at: [s * (L / 2 + 0.25), 0, 0] });
  }
  stator.anchor('bars', 0.8, -Math.cos(Math.PI + 0.25) * (R_BORE + 0.12), Math.sin(Math.PI + 0.25) * (R_BORE + 0.12));

  // rotor: 2-pole forging (N face up = +Y at angle 0), field winding slots, retaining rings, fans, shaft
  const rotor = b.part('rotor', { at: [0, AXIS_Y, 0] });
  rotor.cyl(R_ROT, L, { axis: 'x', seg: 48, c: 'steel', slot: 'metal', at: [-L / 2, 0, 0] });
  for (const [sign, c] of [[1, 'coral'], [-1, 'blue']] as const) rotor.box(L - 0.2, 0.06, 0.62, { r: 0.03, mid: true, c, slot: 'gloss', at: [0, sign * (R_ROT + 0.005), 0] });
  for (const a of [0.9, 1.25, -0.9, -1.25, Math.PI - 0.9, Math.PI - 1.25, Math.PI + 0.9, Math.PI + 1.25]) {
    rotor.box(L - 0.4, 0.07, 0.09, { r: 0.02, mid: true, c: COPPER, slot: 'metal', at: [0, Math.cos(a) * (R_ROT + 0.01), Math.sin(a) * (R_ROT + 0.01)], rot: [a, 0, 0] });
  }
  for (const s of [-1, 1]) {
    rotor.cyl(R_ROT + 0.04, 0.35, { axis: 'x', seg: 48, c: 'mist', slot: 'metal', at: [s * (L / 2) - (s < 0 ? 0 : 0.35), 0, 0] });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      rotor.box(0.08, 0.32, 0.12, { r: 0.02, mid: true, c: 'steel.light', slot: 'metal', at: [s * (L / 2 + 0.55), Math.cos(a) * 0.55, Math.sin(a) * 0.55], rot: [a, 0, 0.4] });
    }
  }
  rotor.cyl(0.22, L + 3.2, { axis: 'x', seg: 24, c: 'mist', slot: 'metal', at: [-L / 2 - 1.6, 0, 0] });
  rotor.cyl(0.36, 0.5, { axis: 'x', seg: 32, c: 'slate', slot: 'metal', at: [L / 2 + 1.0, 0, 0] }); // exciter armature
  rotor.anchor('poleN', 0, R_ROT + 0.05, 0);

  // cooling: hydrogen coolers on top of the casing
  const cooling = b.part('cooling', { at: [0, AXIS_Y + R_OUT, 0] });
  for (const z of [-0.65, 0.65]) {
    cooling.box(2.6, 0.45, 0.6, { r: 0.12, c: ['sky.dark', 'sky'], slot: 'gloss', at: [0, 0, z] });
    for (let i = 0; i < 6; i++) cooling.cyl(0.05, 2.9, { axis: 'x', c: 'sky.light', slot: 'gloss', at: [-1.45, 0.12 + (i % 2) * 0.16, z - 0.2 + Math.floor(i / 2) * 0.2] });
  }
  cooling.anchor('cooler', 0, 0.5, 0.65);

  // exciter housing + AVR cabinet at +X, terminals with three phase bushings below the core
  b.box(1.0, 1.2, 1.3, { r: 0.12, c: ['slate', 'steel'], slot: 'gloss', at: [L / 2 + 1.5, 0.3, 0] });
  b.box(0.8, 1.9, 0.6, { r: 0.08, c: ['ink', 'slate'], at: [L / 2 + 1.6, 0.3, 1.05] });
  b.box(0.42, 0.28, 0.02, { r: 0.03, slot: 'glow', c: 'teal', at: [L / 2 + 1.6, 1.65, 1.36] });
  b.anchor('avr', L / 2 + 1.6, 1.7, 1.38);
  b.anchor('exciter', L / 2 + 1.5, 1.6, 0);
  PHASE.forEach((c, k) => {
    b.cyl(0.11, 0.55, { c: 'white', slot: 'gloss', at: [-0.9 + k * 0.6, 0.3, 1.25] });
    b.cyl(0.13, 0.08, { c, slot: 'gloss', at: [-0.9 + k * 0.6, 0.85, 1.25] });
    b.anchor(`term${k}`, -0.9 + k * 0.6, 0.95, 1.25);
  });
  b.path('gap', [new Vector3(-L / 2 - 1.5, AXIS_Y + 0.75, 0.2), new Vector3(L / 2 + 1, AXIS_Y + 0.75, 0.2)]);
  return b.build();
}
