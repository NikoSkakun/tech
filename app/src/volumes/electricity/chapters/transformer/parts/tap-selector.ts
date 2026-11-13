/**
 * Inside the OLTC compartment (step 5), world units: the tapped part of the HV winding (left), its 19 tap leads
 * to the selector — a pressboard disc with copper contacts −9…+9 on an arc and a rotating arm (part `arm`) —, the
 * diverter switch with its two transition resistors (glow materials driven by the step) and moving contact (part
 * `diverter`), and the automatic voltage regulator cabinet with «вище» / «нижче» lamps (glow materials).
 */
import { Mesh, SphereGeometry, Vector3 } from 'three';
import { Builder, G, type KitModel } from '@/kit';
import { K, col } from '@/style';
import { COPPER, COPPER_PRIMARY } from '../world';

export const TAPS = 9;
export const SEL = { x: -0.2, y: 2.2, r: 1.25 } as const;
/** Angle of contact n on the selector disc (n = −9 on the lower left … +9 on the lower right, 0 at the top). */
export const tapAngle = (n: number): number => Math.PI / 2 - (n / TAPS) * (Math.PI * 0.68);
const CASE = col('slate').lerp(col('bg.indigo'), 0.2);

export interface TapSelector extends KitModel {
  resistors: [ReturnType<typeof K.glow>, ReturnType<typeof K.glow>];
  lampUp: ReturnType<typeof K.glow>;
  lampDown: ReturnType<typeof K.glow>;
  contact(n: number): Vector3;
}

export function createTapSelector(): TapSelector {
  const b = new Builder('tap-selector');
  // tapped winding section with a lead per tap
  const wx = -2.7;
  b.cyl(0.55, 2.6, { seg: 36, slot: 'metal', c: [COPPER_PRIMARY.clone().multiplyScalar(0.8), COPPER_PRIMARY], at: [wx, 0.9, 0] });
  for (let i = 0; i < 26; i++) b.ring(0.56, 0.018, { seg: 36, tubeSeg: 4, slot: 'metal', c: COPPER_PRIMARY.clone().multiplyScalar(0.7), at: [wx, 0.98 + i * 0.095, 0] });
  b.cyl(0.3, 2.7, { seg: 24, slot: 'toon', c: 'mist', at: [wx, 0.85, 0] });
  // selector disc on a pedestal
  b.cyl(0.2, SEL.y - 0.2, { seg: 20, slot: 'metal', c: 'steel', at: [SEL.x, 0, -0.25] });
  b.cyl(SEL.r + 0.25, 0.12, { axis: 'z', seg: 64, slot: 'gloss', c: col('mist').lerp(col('amber'), 0.15), at: [SEL.x, SEL.y, -0.2] });
  const contacts: Vector3[] = [];
  for (let n = -TAPS; n <= TAPS; n++) {
    const a = tapAngle(n);
    const p = new Vector3(SEL.x + Math.cos(a) * SEL.r, SEL.y + Math.sin(a) * SEL.r, -0.08);
    contacts.push(p);
    b.cyl(0.075, 0.12, { axis: 'z', seg: 14, slot: 'metal', c: n === 0 ? 'orange' : COPPER, at: [p.x, p.y, p.z] });
    // lead from the winding to the contact, behind the disc
    const y = 1.05 + ((n + TAPS) / (2 * TAPS)) * 2.3;
    const lead = G.tube(G.roundPath([new Vector3(wx + 0.55, y, 0), new Vector3(wx + 1.0, y, -0.3), new Vector3(p.x, p.y, -0.32), new Vector3(p.x, p.y, -0.1)], 0.15, 4), 0.022, { seg: 6 });
    b.add(lead, { slot: 'metal', c: COPPER });
  }
  const arm = b.part('arm', { at: [SEL.x, SEL.y, 0.02] });
  arm.cyl(0.18, 0.1, { axis: 'z', seg: 24, slot: 'gloss', c: 'ink' });
  arm.beam([0, 0, 0.1], [SEL.r, 0, 0.1], 0.12, { h: 0.06, slot: 'metal', c: 'steel.light' });
  arm.sphere(0.1, { seg: 16, slot: 'gloss', c: 'cyan', at: [SEL.r, 0, 0.12] });
  // diverter switch: housing, two transition resistors, moving contact
  const dx = 2.05;
  b.box(1.0, 1.9, 0.5, { r: 0.08, slot: 'gloss', c: CASE, at: [dx, 0.9, -0.3] });
  b.box(0.85, 1.6, 0.04, { r: 0.04, slot: 'gloss', c: 'ink', at: [dx, 1.05, -0.04] });
  const resistors = [K.glow({ color: 'orange', intensity: 0.15, whiten: 0, keepHue: true }), K.glow({ color: 'orange', intensity: 0.15, whiten: 0, keepHue: true })] as [ReturnType<typeof K.glow>, ReturnType<typeof K.glow>];
  for (let k = 0; k < 2; k++) {
    const x = dx - 0.2 + k * 0.4;
    const zig: Vector3[] = [];
    for (let i = 0; i <= 12; i++) zig.push(new Vector3(x + (i % 2 ? 0.09 : -0.09), 1.25 + i * 0.07, 0.02));
    b.attach(new Mesh(G.tube(zig, 0.024, { seg: 6 }), resistors[k]));
    b.anchor(`r${k}`, x, 1.65, 0.05);
  }
  const div = b.part('diverter', { at: [dx, 1.0, 0.03] });
  div.beam([0, 0, 0], [0, 0.42, 0], 0.08, { h: 0.05, slot: 'metal', c: 'steel.light' });
  div.sphere(0.06, { seg: 12, slot: 'gloss', c: 'cyan', at: [0, 0.42, 0.02] });
  // regulator cabinet with two lamps
  const rx = 3.55;
  b.box(0.9, 1.4, 0.55, { r: 0.07, slot: 'gloss', c: 'mist', at: [rx, 0, -0.1] });
  b.box(0.7, 0.9, 0.03, { r: 0.03, slot: 'gloss', c: 'ink', at: [rx, 0.35, 0.18] });
  const lampUp = K.glow({ color: 'amber', intensity: 0.15, whiten: 0, keepHue: true });
  const lampDown = K.glow({ color: 'sky', intensity: 0.15, whiten: 0, keepHue: true });
  const lamp = (m: ReturnType<typeof K.glow>, x: number): void => {
    const s = new Mesh(new SphereGeometry(0.1, 16, 12), m);
    s.position.set(x, 1.0, 0.22);
    b.attach(s);
  };
  lamp(lampUp, rx - 0.17);
  lamp(lampDown, rx + 0.17);
  b.anchor('regulator', rx, 1.45, 0.2).anchor('upLamp', rx - 0.17, 1.0, 0.24).anchor('downLamp', rx + 0.17, 1.0, 0.24);
  b.anchor('diverter', dx, 1.95, 0.1).anchor('selector', SEL.x, SEL.y + SEL.r + 0.3, 0);
  const model = b.build();
  return Object.assign(model, { resistors, lampUp, lampDown, contact: (n: number) => contacts[n + TAPS]!.clone() });
}
